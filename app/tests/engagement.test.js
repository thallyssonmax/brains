import {test} from 'vitest';
import assert from 'node:assert/strict';
import {createHash,createHmac} from 'node:crypto';
import {emailContent} from '../api/engagement-content.js';
import {unsubscribeToken,verifyUnsubscribe,verifySvix} from '../api/engagement-security.js';
import {GET as runCron,POST as handleWelcome,approvedTestRecipient} from '../api/engagement-cron.js';


test('test sending accepts only the privately configured recipient',()=>{
 const previous=process.env.ENGAGEMENT_TEST_RECIPIENT;
 try{
  delete process.env.ENGAGEMENT_TEST_RECIPIENT;
  assert.equal(approvedTestRecipient('owner@example.test'),false);
  process.env.ENGAGEMENT_TEST_RECIPIENT='owner@example.test';
  const testDigest=createHash('sha256').update('owner@example.test').digest('hex');
  assert.equal(approvedTestRecipient(' Owner@Example.Test ',testDigest),true);
  assert.equal(approvedTestRecipient('owner@example.test'),false);
  assert.equal(approvedTestRecipient('other@example.test'),false);
  assert.equal(approvedTestRecipient('owner@example.test.evil.test'),false);
  assert.equal(approvedTestRecipient(null),false);
 }finally{if(previous===undefined)delete process.env.ENGAGEMENT_TEST_RECIPIENT;else process.env.ENGAGEMENT_TEST_RECIPIENT=previous}
});

test('unsubscribe tokens are signed and expire',()=>{
 const userId='11111111-1111-1111-1111-111111111111';
 const token=unsubscribeToken(userId,'private-test-secret',Math.floor(Date.now()/1000)+60);
 assert.equal(verifyUnsubscribe(token,'private-test-secret'),userId);
 assert.equal(verifyUnsubscribe(token,'another-secret'),null);
 assert.equal(verifyUnsubscribe(unsubscribeToken(userId,'private-test-secret',1),'private-test-secret'),null);
});
test('Resend signature uses the exact raw body and a fresh timestamp',()=>{
 const secret='whsec_'+Buffer.from('test-secret-32-bytes-test-secret!!').toString('base64');
 const raw='{"type":"email.opened"}',id='msg_test',stamp=String(Math.floor(Date.now()/1000));
 const signature=createHmac('sha256',Buffer.from(secret.slice(6),'base64')).update(`${id}.${stamp}.${raw}`).digest('base64');
 const headers=new Headers({'svix-id':id,'svix-timestamp':stamp,'svix-signature':`v1,${signature}`});
 assert.equal(verifySvix(raw,headers,secret),true);
 assert.equal(verifySvix(raw+' ',headers,secret),false);
 assert.equal(verifySvix(raw,headers,secret,Date.now()+3600000),false);
});
test('engagement email escapes user text and includes opt-out',()=>{
 const email=emailContent({campaign:'welcome',first_name:'Ana',area_name:'<script>'},'https://www.heybrains.app/unsubscribe');
 assert.equal(email.html.includes('<script>'),false);
 assert.equal(email.html.includes('&lt;script&gt;'),true);
 assert.equal(email.text.includes('Descadastrar')||email.text.includes('parar de receber'),true);
});
test('cron refuses unauthenticated calls and stays off by default',async()=>{
 const previous=process.env.CRON_SECRET,enabled=process.env.ENGAGEMENT_ENABLED,approved=process.env.ENGAGEMENT_RELEASE_APPROVED;
 try{
  process.env.CRON_SECRET='test-secret';process.env.ENGAGEMENT_ENABLED='true';process.env.ENGAGEMENT_RELEASE_APPROVED='true';
  assert.equal((await runCron(new Request('https://www.heybrains.app/api/engagement-cron'))).status,401);
  const reply=await runCron(new Request('https://www.heybrains.app/api/engagement-cron',{headers:{Authorization:'Bearer test-secret'}}));
  assert.deepEqual(await reply.json(),{enabled:false,sent:0});
 }finally{if(previous===undefined)delete process.env.CRON_SECRET;else process.env.CRON_SECRET=previous;if(enabled===undefined)delete process.env.ENGAGEMENT_ENABLED;else process.env.ENGAGEMENT_ENABLED=enabled;if(approved===undefined)delete process.env.ENGAGEMENT_RELEASE_APPROVED;else process.env.ENGAGEMENT_RELEASE_APPROVED=approved}
});


test('welcome is tied to confirmation and links to Today with explicit attribution',()=>{
 const messageId='f0837cd4-1111-4444-9999-ffeabcabcdef';
 const message=emailContent({id:messageId,campaign:'welcome',first_name:'Ana'},'https://www.heybrains.app/unsubscribe');
 assert.match(message.subject,/Bem-vindo ao Brains/);
 assert.match(message.preheader,/Crie sua área/);
 assert.match(message.url,/\/home\?email_message_id=/);
 assert.match(message.html,/Sua conta está confirmada/);
 assert.doesNotMatch(message.url,/\/areas/);
});
test('first-area CTA opens the existing create-area action',()=>{
 const message=emailContent({id:'f0837cd4-1111-4444-9999-ffeabcabcdef',campaign:'first_area_48h',first_name:'Ana'},'https://www.heybrains.app/unsubscribe');
 assert.match(message.subject,/cantinho de estudos/);
 assert.match(message.url,/\/areas\?createArea=1&email_message_id=/);
});
test('first-card and review CTAs carry the relevant in-app action and area',()=>{
 const id='f0837cd4-1111-4444-9999-ffeabcabcdef';
 const card=emailContent({id,campaign:'first_card_72h',first_name:'Ana',area_id:id},'https://www.heybrains.app/unsubscribe');
 assert.match(card.url,new RegExp('/areas/'+id+'\\?createCard=1&email_message_id='));
 const review=emailContent({id,campaign:'review_pending',first_name:'Ana',pending_count:2},'https://www.heybrains.app/unsubscribe');
 assert.match(review.url,/\/home\?review=1&email_message_id=/);
});

test('immediate welcome requires a confirmed authenticated session',async()=>{
 let serviceCalls=0;
 const reply=await handleWelcome(new Request('https://www.heybrains.app/api/engagement-cron',{method:'POST'}),{serviceClient:()=>{serviceCalls++;return {}}});
 assert.equal(reply.status,401);
 assert.equal(serviceCalls,0);
});
test('immediate welcome claims only the signed-in account and is idempotent',async()=>{
 const user={id:'11111111-1111-1111-1111-111111111111',email:'test@example.test',email_confirmed_at:new Date().toISOString()};
 let claimed=false,sends=0;
 const db={rpc:async(name,args)=>{
  if(name==='brains_engagement_candidates')return {data:[{user_id:user.id,campaign:'welcome',occurrence_key:'signup-confirmed'},{user_id:'22222222-2222-2222-2222-222222222222',campaign:'welcome'}],error:null};
  if(name==='brains_engagement_claim'){assert.equal(args.p_user_id,user.id);assert.equal(args.p_campaign,'welcome');if(claimed)return {data:null,error:null};claimed=true;return {data:{id:'33333333-3333-3333-3333-333333333333',user_id:user.id,email:user.email,campaign:'welcome'},error:null}}
  throw Error('unexpectedRpc');
 }};
 const deps={serviceClient:()=>db,verifyUser:async()=>({data:{user},error:null}),enabled:()=>true,approvedRecipient:()=>true,sendMessage:async()=>{sends++;return {status:'sent'}}};
 const request=()=>new Request('https://www.heybrains.app/api/engagement-cron',{method:'POST',headers:{Authorization:'Bearer verified-access-token-value'}});
 assert.deepEqual(await (await handleWelcome(request(),deps)).json(),{enabled:true,sent:1});
 assert.deepEqual(await (await handleWelcome(request(),deps)).json(),{enabled:true,sent:0});
 assert.equal(sends,1);
});
test('immediate welcome never sends outside the authorized recipient',async()=>{
 let rpcCalls=0,sends=0;
 const db={rpc:async()=>{rpcCalls++;return {data:[],error:null}}};
 const reply=await handleWelcome(new Request('https://www.heybrains.app/api/engagement-cron',{method:'POST',headers:{Authorization:'Bearer verified-access-token-value'}}),{
  serviceClient:()=>db,verifyUser:async()=>({data:{user:{id:'11111111-1111-1111-1111-111111111111',email:'other@example.test',email_confirmed_at:new Date().toISOString()}},error:null}),
  enabled:()=>true,approvedRecipient:()=>false,sendMessage:async()=>{sends++;return {status:'sent'}}
 });
 assert.deepEqual(await reply.json(),{enabled:false,sent:0});
 assert.equal(rpcCalls,0);
 assert.equal(sends,0);
});
