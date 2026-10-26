import {emailContent} from './engagement-content.js';
import {unsubscribeToken} from './engagement-security.js';
export async function sendEngagementMessage(db,message){
 if(!process.env.RESEND_API_KEY||!process.env.EMAIL_UNSUBSCRIBE_SECRET)return {status:'configuration'};
 const expiry=Math.floor(Date.now()/1000)+90*86400;
 const token=unsubscribeToken(message.user_id,process.env.EMAIL_UNSUBSCRIBE_SECRET,expiry);
 const unsubscribeUrl='https://www.heybrains.app/api/email-unsubscribe?token='+encodeURIComponent(token);
 const content=emailContent(message,unsubscribeUrl);
 try{
  const provider=await fetch('https://api.resend.com/emails',{method:'POST',headers:{Authorization:'Bearer '+process.env.RESEND_API_KEY,'Content-Type':'application/json','Idempotency-Key':'brains-'+message.id},body:JSON.stringify({from:'Brains <no-reply@heybrains.app>',to:[message.email],subject:content.subject,html:content.html,text:content.text,headers:{'List-Unsubscribe':'<'+unsubscribeUrl+'>'}}),signal:AbortSignal.timeout(15000)});
  const payload=await provider.json().catch(()=>({}));
  if(!provider.ok||!payload.id){
   if(provider.status===429)await db.rpc('brains_engagement_mark',{p_message_id:message.id,p_status:'retryable'});
   else if(provider.status>=400&&provider.status<500)await db.rpc('brains_engagement_mark',{p_message_id:message.id,p_status:'failed'});
   console.error('engagement_provider_rejected',provider.status);
   return {status:'failed'};
  }
  const marked=await db.rpc('brains_engagement_mark',{p_message_id:message.id,p_status:'sent',p_provider_id:payload.id});
  if(marked.error){console.error('engagement_mark_failed',marked.error.code);return {status:'failed'}}
  return {status:'sent'};
 }catch(error){console.error('engagement_send_failed',error?.name||'unknown');return {status:'failed'}}
}
