import {afterEach,beforeEach,expect,it,vi} from 'vitest';
import {createHmac} from 'node:crypto';
import {handleWebhook} from '../api/resend-webhook.js';

const secret = 'whsec_' + Buffer.from('test-webhook-secret').toString('base64');
beforeEach(() => vi.stubEnv('RESEND_WEBHOOK_SECRET', secret));
afterEach(() => vi.unstubAllEnvs());

function request(data = {}, signatureValid = true) {
 const event = {type:'email.delivered',created_at:new Date().toISOString(),data:{email_id:'provider-id',...data}};
 const raw = JSON.stringify(event);
 const stamp = String(Math.floor(Date.now()/1000));
 const signature = createHmac('sha256',Buffer.from(secret.slice(6),'base64')).update(`event-id.${stamp}.${raw}`).digest('base64');
 return new Request('https://www.heybrains.app/api/resend-webhook',{
  method:'POST',body:raw,headers:{'svix-id':'event-id','svix-timestamp':stamp,'svix-signature':signatureValid ? `v1,${signature}` : 'v1,invalid'}
 });
}
const database = result => ({rpc:vi.fn().mockResolvedValue(result)});

it('acknowledges Auth SMTP events missing from the learning campaign table',async()=>{
 const db = database({data:false});
 const reply = await handleWebhook(request({subject:'Confirm your email address'}),{serviceClient:()=>db});
 expect(reply.status).toBe(200);
 expect(await reply.json()).toEqual({ok:true,ignored:true});
});
it.each([
 {tags:{brains_flow:'learning'}},
 {tags:[{name:'brains_flow',value:'learning'}]},
 {headers:[{name:'List-Unsubscribe',value:'<https://www.heybrains.app/api/email-unsubscribe?token=test>'}]}
])('retries a learning event that arrives before the provider ID is saved (%j)',async data=>{
 const db = database({data:false});
 expect((await handleWebhook(request(data),{serviceClient:()=>db})).status).toBe(503);
});
it('processes legacy learning messages already matched by provider ID',async()=>{
 const db = database({data:true});
 const reply = await handleWebhook(request(),{serviceClient:()=>db});
 expect(reply.status).toBe(200);
 expect(await reply.json()).toEqual({ok:true});
 expect(db.rpc).toHaveBeenCalledWith('brains_engagement_webhook',expect.objectContaining({p_provider_id:'provider-id',p_type:'email.delivered'}));
});
it('keeps database failures retryable even for an Auth event',async()=>{
 const db = database({error:{code:'57014'}});
 expect((await handleWebhook(request(),{serviceClient:()=>db})).status).toBe(503);
});
it('rejects invalid signatures before accessing the database',async()=>{
 const db = database({data:true});
 expect((await handleWebhook(request({},false),{serviceClient:()=>db})).status).toBe(401);
 expect(db.rpc).not.toHaveBeenCalled();
});
