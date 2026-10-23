export interface ChatGPTHandoff {v:1;front:string;back:string;createdAt:number;file?:{download_url:string;file_id:string;mime_type?:string};withoutImage?:boolean}
export function captureChatGPTHandoff(){
 const incoming=new URLSearchParams(window.location.hash.slice(1)).get('payload');
 if(incoming){const key=crypto.randomUUID();sessionStorage.setItem('brains-chatgpt-'+key,incoming);window.history.replaceState(window.history.state,'','/import/chatgpt?handoff='+key);return key}
 return new URLSearchParams(window.location.search).get('handoff')??'';
}
export function parseChatGPTHandoff(value:string,now=Date.now()):ChatGPTHandoff{
 if(!value||value.length>16000||!/^[A-Za-z0-9_-]+$/.test(value))throw Error('invalid_handoff');
 let data:unknown;try{const binary=atob(value.replaceAll('-','+').replaceAll('_','/'));data=JSON.parse(new TextDecoder().decode(Uint8Array.from(binary,c=>c.charCodeAt(0))))}catch{throw Error('invalid_handoff')}
 const p=data as Partial<ChatGPTHandoff>;
 if(p.v!==1||!Number.isFinite(p.createdAt)||p.createdAt!>now+60000||now-p.createdAt!>30*60000||typeof p.front!=='string'||typeof p.back!=='string'||!p.front.trim()||!p.back.trim()||p.front.length>200||p.back.length>800)throw Error('invalid_handoff');
 if(p.withoutImage!==true&&(!p.file||typeof p.file.download_url!=='string'||typeof p.file.file_id!=='string'))throw Error('invalid_handoff');
 return p as ChatGPTHandoff;
}
