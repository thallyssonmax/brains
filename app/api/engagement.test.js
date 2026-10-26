import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createHmac} from 'node:crypto';
import {emailContent} from './engagement-content.js';
import {unsubscribeToken,verifyUnsubscribe,verifySvix} from './engagement-security.js';
import {GET as runCron,approvedTestRecipient} from './engagement-cron.js';

test('test sending accepts only the privately configured recipient',()=>{
 const previous=process.env.ENGAGEMENT_TEST_RECIPIENT;
 try{
  delete process.env.ENGAGEMENT_TEST_RECIPIENT;
  assert.equal(approvedTestRecipient('owner@example.test'),false);
  process.env.ENGAGEMENT_TEST_RECIPIENT='owner@example.test';
  assert.equal(approvedTestRecipient(' Owner@Example.Test '),true);
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
