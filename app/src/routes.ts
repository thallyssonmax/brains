export const paths = {landing:'/', login:'/login', home:'/home', areas:'/areas', settings:'/settings', oauthConsent:'/oauth/consent'} as const;
export const areaPath = (id:string) => paths.areas+'/'+encodeURIComponent(id);
const isUuid=(value:string)=>value.length===36&&value.split('').every((char,index)=>index===8||index===13||index===18||index===23?char==='-':'0123456789abcdefABCDEF'.includes(char));
export function isAdminRoute(path:string){const normalized=path.endsWith('/')?path.slice(0,-1):path;return ['/admin','/admin/users','/admin/funnel','/admin/activation'].includes(normalized)}
export function productRoute(pathname:string):{page:'home'|'decks'|'area'|'settings';areaId:string}|null {
 let path=pathname||'/';while(path.length>1&&path.endsWith('/'))path=path.slice(0,-1);
 if(path===paths.home)return {page:'home',areaId:''};
 if(path===paths.areas)return {page:'decks',areaId:''};
 if(path===paths.settings)return {page:'settings',areaId:''};
 if(path.startsWith('/areas/')){
  const encoded=path.slice('/areas/'.length);if(!encoded||encoded.includes('/'))return null;
  try{return {page:'area',areaId:decodeURIComponent(encoded)}}catch{return null}
 }
 return null;
}
function safeProductTarget(value:string|null){
 if(!value||!value.startsWith('/')||value.startsWith('//')||value.includes(String.fromCharCode(92)))return null;
 let parsed:URL;try{parsed=new URL(value,'https://www.heybrains.app')}catch{return null}
 if(parsed.origin!=='https://www.heybrains.app'||!productRoute(parsed.pathname))return null;
 const query=new URLSearchParams();
 const message=parsed.searchParams.get('email_message_id');
 if(message&&isUuid(message))query.set('email_message_id',message);
 const route=productRoute(parsed.pathname);
 if(parsed.searchParams.get('createArea')==='1'&&route?.page==='decks')query.set('createArea','1');
 if(parsed.searchParams.get('createCard')==='1'&&route?.page==='area')query.set('createCard','1');
 if(parsed.searchParams.get('review')==='1'&&route?.page==='home')query.set('review','1');
 const qs=query.toString();return parsed.pathname+(qs?'?'+qs:'');
}
export function returnDestination(search=''){return safeProductTarget(new URLSearchParams(search).get('next'))}
export function authCallback(search:string,hash:string){
 const query=new URLSearchParams(search),fragment=new URLSearchParams(hash.startsWith('#')?hash.slice(1):hash);
 return query.get('auth')==='reset'||query.has('code')||query.has('error')||fragment.has('access_token')||fragment.has('error')||fragment.get('type')==='recovery';
}
export function authRedirect(origin:string,recovery=false,returnTo?:string){
 const query=new URLSearchParams();if(recovery)query.set('auth','reset');else{const target=safeProductTarget(returnTo??null);if(target)query.set('next',target)}
 const qs=query.toString();return new URL(paths.login+(qs?'?'+qs:''),origin).href;
}
export function consentDestination(search=''){
 const query=new URLSearchParams(search),id=query.get('authorization_id');
 return query.get('next')==='oauth'&&id&&id.length>=35&&id.length<=40&&id.split('').every(char=>'0123456789abcdefABCDEF-'.includes(char))?paths.oauthConsent+'?authorization_id='+encodeURIComponent(id):null;
}
export function loginDestination(search=''){
 return consentDestination(search)??(new URLSearchParams(search).get('next')==='admin'?'/admin':returnDestination(search)??paths.home);
}
export function accessRedirect(pathname:string,authenticated:boolean,recovery:boolean,search=''){
 if(recovery)return pathname===paths.login?null:paths.login+'?auth=reset';
 if(pathname===paths.login)return authenticated?loginDestination(search):null;
 if(!authenticated&&pathname===paths.oauthConsent){const id=new URLSearchParams(search).get('authorization_id');return id?paths.login+'?next=oauth&authorization_id='+encodeURIComponent(id):paths.login}
 if(!authenticated&&isAdminRoute(pathname))return paths.login+'?next=admin';
 if(!authenticated&&productRoute(pathname)){const target=safeProductTarget(pathname+search)??paths.home;return paths.login+'?next='+encodeURIComponent(target)}
 return null;
}
