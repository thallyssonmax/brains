export const paths = {landing:'/', login:'/login', home:'/home', areas:'/areas', settings:'/settings', oauthConsent:'/oauth/consent'} as const;
export const areaPath = (id:string) => `${paths.areas}/${encodeURIComponent(id)}`;
export function isAdminRoute(path:string){return /^\/admin(?:\/(?:users|funnel))?\/?$/.test(path)}
export function productRoute(pathname:string):{page:'home'|'decks'|'area'|'settings';areaId:string}|null {
 const path=pathname.replace(/\/+$/,'')||'/';
 if(path===paths.home)return {page:'home',areaId:''};
 if(path===paths.areas)return {page:'decks',areaId:''};
 if(path===paths.settings)return {page:'settings',areaId:''};
 const area=path.match(/^\/areas\/([^/]+)$/);
 if(area){try{return {page:'area',areaId:decodeURIComponent(area[1])}}catch{return null}}
 return null;
}
export function authCallback(search:string,hash:string){
 const query=new URLSearchParams(search),fragment=new URLSearchParams(hash.replace(/^#/,''));
 return query.get('auth')==='reset'||query.has('code')||query.has('error')||fragment.has('access_token')||fragment.has('error')||fragment.get('type')==='recovery';
}
export function authRedirect(origin:string,recovery=false){return new URL(paths.login+(recovery?'?auth=reset':''),origin).href}
export function consentDestination(search=''){
 const query=new URLSearchParams(search),id=query.get('authorization_id');
 return query.get('next')==='oauth'&&id&&/^[0-9a-f]{8}-[0-9a-f-]{27,40}$/i.test(id)?`${paths.oauthConsent}?authorization_id=${encodeURIComponent(id)}`:null;
}
export function loginDestination(search=''){return consentDestination(search)??(new URLSearchParams(search).get('next')==='admin'?'/admin':paths.home)}
export function accessRedirect(pathname:string,authenticated:boolean,recovery:boolean,search=''){
 if(recovery)return pathname===paths.login?null:paths.login+'?auth=reset';
 if(pathname===paths.login)return authenticated?loginDestination(search):null;
 if(!authenticated&&pathname===paths.oauthConsent){const id=new URLSearchParams(search).get('authorization_id');return id?`${paths.login}?next=oauth&authorization_id=${encodeURIComponent(id)}`:paths.login}
 if(!authenticated&&isAdminRoute(pathname))return paths.login+'?next=admin';
 return !authenticated&&productRoute(pathname)?paths.login:null;
}
