import {engagementSendingEnabled,approvedTestRecipient,serviceClient} from './engagement-cron.js';
import {sendEngagementMessage} from './engagement-send.js';
const response=(status,body)=>Response.json(body,{status,headers:{'Cache-Control':'no-store'}});
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
