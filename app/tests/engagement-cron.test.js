import {afterEach,beforeEach,expect,it,vi} from 'vitest';
import {dailyCandidates,engagementSendingEnabled,handleCron,handleWelcome} from '../api/engagement-cron.js';
beforeEach(()=>{
 vi.stubEnv('CRON_SECRET','test-secret');vi.stubEnv('ENGAGEMENT_ENABLED','true');
 vi.stubEnv('ENGAGEMENT_RELEASE_APPROVED','true');vi.stubEnv('RESEND_API_KEY','fake');vi.stubEnv('EMAIL_UNSUBSCRIBE_SECRET','fake');
});
afterEach(()=>vi.unstubAllEnvs());
const candidate=(n,campaign='review_pending')=>({user_id:'user-'+n,email:'person'+n+'@example.test',campaign,occurrence_key:'test'});
const request=()=>new Request('https://www.heybrains.app/api/engagement-cron',{headers:{authorization:'Bearer test-secret'}});
function setup(candidates,claim){
 const sendMessage=vi.fn(async()=>({status:'sent'}));
 const db={rpc:vi.fn(async(name,args)=>{
  if(name==='brains_engagement_candidates')return {data:candidates};
  if(name==='brains_engagement_mark')return {};
  const item=candidates.find(c=>c.user_id===args.p_user_id&&c.campaign===args.p_campaign);
  return {data:claim?claim(item):{...item,id:'message-'+item.user_id}};
 })};
 return {sendMessage,deps:{serviceClient:()=>db,sendMessage,pause:async()=>{}}};
}
it('enables all accounts only while both operational switches are on',()=>{
 expect(engagementSendingEnabled()).toBe(true);
 vi.stubEnv('ENGAGEMENT_TEST_RECIPIENT','');expect(engagementSendingEnabled()).toBe(true);
 vi.stubEnv('ENGAGEMENT_ENABLED','false');expect(engagementSendingEnabled()).toBe(false);
 vi.stubEnv('ENGAGEMENT_ENABLED','true');vi.stubEnv('ENGAGEMENT_RELEASE_APPROVED','false');expect(engagementSendingEnabled()).toBe(false);
});
it('preserves priority and selects one message per user and address, up to 50',()=>{
 const a=candidate(1),b=candidate(2);
 expect(dailyCandidates([a,{...a,campaign:'welcome'},b,{...candidate(3),email:b.email},candidate(4)])).toEqual([a,b,candidate(4)]);
 expect(dailyCandidates(Array.from({length:60},(_,i)=>candidate(i)))).toHaveLength(50);
});
it('cron sends to eligible accounts outside the former pilots',async()=>{
 const {deps,sendMessage}=setup([candidate(1),candidate(2)]);
 expect(await (await handleCron(request(),deps)).json()).toMatchObject({enabled:true,sent:2,failed:0});
 expect(sendMessage).toHaveBeenCalledTimes(2);
});
it('skips a claim rejected after opt-out or loss of eligibility',async()=>{
 const {deps,sendMessage}=setup([candidate(1)],()=>null);
 expect(await (await handleCron(request(),deps)).json()).toMatchObject({sent:0,skipped:1});
 expect(sendMessage).not.toHaveBeenCalled();
});
it('rejects mismatched recipients returned by a claim',async()=>{
 const {deps,sendMessage}=setup([candidate(1)],c=>({...c,id:'m',email:'wrong@example.test'}));
 expect(await (await handleCron(request(),deps)).json()).toMatchObject({sent:0,failed:1});
 expect(sendMessage).not.toHaveBeenCalled();
});
it('stops on a transient provider failure instead of hammering remaining accounts',async()=>{
 const {deps,sendMessage}=setup([candidate(1),candidate(2)]);sendMessage.mockResolvedValue({status:'retryable'});
 expect(await (await handleCron(request(),deps)).json()).toMatchObject({sent:0,failed:1});
 expect(sendMessage).toHaveBeenCalledTimes(1);
});
it('leaves unclaimed candidates for the next run before function timeout',async()=>{
 const {deps,sendMessage}=setup([candidate(1),candidate(2)]);let time=0;
 deps.now=()=>time;sendMessage.mockImplementation(async()=>{time+=41000;return {status:'sent'}});
 expect(await (await handleCron(request(),deps)).json()).toMatchObject({sent:1});
 expect(sendMessage).toHaveBeenCalledTimes(1);
});
it('welcome accepts a confirmed eligible account outside the former pilots',async()=>{
 const user={id:'user-1',email:'person1@example.test',email_confirmed_at:new Date().toISOString()};
 const {deps,sendMessage}=setup([candidate(1,'welcome')]);
 const reply=await handleWelcome(new Request('https://www.heybrains.app/api/engagement-cron',{method:'POST',headers:{authorization:'Bearer confirmed-session-token'}}),{...deps,verifyUser:async()=>({data:{user}})});
 expect(await reply.json()).toEqual({enabled:true,sent:1});expect(sendMessage).toHaveBeenCalledTimes(1);
});
