import {serviceClient} from './engagement-cron.js';
import {verifySvix} from './engagement-security.js';

export async function POST(request){
 if(Number(request.headers.get('content-length')||0)>65536)return Response.json({error:'tooLarge'},{status:413});
 const raw=await request.text();if(raw.length>65536)return Response.json({error:'tooLarge'},{status:413});
 if(!verifySvix(raw,request.headers,process.env.RESEND_WEBHOOK_SECRET))return Response.json({error:'invalidSignature'},{status:401});
 let event;try{event=JSON.parse(raw)}catch{return Response.json({error:'invalidJson'},{status:400})}
 const id=request.headers.get('svix-id'),providerId=event?.data?.email_id,occurred=event?.created_at;
 if(!id||typeof providerId!=='string'||typeof event?.type!=='string'||!occurred||Number.isNaN(Date.parse(occurred)))return Response.json({error:'invalidEvent'},{status:400});
 const db=serviceClient();const {data,error}=await db.rpc('brains_engagement_webhook',{p_event_id:id,p_provider_id:providerId,p_type:event.type,p_at:occurred,p_url:typeof event.data?.click?.link==='string'?event.data.click.link:null});
 if(error){console.error('engagement_webhook_failed',error.code);return Response.json({error:'database'},{status:503})}
 if(data===false)return Response.json({error:'unknownMessage'},{status:503});
 return Response.json({ok:true});
}
