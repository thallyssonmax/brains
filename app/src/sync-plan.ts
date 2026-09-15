/** Three-way reconciliation. Records must contain JSON data only; media uses immutable paths. */
export interface SyncRecord {id:string;[field:string]:unknown}
export interface SyncConflict<T> {id:string;base?:T;local?:T;remote?:T}
function canonical(value:unknown):string {
 if(Array.isArray(value))return '['+value.map(canonical).join(',')+']';
 if(value&&typeof value==='object')return '{'+Object.entries(value).filter(([,v])=>v!==undefined).sort(([a],[b])=>a.localeCompare(b)).map(([k,v])=>JSON.stringify(k)+':'+canonical(v)).join(',')+'}';
 return JSON.stringify(value)??'undefined';
}
export function reconcile<T extends SyncRecord>(base:T[],local:T[],remote:T[]){
 const map=(records:T[])=>{const m=new Map(records.map(r=>[r.id,r]));if(m.size!==records.length)throw Error('duplicateSyncId');return m};
 const b=map(base),l=map(local),r=map(remote);const merged:T[]=[],upload:T[]=[],conflicts:SyncConflict<T>[]=[];
 for(const id of new Set([...b.keys(),...l.keys(),...r.keys()])){
 const before=b.get(id),here=l.get(id),there=r.get(id);
 const same=(x:T|undefined,y:T|undefined)=>canonical(x)===canonical(y);
 if(same(here,there)){if(here)merged.push(here)}
 else if(same(here,before)){if(there)merged.push(there)}
 else if(same(there,before)&&here){merged.push(here);upload.push(here)}
 else conflicts.push({id,base:before,local:here,remote:there});
 }
 return {merged,upload,conflicts};
}
export function assertSyncOwner(boundOwner:string|undefined,sessionOwner:string){
 if(!sessionOwner||!boundOwner||boundOwner!==sessionOwner)throw Error('syncOwnerMismatch');
}
