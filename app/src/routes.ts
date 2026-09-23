export const paths = {landing:'/', login:'/login', home:'/home', areas:'/areas', settings:'/settings'} as const;
export const areaPath = (id:string) => `${paths.areas}/${encodeURIComponent(id)}`;
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
export function accessRedirect(pathname:string,authenticated:boolean,recovery:boolean){
 if(recovery)return pathname===paths.login?null:paths.login+'?auth=reset';
 if(pathname===paths.login)return authenticated?paths.home:null;
 return !authenticated&&productRoute(pathname)?paths.login:null;
}
