import {boundedFetch} from './request';
import {createClient} from '@supabase/supabase-js';
export function validCloudConfig(url:string,key:string){
 try{return new URL(url).protocol==='https:'&&key.startsWith('sb_publishable_')&&key.length>20}catch{return false}
}
const env=(import.meta as ImportMeta&{env:Record<string,string>}).env;
const url=env.VITE_SUPABASE_URL??'',key=env.VITE_SUPABASE_PUBLISHABLE_KEY??'';
export const cloud=validCloudConfig(url,key)?createClient(url,key,{global:{fetch:boundedFetch},auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true}}):null;

export async function publicAuthSettings(){
 if(!cloud)throw Error('unavailable');
 const response=await boundedFetch(url+'/auth/v1/settings',{headers:{apikey:key}});
 if(!response.ok)throw Error('unavailable');
 return await response.json() as {disable_signup?:boolean;external?:{google?:boolean;email?:boolean}};
}
