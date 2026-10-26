import {createClient} from '@supabase/supabase-js';
import {createHash} from 'node:crypto';
import {emailContent} from './engagement-content.js';
import {equalSecret,unsubscribeToken} from './engagement-security.js';

const response=(status,body)=>Response.json(body,{status,headers:{'Cache-Control':'no-store'}});
// The owner authorized a test for one account. General release remains locked.
export const ENGAGEMENT_RELEASE_UNLOCKED=false;
export const ENGAGEMENT_TEST_RELEASE_UNLOCKED=true;
const TEST_RECIPIENT_SHA256='a01b27204b7093a8c41416d9ed64d519c5a6994382880f93628a8ca2ca5c40b3';
export const approvedTestRecipient=(email,allowedDigest=TEST_RECIPIENT_SHA256)=>typeof email==='string'&&typeof process.env.ENGAGEMENT_TEST_RECIPIENT==='string'&&process.env.ENGAGEMENT_TEST_RECIPIENT.trim()!==''&&email.trim().toLowerCase()===process.env.ENGAGEMENT_TEST_RECIPIENT.trim().toLowerCase()&&createHash('sha256').update(email.trim().toLowerCase()).digest('hex')===allowedDigest;
export function serviceClient(){const url=process.env.SUPABASE_URL||process.env.VITE_SUPABASE_URL,key=process.env.SUPABASE_SERVICE_ROLE_KEY;if(!url||!key)throw Error('serviceConfigurationMissing');return createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false}})}

export async function GET(request){
 if(!equalSecret(request.headers.get('authorization'),`Bearer ${process.env.CRON_SECRET||''}`)||!process.env.CRON_SECRET)return response(401,{error:'unauthorized'});
 if(!ENGAGEMENT_TEST_RELEASE_UNLOCKED||process.env.ENGAGEMENT_ENABLED!=='true'||process.env.ENGAGEMENT_RELEASE_APPROVED!=='true'||!approvedTestRecipient(process.env.ENGAGEMENT_TEST_RECIPIENT))return response(200,{enabled:false,sent:0});
 if(!process.env.RESEND_API_KEY||!process.env.EMAIL_UNSUBSCRIBE_SECRET)return response(503,{error:'emailConfigurationMissing'});
 const db=serviceClient();const {data:candidates,error}=await db.rpc('brains_engagement_candidates');
 if(error){console.error('engagement_candidates_failed',error.code);return response(503,{error:'database'});}
 let sent=0,failed=0,skipped=0;
 // The Hobby cron runs daily. Keep well below Resend's free daily quota, shared with Auth mail.
 for(const candidate of (candidates||[]).filter(candidate=>approvedTestRecipient(candidate.email)).slice(0,1)){
  if(!approvedTestRecipient(candidate.email)){skipped++;continue}
  const {data:message,error:claimError}=await db.rpc('brains_engagement_claim',{p_user_id:candidate.user_id,p_campaign:candidate.campaign,p_occurrence_key:candidate.occurrence_key});
  if(claimError){failed++;console.error('engagement_claim_failed',claimError.code);continue}
  if(!message){skipped++;continue}
  if(!approvedTestRecipient(message.email)){failed++;await db.rpc('brains_engagement_mark',{p_message_id:message.id,p_status:'failed'});console.error('engagement_recipient_rejected');continue}
  const expiry=Math.floor(Date.now()/1000)+90*86400;
  const token=unsubscribeToken(message.user_id,process.env.EMAIL_UNSUBSCRIBE_SECRET,expiry);
  const unsubscribeUrl=`https://www.heybrains.app/api/email-unsubscribe?token=${encodeURIComponent(token)}`;
  const content=emailContent(message,unsubscribeUrl);
  try{
   const provider=await fetch('https://api.resend.com/emails',{method:'POST',headers:{Authorization:`Bearer ${process.env.RESEND_API_KEY}`,'Content-Type':'application/json','Idempotency-Key':`brains-${message.id}`},body:JSON.stringify({from:'Brains <no-reply@heybrains.app>',to:[message.email],subject:content.subject,html:content.html,text:content.text,headers:{'List-Unsubscribe':`<${unsubscribeUrl}>`}}),signal:AbortSignal.timeout(15000)});
   const payload=await provider.json().catch(()=>({}));
   if(!provider.ok||!payload.id){failed++;if(provider.status===429)await db.rpc('brains_engagement_mark',{p_message_id:message.id,p_status:'retryable'});else if(provider.status>=400&&provider.status<500)await db.rpc('brains_engagement_mark',{p_message_id:message.id,p_status:'failed'});console.error('engagement_provider_rejected',provider.status);continue}
   const marked=await db.rpc('brains_engagement_mark',{p_message_id:message.id,p_status:'sent',p_provider_id:payload.id});
   if(marked.error){failed++;console.error('engagement_mark_failed',marked.error.code);continue}
   sent++;
  }catch(error){failed++;console.error('engagement_send_failed',error?.name||'unknown')}
 }
 return response(200,{enabled:true,candidates:(candidates||[]).length,sent,failed,skipped});
}

