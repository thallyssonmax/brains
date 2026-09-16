import {afterEach,expect,it,vi} from 'vitest';
import {boundedFetch} from './request';
afterEach(()=>{vi.unstubAllGlobals();vi.useRealTimers()});
it('aborts a stalled request instead of leaving the upload queue locked',async()=>{
 vi.useFakeTimers();vi.stubGlobal('fetch',vi.fn((_url,init)=>new Promise((_resolve,reject)=>{init.signal.addEventListener('abort',()=>reject(new DOMException('Aborted','AbortError')))})));
 const result=expect(boundedFetch('https://example.test')).rejects.toMatchObject({name:'AbortError'});
 await vi.advanceTimersByTimeAsync(45000);await result;
});
it('preserves caller cancellation',async()=>{
 const controller=new AbortController();controller.abort();
 vi.stubGlobal('fetch',vi.fn(async(_url,init)=>{expect(init.signal.aborted).toBe(true);throw new DOMException('Aborted','AbortError')}));
 await expect(boundedFetch('https://example.test',{signal:controller.signal})).rejects.toMatchObject({name:'AbortError'});
});
