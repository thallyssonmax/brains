import {createClient} from '@supabase/supabase-js';
import {createHash} from 'node:crypto';
import {equalSecret} from './engagement-security.js';
import {sendEngagementMessage} from '../engagement-send.js';

const response=(status,body)=>Response.json(body,{status,headers:{'Cache-Control':'no-store'}});
// The owner authorized tests for two pilot accounts. General release remains locked.
export const ENGAGEMENT_RELEASE_UNLOCKED=false;
export const ENGAGEMENT_TEST_RELEASE_UNLOCKED=true;
const TEST_RECIPIENT_SHA256S=Object.freeze(['a01b27204b7093a8c41416d9ed64d519c5a6994382880f93628a8ca2ca5c40b3','8ffdb8f6a3d1b9e4e40bc4bbdf293f1249301bea5bacee3f9abfa1918597bb6d']);
export const approvedTestRecipient=(email,allowedDigests=TEST_RECIPIENT_SHA256S)=>{
 const configured=process.env.ENGAGEMENT_TEST_RECIPIENT;
 if(typeof configured!=='string'||configured.trim()===''||typeof email!=='string')return false;
 const configuredDigest=createHash('sha256').update(configured.trim().toLowerCase()).digest('hex');
 const recipientDigest=createHash('sha256').update(email.trim().toLowerCase()).digest('hex');
 const approved=Array.isArray(allowedDigests)?allowedDigests:[allowedDigests];
 return TEST_RECIPIENT_SHA256S.includes(configuredDigest)&&approved.includes(recipientDigest);
};
export function dailyPilotCandidates(candidates,limit=2){
 const selected=[];const seen=new Set();
 for(const candidate of candidates||[]){
  const recipient=typeof candidate.email==='string'?candidate.email.trim().toLowerCase():'';
  if(!approvedTestRecipient(recipient)||seen.has(recipient))continue;
  seen.add(recipient);selected.push(candidate);
  if(selected.length>=limit)break;
 }
 return selected;
}
export function serviceClient(){const url=process.env.SUPABASE_URL||process.env.VITE_SUPABASE_URL,key=process.env.SUPABASE_SERVICE_ROLE_KEY;if(!url||!key)throw Error('serviceConfigurationMissing');return createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false}})}
export function engagementSendingEnabled(){return ENGAGEMENT_TEST_RELEASE_UNLOCKED&&process.env.ENGAGEMENT_ENABLED==='true'&&process.env.ENGAGEMENT_RELEASE_APPROVED==='true'&&approvedTestRecipient(process.env.ENGAGEMENT_TEST_RECIPIENT)}

export async function GET(request){
 if(!equalSecret(request.headers.get('authorization'),`Bearer ${process.env.CRON_SECRET||''}`)||!process.env.CRON_SECRET)return response(401,{error:'unauthorized'});
 if(!engagementSendingEnabled())return response(200,{enabled:false,sent:0});
 if(!process.env.RESEND_API_KEY||!process.env.EMAIL_UNSUBSCRIBE_SECRET)return response(503,{error:'emailConfigurationMissing'});
 const db=serviceClient();const {data:candidates,error}=await db.rpc('brains_engagement_candidates');
 if(error){console.error('engagement_candidates_failed',error.code);return response(503,{error:'database'});}
 let sent=0,failed=0,skipped=0;
 // The Hobby cron runs daily. Allow at most one message per pilot and two total, below Resend's free daily quota shared with Auth mail.
 for(const candidate of dailyPilotCandidates(candidates)){
  if(!approvedTestRecipient(candidate.email)){skipped++;continue}
  const {data:message,error:claimError}=await db.rpc('brains_engagement_claim',{p_user_id:candidate.user_id,p_campaign:candidate.campaign,p_occurrence_key:candidate.occurrence_key});
  if(claimError){failed++;console.error('engagement_claim_failed',claimError.code);continue}
  if(!message){skipped++;continue}
  if(!approvedTestRecipient(message.email)){failed++;await db.rpc('brains_engagement_mark',{p_message_id:message.id,p_status:'failed'});console.error('engagement_recipient_rejected');continue}
  const result=await sendEngagementMessage(db,message);
  if(result.status==='sent')sent++;else failed++;
 }
 return response(200,{enabled:true,candidates:(candidates||[]).length,sent,failed,skipped});
}


export async function handleWelcome(request,deps={}){
 const authorization=request.headers.get('authorization')||'';
 if(!authorization.startsWith('Bearer ')||authorization.length<16)return response(401,{error:'unauthorized'});
 try{
  const db=(deps.serviceClient||serviceClient)();
  const token=authorization.slice(7);
  const verified=deps.verifyUser?await deps.verifyUser(token):await db.auth.getUser(token);
  const user=verified?.data?.user||verified?.user;
  if(verified?.error||!user?.id||!user.email||!user.email_confirmed_at)return response(401,{error:'unauthorized'});
  const enabled=(deps.enabled||engagementSendingEnabled)();
  const allowed=(deps.approvedRecipient||approvedTestRecipient)(user.email);
  if(!enabled||!allowed)return response(200,{enabled:false,sent:0});
  const {data:candidates,error}=await db.rpc('brains_engagement_candidates');
  if(error){console.error('engagement_welcome_candidates_failed',error.code);return response(503,{error:'database'});}
  const candidate=(candidates||[]).find(item=>item.user_id===user.id&&item.campaign==='welcome');
  if(!candidate)return response(200,{enabled:true,sent:0});
  const {data:message,error:claimError}=await db.rpc('brains_engagement_claim',{p_user_id:user.id,p_campaign:'welcome',p_occurrence_key:candidate.occurrence_key});
  if(claimError){console.error('engagement_welcome_claim_failed',claimError.code);return response(503,{error:'database'});}
  if(!message)return response(200,{enabled:true,sent:0});
  if(message.user_id!==user.id||message.campaign!=='welcome'||message.email?.trim().toLowerCase()!==user.email.trim().toLowerCase()||!(deps.approvedRecipient||approvedTestRecipient)(message.email)){
   await db.rpc('brains_engagement_mark',{p_message_id:message.id,p_status:'failed'});
   console.error('engagement_welcome_recipient_rejected');
   return response(403,{error:'recipientRejected'});
  }
  const result=await (deps.sendMessage||sendEngagementMessage)(db,message);
  return response(result.status==='sent'?200:503,{enabled:true,sent:result.status==='sent'?1:0});
 }catch(error){console.error('engagement_welcome_failed',error?.name||'unknown');return response(503,{error:'unavailable'})}
}
export async function POST(request){return handleWelcome(request)}
