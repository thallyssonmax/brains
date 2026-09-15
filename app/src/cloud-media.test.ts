import {it,expect} from 'vitest';
import {mediaPath,checkMediaPath} from './cloud-media';
const a='11111111-1111-4111-8111-111111111111',b='22222222-2222-4222-8222-222222222222';
it('deduplicates identical bytes within an account but isolates accounts',async()=>{const blob=new Blob(['test'],{type:'audio/webm'});const path=await mediaPath(a,blob);expect(await mediaPath(a,blob)).toBe(path);expect(await mediaPath(b,blob)).not.toBe(path);expect(()=>checkMediaPath(b,path)).toThrow();expect(()=>checkMediaPath(a,path)).not.toThrow()});
it('rejects unsupported files and invalid owner paths',async()=>{await expect(mediaPath(a,new Blob(['x'],{type:'text/html'}))).rejects.toThrow();await expect(mediaPath(a,new Blob([],{type:'audio/webm'}))).rejects.toThrow();expect(()=>checkMediaPath(a,a+'/../file')).toThrow()});
import {uploadMedia} from './cloud-media';
import {vi} from 'vitest';
import type {SupabaseClient} from '@supabase/supabase-js';
it('uploads a missing file when exists returns its documented 404',async()=>{const bucket={exists:vi.fn(async()=>({data:false,error:{status:404}})),upload:vi.fn(async()=>({error:null}))};const client={storage:{from:()=>bucket}} as unknown as SupabaseClient;await uploadMedia(client,a,new Blob(['new'],{type:'audio/webm'}));expect(bucket.upload).toHaveBeenCalledTimes(1)});

it('sends iPhone audio with a normalized MIME type and never requires HEAD',async()=>{const bucket={upload:vi.fn(async()=>({error:null})),download:vi.fn()};const client={storage:{from:()=>bucket}} as unknown as SupabaseClient;const blob=new Blob(['iphone'],{type:'audio/mp4;codecs=mp4a.40.2'});await uploadMedia(client,a,blob);expect(bucket.upload.mock.calls[0]).toEqual([await mediaPath(a,blob),blob,{upsert:false,contentType:'audio/mp4'}]);expect(bucket.download).not.toHaveBeenCalled()});
it('accepts an already uploaded immutable file but rejects a failed upload without a matching file',async()=>{const blob=new Blob(['retry'],{type:'audio/mp4'});const error={status:409};const bucket={upload:vi.fn(async()=>({error})),download:vi.fn(async()=>({error:null,data:blob}))};const client={storage:{from:()=>bucket}} as unknown as SupabaseClient;expect(await uploadMedia(client,a,blob)).toBe(await mediaPath(a,blob));bucket.download.mockResolvedValue({error:null,data:new Blob(['different'],{type:'audio/mp4'})});await expect(uploadMedia(client,a,blob)).rejects.toThrow('mediaUpload:409:audio/mp4')});

