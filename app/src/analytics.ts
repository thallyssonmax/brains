// No query strings, emails, referrers, card contents or tokens are collected.
const key='brains-visitor-v1';
export const analyticsEnabled=!(import.meta as ImportMeta&{env:{DEV?:boolean}}).env.DEV;
let fallback=crypto.randomUUID();
export function visitorId(){try{let id=localStorage.getItem(key);if(!id||! /^[0-9a-f-]{36}$/i.test(id)){id=crypto.randomUUID();localStorage.setItem(key,id)}return id}catch{return fallback}}
export function resetVisitor(){fallback=crypto.randomUUID();try{localStorage.setItem(key,fallback)}catch{/* Storage is optional. */}}
export function trackedPath(path:string){return ['/','/login','/home','/areas','/settings'].includes(path)?path:path.startsWith('/areas/')?'/areas':null}
export function eventPayload(event:'page_view'|'login_completed',path:string){return {p_id:crypto.randomUUID(),p_anonymous_id:visitorId(),p_event:event,p_path:path}}

export function trackLanding(){
 if(!analyticsEnabled)return;
 const env=(import.meta as ImportMeta&{env:Record<string,string>}).env;
 const url=env.VITE_SUPABASE_URL,key=env.VITE_SUPABASE_PUBLISHABLE_KEY;
 if(!url||!key)return;
 void fetch(url+'/rest/v1/rpc/brains_track_event',{method:'POST',keepalive:true,headers:{apikey:key,'Content-Type':'application/json'},body:JSON.stringify(eventPayload('page_view','/'))}).catch(()=>{});
}
