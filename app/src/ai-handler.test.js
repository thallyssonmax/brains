import {beforeEach,afterEach,describe,it,expect,vi} from 'vitest';
import {createClient} from '@supabase/supabase-js';
import handler from '../api/ai.js';

vi.mock('@supabase/supabase-js',()=>({createClient:vi.fn()}));
const input={cardId:'5820477a-5b9a-44eb-aeab-5713b69d9b8e',kind:'sentence',front:'awesome',back:'',language:'en',vocabulary:['friend']};
function response(){return {statusCode:200,headers:{},setHeader(key,value){this.headers[key]=value},end(body){this.body=JSON.parse(body)}}}
const original={...process.env};
let rpc;

beforeEach(()=>{
 process.env.GEMINI_API_KEY='test-only';process.env.CLOUDFLARE_AI_TOKEN='test-only';process.env.CLOUDFLARE_ACCOUNT_ID='a'.repeat(32);process.env.VITE_SUPABASE_URL='https://example.supabase.co';process.env.VITE_SUPABASE_PUBLISHABLE_KEY='test-only';
 rpc=vi.fn(async name=>name==='ai_generation_claim'?{data:{id:input.cardId,remaining:2},error:null}:{data:null,error:null});
 vi.mocked(createClient).mockReturnValue({auth:{getUser:vi.fn(async()=>({data:{user:{id:'user'}},error:null}))},rpc});
});
afterEach(()=>{process.env=Object.assign(process.env,original);vi.unstubAllGlobals();vi.clearAllMocks()});

describe('AI generation handler',()=>{
 it('creates a sentence with Gemini after auth and records a successful claim',async()=>{
  const fetcher=vi.fn(async()=>({ok:true,json:async()=>({candidates:[{content:{parts:[{text:'My friend is awesome.'}]}}]})}));vi.stubGlobal('fetch',fetcher);
  const res=response();await handler({method:'POST',headers:{authorization:'Bearer session',host:'www.heybrains.app'},body:input},res);
  expect(res.statusCode).toBe(200);expect(res.body).toEqual({sentence:'My friend is awesome.',remaining:2});
  expect(fetcher.mock.calls[0][0]).toContain('gemini-2.5-flash-lite');
  expect(rpc).toHaveBeenCalledWith('ai_generation_finish',{p_id:input.cardId,p_success:true});
 });
 it('uses Cloudflare for images and returns a JPEG',async()=>{
  const fetcher=vi.fn(async()=>({ok:true,json:async()=>({success:true,result:{image:'aGVsbG8='}})}));vi.stubGlobal('fetch',fetcher);
  const res=response();await handler({method:'POST',headers:{authorization:'Bearer session',host:'www.heybrains.app'},body:{...input,kind:'image'}},res);
  expect(res.statusCode).toBe(200);expect(res.body).toEqual({image:'aGVsbG8=',mime:'image/jpeg',remaining:2});
  expect(fetcher.mock.calls[0][0]).toContain('flux-1-schnell');
 });
 it('refunds a provider failure and preserves a retry',async()=>{
  vi.stubGlobal('fetch',vi.fn(async()=>({ok:false,status:429})));
  const res=response();await handler({method:'POST',headers:{authorization:'Bearer session',host:'www.heybrains.app'},body:input},res);
  expect(res.statusCode).toBe(429);expect(res.body.error).toBe('providerLimit');
  expect(rpc).toHaveBeenCalledWith('ai_generation_finish',{p_id:input.cardId,p_success:false});
 });
});
