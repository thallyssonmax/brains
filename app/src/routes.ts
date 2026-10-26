export const paths = {landing:'/', login:'/login', home:'/home', areas:'/areas', settings:'/settings', oauthConsent:'/oauth/consent'} as const;
export const areaPath = (id:string) => \`\${paths.areas}/\${encodeURIComponent(id)}\`;
export function isAdminRoute(path:string){return /^\\/admin(?:\\/(?:users|funnel|activation))?\\/?$/.test(path)}
export function productRoute(pathname:string):{page:'home'|'decks'|'area'|'settings';areaId:string}|null {
 const path=pathname.replace(/\\/+$/,'')||'/';
 if(path===paths.home)return {page:'home',areaId:''};
 if(path===paths.areas)return {page:'decks',areaId:''};
 if(path===paths.settings)return {page:'settings',areaId:''};
 const area=path.match(/^\\/areas\\/([^/]+)$/);
 if(area){try{return {page:'area',areaId:decodeURIComponent(area[1])}}catch{return null}}
 return null;
}
function safeProductTarget(value:string|null){
 if(!value||!value.startsWith('/')||value.startsWith('//')||value.includes('\\\\'))return null;
 let parsed:URL;try{parsed=new URL(value,'https://www.heybrains.app')}catch{return null}
 if(parsed.origin!=='https://www.heybrains.app'||!productRoute(parsed.pathname))return null;
 const query=new URLSearchParams();
 const message=parsed.searchParams.get('email_message_id');
 if(message&&/^[0-9a-f-]{36}$/i.test(message))query.set('email_message_id',message);
 const route=productRoute(parsed.pathname);
 if(parsed.searchParams.get('createArea')==='1'&&route?.page==='decks')query.set('createArea','1');
 if(parsed.searchParams.get('createCard')==='1'&&route?.page==='area')query.set('createCard','1');
 if(parsed.searchParams.get('review')==='1'&&route?.page==='home')query.set('review','1');
 return parsed.pathname+(query.size?'?'+query.toString():'');
}
export function returnDestination(search=''){return safeProductTarget(new URLSearchParams(search).get('next'))}
export function authCallback(search:string,hash:string){
 const query=new URLSearchParams(search),fragment=new URLSearchParams(hash.replace(/^#/,''));return query.get('auth')==='reset'||query.has('code')||query.has('error')||fragment.has('access_token')||fragment.has('error')||fragment.get('type')==='recovery';
}
export function authRedirect(origin:string,recovery=false,returnTo?:string){const query=new URLSearchParams();if(recovery)query.set('auth','reset');else{const target=safeProductTarget(returnTo??null);if(target)query.set('next',target)}return new URL(paths.login+(query.size?'?'+query.toString():''),origin).href}
export function consentDestination(search=''){
 const query=new URLSearchParams(search),id=query.get('authorization_id');
 return query.get('next')==='oauth'&&id&&/^[0-9a-f]{8}-[0-9a-f-]{27,40}$/i.test(id)?\`\${paths.oauthConsent}?authorization_id=\${encodeURIComponent(id)}\`:null;
}
export function loginDestination(search=''){return consentDestination(search)??(new URLSearchParams(search).get('next')==='admin'?'/admin':returnDestination(search)??paths.home)}
export function accessRedirect(pathname:string,authenticated:boolean,recovery:boolean,search=''){
 if(recovery)return pathname===paths.login?null:paths.login+'?auth=reset';
 if(pathname===paths.login)return authenticated?loginDestination(search):null;
 if(!authenticated&&pathname===paths.oauthConsent){const id=new URLSearchParams(search).get('authorization_id');return id?\`\${paths.login}?next=oauth&authorization_id=\${encodeURIComponent(id)}\`:paths.login}
 if(!authenticated&&isAdminRoute(pathname))return paths.login+'?next=admin';
 if(!authenticated&&productRoute(pathname)){const target=safeProductTarget(pathname+search)??paths.home;return paths.login+'?next='+encodeURIComponent(target)}
 return null;
}
