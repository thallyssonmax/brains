import {useEffect} from 'react';
import {useLocation} from 'react-router-dom';
import {cloud} from './cloud';
import {analyticsEnabled,eventPayload,resetVisitor,trackedPath} from './analytics';
import {emailMessageFromSearch,rememberEmailMessage} from './email-attribution';

let queue=Promise.resolve();
let lastPage='';
let lastUser:string|null=null;
let loginRecorded=false;
function send(event:'page_view'|'login_completed',path:string){
 const payload=eventPayload(event,path);
 queue=queue.then(async()=>{try{const result=await cloud!.rpc('brains_track_event',payload);if(result.error?.message.includes('visitorChanged')){resetVisitor();await cloud!.rpc('brains_track_event',{...payload,p_anonymous_id:eventPayload(event,path).p_anonymous_id})}}catch{/* Analytics never blocks the product. */}});
}
export function AnalyticsTracker({userId,ready}:{userId:string|null;ready:boolean}){
 const location=useLocation();
 useEffect(()=>{
  if(!ready||!cloud||!analyticsEnabled)return;
  if(lastUser&&lastUser!==userId){resetVisitor();loginRecorded=false;lastPage=''}
  lastUser=userId;
  const path=trackedPath(location.pathname);
  // Queue the login view before its authenticated milestone, then Home.
  const pageKey=location.key+':'+path;
  if(path&&pageKey!==lastPage&&(userId||path==='/login')){lastPage=pageKey;send('page_view',path)}
  if(userId&&path==='/login'&&!loginRecorded){loginRecorded=true;send('login_completed','/login')}
  if(path!=='/login')loginRecorded=false;
 },[location.key,location.pathname,userId,ready]);
 useEffect(()=>{
  const messageId=emailMessageFromSearch(location.search),path=trackedPath(location.pathname);
  if(!ready||!userId||!cloud||!messageId||!path)return;
  let active=true;
  void cloud.rpc('brains_track_email_return',{p_message_id:messageId,p_path:path}).then(({error})=>{
   if(!active||error)return;
   try{rememberEmailMessage(messageId,window.sessionStorage)}catch{/* Session storage is optional. */}
   const url=new URL(window.location.href);url.searchParams.delete('email_message_id');
   window.history.replaceState(window.history.state,'',url.pathname+url.search+url.hash);
  }).catch(()=>{/* Attribution never blocks navigation. */});
  return()=>{active=false};
 },[location.key,location.pathname,location.search,userId,ready]);
 return null;
}
