import {afterEach,beforeEach,describe,expect,it,vi} from 'vitest';
import {sendEngagementMessage} from './engagement-send.js';

const keys=['RESEND_API_KEY','EMAIL_UNSUBSCRIBE_SECRET'];
let previous;

beforeEach(()=>{
 previous=Object.fromEntries(keys.map(key=>[key,process.env[key]]));
 process.env.RESEND_API_KEY='test-resend-key';
 process.env.EMAIL_UNSUBSCRIBE_SECRET='test-unsubscribe-secret';
});
afterEach(()=>{
 for(const key of keys){if(previous[key]===undefined)delete process.env[key];else process.env[key]=previous[key]}
 vi.unstubAllGlobals();
});

const message={id:'message-123',user_id:'user-123',email:'heeybrains@gmail.com',first_name:'Teste',area_name:'English',campaign:'welcome'};
const json=(body,status=200)=>new Response(JSON.stringify(body),{status,headers:{'Content-Type':'application/json'}});
const database=()=>({rpc:vi.fn().mockResolvedValue({data:null,error:null})});

describe('sendEngagementMessage retry handling',()=>{
 it('marks a successful Resend response as sent and uses an idempotency key',async()=>{
  const db=database();
  const fetchMock=vi.fn().mockResolvedValue(json({id:'resend-123'}));
  vi.stubGlobal('fetch',fetchMock);
  expect(await sendEngagementMessage(db,message)).toEqual({status:'sent'});
  expect(fetchMock).toHaveBeenCalledOnce();
  const init=fetchMock.mock.calls[0][1];
  expect(init.headers['Idempotency-Key']).toBe('brains-message-123');
  expect(JSON.parse(init.body).to).toEqual([message.email]);
  expect(db.rpc).toHaveBeenCalledWith('brains_engagement_mark',{p_message_id:message.id,p_status:'sent',p_provider_id:'resend-123'});
 });

 it.each([
  ['rate limit',429,{message:'rate limited'},'retryable'],
  ['server error',503,{message:'temporarily unavailable'},'retryable'],
  ['gateway error',502,{message:'bad gateway'},'retryable'],
  ['successful response without provider id',200,{message:'malformed success'},'retryable'],
  ['permanent client error',400,{message:'invalid request'},'failed']
 ])('records %s as %s',async(_label,status,payload,expected)=>{
  const db=database();
  vi.stubGlobal('fetch',vi.fn().mockResolvedValue(json(payload,status)));
  expect(await sendEngagementMessage(db,message)).toEqual({status:expected});
  expect(db.rpc).toHaveBeenCalledWith('brains_engagement_mark',{p_message_id:message.id,p_status:expected});
 });

 it('marks a lost provider response as retryable without making a real request',async()=>{
  const db=database();
  vi.stubGlobal('fetch',vi.fn().mockRejectedValue(new TypeError('simulated network failure')));
  expect(await sendEngagementMessage(db,message)).toEqual({status:'retryable'});
  expect(db.rpc).toHaveBeenCalledWith('brains_engagement_mark',{p_message_id:message.id,p_status:'retryable'});
 });

 it('retries an idempotent send if persisting the sent status fails',async()=>{
  const db=database();
  db.rpc.mockResolvedValueOnce({data:null,error:{code:'temporary_database_error'}});
  vi.stubGlobal('fetch',vi.fn().mockResolvedValue(json({id:'resend-123'})));
  expect(await sendEngagementMessage(db,message)).toEqual({status:'retryable'});
  expect(db.rpc).toHaveBeenNthCalledWith(1,'brains_engagement_mark',{p_message_id:message.id,p_status:'sent',p_provider_id:'resend-123'});
  expect(db.rpc).toHaveBeenNthCalledWith(2,'brains_engagement_mark',{p_message_id:message.id,p_status:'retryable'});
 });

 it('does not call Resend when required credentials are missing',async()=>{
  delete process.env.RESEND_API_KEY;
  const db=database();
  const fetchMock=vi.fn();
  vi.stubGlobal('fetch',fetchMock);
  expect(await sendEngagementMessage(db,message)).toEqual({status:'configuration'});
  expect(fetchMock).not.toHaveBeenCalled();
 });
});
