const storageKey='brains-email-attribution-v1';
const isUuid=(value:string)=>value.length===36&&value.split('').every((char,index)=>index===8||index===13||index===18||index===23?char==='-':'0123456789abcdefABCDEF'.includes(char));
type StorageLike={getItem:(key:string)=>string|null;setItem:(key:string,value:string)=>void;removeItem?:(key:string)=>void};
export function emailMessageFromSearch(search:string){const value=new URLSearchParams(search).get('email_message_id');return value&&isUuid(value)?value:null}
export function rememberEmailMessage(id:string,storage:StorageLike,now=Date.now()){
 if(!isUuid(id))return false;
 try{storage.setItem(storageKey,JSON.stringify({id,expiresAt:now+7*24*60*60*1000}));return true}catch{return false}
}
export function currentEmailMessage(storage:StorageLike,now=Date.now()){
 try{const value=storage.getItem(storageKey);if(!value)return null;const record=JSON.parse(value) as {id?:unknown;expiresAt?:unknown};if(typeof record.id!=='string'||!isUuid(record.id)||typeof record.expiresAt!=='number'||record.expiresAt<=now){storage.removeItem?.(storageKey);return null}return record.id}catch{return null}
}
export function clearEmailMessage(storage:StorageLike){try{storage.removeItem?.(storageKey)}catch{/* Session storage is optional. */}}
export async function recordEmailConversion(stage:'area'|'card'|'review'|'session',rpc:(args:{p_message_id:string;p_stage:string})=>PromiseLike<{error?:unknown}>,storage:StorageLike){
 const id=currentEmailMessage(storage);if(!id)return;
 try{await rpc({p_message_id:id,p_stage:stage})}catch{/* Attribution never blocks the study flow. */}
}
