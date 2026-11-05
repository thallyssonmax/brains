import {createClient} from '@supabase/supabase-js';
import {equalSecret} from './engagement-security.js';
import {sendEngagementMessage} from '../engagement-send.js';

const response=(status,body)=>Response.json(body,{status,headers:{'Cache-Control':'no-store'}});
// General release authorized by the owner; database eligibility and opt-out still apply.
export const ENGAGEMENT_RELEASE_UNLOCKED=true;
export const validRecipient=email=>typeof email==='string'&&/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
export function dailyCandidates(candidates,limit=50){
 const selected=[];const seen=new Set();const users=new Set();
 for(const candidate of candidates||[]){
  const recipient=typeof candidate.email==='string'?candidate.email.trim().toLowerCase():'';
  if(!candidate.user_id||!validRecipient(recipient)||seen.has(recipient)||users.has(candidate.user_id))continue;
  seen.add(recipient);users.add(candidate.user_id);selected.push(candidate);
  if(selected.length>=limit)break;
 }
 return selected;
}
export function serviceClient(){const url=process.env.SUPABASE_URL||process.env.VITE_SUPABASE_URL,key=process.env.SUPABASE_SERVICE_ROLE_KEY;if(!url||!key)throw Error('serviceConfigurationMissing');return createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false}})}
export function engagementSendingEnabled(){return ENGAGEMENT_RELEASE_UNLOCKED&&process.env.ENGAGEMENT_ENABLED==='true'&&process.env.ENGAGEMENT_RELEASE_APPROVED==='true'}

export async function handleCron(request,deps={}){
 if(!equalSecret(request.headers.get('authorization'),`Bearer ${process.env.CRON_SECRET||''}`)||!process.env.CRON_SECRET)return response(401,{error:'unauthorized'});
 if(!engagementSendingEnabled())return response(200,{enabled:false,sent:0});
 if(!process.env.RESEND_API_KEY||!process.env.EMAIL_UNSUBSCRIBE_SECRET)return response(503,{error:'emailConfigurationMissing'});
 const db=(deps.serviceClient||serviceClient)();const {data:candidates,error}=await db.rpc('brains_engagement_candidates');
 if(error){console.error('engagement_candidates_failed',error.code);return response(503,{error:'database'});}
 let sent=0,failed=0,skipped=0;
 const now=deps.now||Date.now,started=now();
 const pause=deps.pause||(ms=>new Promise(resolve=>setTimeout(resolve,ms)));
 // Bound the daily batch and execution time; leave capacity for Auth emails on the free plan.
 // The database rechecks preferences, cooldowns and duplicates when claiming each message.
 for(const candidate of dailyCandidates(candidates)){
  if(now()-started>=40000)break;
  const {data:message,error:claimError}=await db.rpc('brains_engagement_claim',{p_user_id:candidate.user_id,p_campaign:candidate.campaign,p_occurrence_key:candidate.occurrence_key});
  if(claimError){failed++;console.error('engagement_claim_failed',claimError.code);continue}
  if(!message){skipped++;continue}
  if(message.user_id!==candidate.user_id||message.campaign!==candidate.campaign||!validRecipient(message.email)||message.email.trim().toLowerCase()!==candidate.email.trim().toLowerCase()){failed++;await db.rpc('brains_engagement_mark',{p_message_id:message.id,p_status:'failed'});console.error('engagement_recipient_rejected');continue}
  const sendStarted=now();
  const result=await (deps.sendMessage||sendEngagementMessage)(db,message);
  if(result.status==='sent')sent++;else failed++;
  if(result.status==='retryable')break;
  await pause(Math.max(0,600-(now()-sendStarted)));
 }
 return response(200,{enabled:true,candidates:(candidates||[]).length,sent,failed,skipped});
}
export async function GET(request){return handleCron(request)}


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
  const allowed=(deps.approvedRecipient||validRecipient)(user.email);
  if(!enabled||!allowed)return response(200,{enabled:false,sent:0});
  const {data:candidates,error}=await db.rpc('brains_engagement_candidates');
  if(error){console.error('engagement_welcome_candidates_failed',error.code);return response(503,{error:'database'});}
  const candidate=(candidates||[]).find(item=>item.user_id===user.id&&item.campaign==='welcome');
  if(!candidate)return response(200,{enabled:true,sent:0});
  const {data:message,error:claimError}=await db.rpc('brains_engagement_claim',{p_user_id:user.id,p_campaign:'welcome',p_occurrence_key:candidate.occurrence_key});
  if(claimError){console.error('engagement_welcome_claim_failed',claimError.code);return response(503,{error:'database'});}
  if(!message)return response(200,{enabled:true,sent:0});
  if(message.user_id!==user.id||message.campaign!=='welcome'||message.email?.trim().toLowerCase()!==user.email.trim().toLowerCase()||!(deps.approvedRecipient||validRecipient)(message.email)){
   await db.rpc('brains_engagement_mark',{p_message_id:message.id,p_status:'failed'});
   console.error('engagement_welcome_recipient_rejected');
   return response(403,{error:'recipientRejected'});
  }
  const result=await (deps.sendMessage||sendEngagementMessage)(db,message);
  return response(result.status==='sent'?200:503,{enabled:true,sent:result.status==='sent'?1:0});
 }catch(error){console.error('engagement_welcome_failed',error?.name||'unknown');return response(503,{error:'unavailable'})}
}
export async function POST(request){return handleWelcome(request)}
