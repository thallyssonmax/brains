import {it,expect} from 'vitest';
import {mediaPath,checkMediaPath} from './cloud-media';
const a='11111111-1111-4111-8111-111111111111',b='22222222-2222-4222-8222-222222222222';
it('deduplicates identical bytes within an account but isolates accounts',async()=>{const blob=new Blob(['test'],{type:'audio/webm'});const path=await mediaPath(a,blob);expect(await mediaPath(a,blob)).toBe(path);expect(await mediaPath(b,blob)).not.toBe(path);expect(()=>checkMediaPath(b,path)).toThrow();expect(()=>checkMediaPath(a,path)).not.toThrow()});
it('rejects unsupported files and invalid owner paths',async()=>{await expect(mediaPath(a,new Blob(['x'],{type:'text/html'}))).rejects.toThrow();await expect(mediaPath(a,new Blob([],{type:'audio/webm'}))).rejects.toThrow();expect(()=>checkMediaPath(a,a+'/../file')).toThrow()});
import {uploadMedia} from './cloud-media';
import {vi} from 'vitest';
import type {SupabaseClient} from '@supabase/supabase-js';
it('uploads a missing file when exists returns its documented 404',async()=>{const bucket={exists:vi.fn(async()=>({data:false,error:{status:404}})),upload:vi.fn(async()=>({error:null}))};const client={storage:{from:()=>bucket}} as unknown as SupabaseClient;await uploadMedia(client,a,new Blob(['new'],{type:'audio/webm'}));expect(bucket.upload).toHaveBeenCalledTimes(1)});
