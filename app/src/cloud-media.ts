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
 // Do not preflight with HEAD: Safari/Storage may hide the missing-file status.
 const contentType=blob.type.split(';')[0].trim();
 const {error}=await bucket.upload(path,blob,{upsert:false,contentType});
 if(error){
  // A retry can find an immutable object from a prior successful upload.
  const existing=await bucket.download(path);
  if(existing.error||!existing.data||await mediaPath(userId,existing.data)!==path)throw error;
 }

 return path;
}
export async function downloadMedia(client:SupabaseClient,userId:string,path:string){
 checkMediaPath(userId,path);
 const {data,error}=await client.storage.from(MEDIA_BUCKET).download(path);
 if(error)throw error;
 return data;
}

