import type {SupabaseClient} from '@supabase/supabase-js';
export const MEDIA_BUCKET='brains-media';
export function checkMediaPath(userId:string,path:string){
 if(!userId||path.split('/').length!==2||path.split('/')[0]!==userId||!path.split('/')[1]||path.includes('..'))throw Error('mediaOwnerMismatch');
}
export async function mediaPath(userId:string,blob:Blob){
 if(!/^[a-f0-9-]{36}$/i.test(userId))throw Error('mediaOwnerMismatch');
 if(!blob.size||blob.size>5*1024*1024||! /^(image\/(jpeg|png|webp|gif)|audio\/[\w.+-]+)(;.*)?$/.test(blob.type))throw Error('invalidMedia');
 const hash=await crypto.subtle.digest('SHA-256',await blob.arrayBuffer());
 return userId+'/'+Array.from(new Uint8Array(hash),b=>b.toString(16).padStart(2,'0')).join('');
}
export async function uploadMedia(client:SupabaseClient,userId:string,blob:Blob){
 const path=await mediaPath(userId,blob);
 const bucket=client.storage.from(MEDIA_BUCKET);
 const {data:exists,error:lookupError}=await bucket.exists(path);
 if(lookupError&&!['400','404'].includes(String((lookupError as unknown as {status?:number}).status)))throw lookupError;
 if(!exists){const {error}=await bucket.upload(path,blob,{upsert:false,contentType:blob.type});if(error){const retry=await bucket.exists(path);if(retry.error||!retry.data)throw error}}
 return path;
}
export async function downloadMedia(client:SupabaseClient,userId:string,path:string){
 checkMediaPath(userId,path);
 const {data,error}=await client.storage.from(MEDIA_BUCKET).download(path);
 if(error)throw error;
 return data;
}
