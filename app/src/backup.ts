import type {Library,Draft} from './model';
export interface Snapshot {library:Library;drafts:Draft[]}
const date=(x:unknown)=>typeof x==='string'&&!Number.isNaN(Date.parse(x));
function assert(ok:unknown):asserts ok {if(!ok)throw Error('Invalid backup')}
async function encode(value:any):Promise<any>{
 if(value instanceof Blob){const bytes=new Uint8Array(await value.arrayBuffer());let binary='';for(let i=0;i<bytes.length;i+=8192)binary+=String.fromCharCode(...bytes.subarray(i,i+8192));return {$blob:btoa(binary),type:value.type}}
 if(value instanceof Date)return value.toISOString();
 if(Array.isArray(value))return Promise.all(value.map(encode));
 if(value&&typeof value==='object'){const result:Record<string,unknown>={};for(const [k,v]of Object.entries(value))result[k]=await encode(v);return result}return value;
}
function decode(value:any):any{
 if(value&&typeof value==='object'&&'$blob'in value){assert(typeof value.$blob==='string'&&value.$blob.length<=7_000_000&&typeof value.type==='string'&&/^(image\/(png|jpeg|gif|webp)|audio\/)/.test(value.type));const raw=atob(value.$blob);assert(raw.length<=5*1024*1024);return new Blob([Uint8Array.from(raw,c=>c.charCodeAt(0))],{type:value.type})}
 if(Array.isArray(value))return value.map(decode);
 if(value&&typeof value==='object'){const out:Record<string,unknown>={};for(const [k,v]of Object.entries(value)){assert(!['__proto__','constructor','prototype'].includes(k));out[k]=decode(v)}return out}return value;
}
export async function exportBackup(snapshot:Snapshot){return new Blob([JSON.stringify({format:'brains-backup',version:1,createdAt:new Date().toISOString(),data:await encode(snapshot)})],{type:'application/json'})}
export async function importBackup(file:Blob):Promise<Snapshot>{
 assert(file.size<=100*1024*1024);const raw=JSON.parse(await file.text());assert(raw.format==='brains-backup'&&raw.version===1);const s=decode(raw.data) as Snapshot;const db=s?.library;
 assert(db&&db.schema===1&&db.structureVersion===2&&Number.isInteger(db.revision)&&db.revision>=0);
 for(const list of [db.areas,db.decks,db.cards,s.drafts,db.reviews??[]]){assert(Array.isArray(list));assert(new Set(list.map(x=>x.id)).size===list.length);for(const x of list)assert(x&&typeof x.id==='string'&&x.id.length>0)}
 const p=db.preferences;assert(p&&['pt','en','es'].includes(p.locale)&&Number.isInteger(p.goal)&&p.goal>0&&p.goal<=999&&Number.isInteger(p.newLimit)&&p.newLimit>=0&&p.newLimit<=999);new Intl.DateTimeFormat('en',{timeZone:p.timezone}).format();
 for(const item of [...db.areas,...db.decks,...db.cards])assert(typeof item.archived==='boolean'&&typeof item.deleted==='boolean');
 for(const a of db.areas)assert(typeof a.name==='string');
 for(const d of db.decks)assert(typeof d.name==='string'&&typeof d.language==='string'&&db.areas.some(a=>a.id===d.areaId));
 for(const c of [...db.cards,...s.drafts.map(d=>d.card)]){
 assert(c&&typeof c.id==='string'&&db.decks.some(d=>d.id===c.deckId)&&Number.isInteger(c.version)&&c.version>=0&&date(c.createdAt)&&date(c.updatedAt));
 for(const side of [c.front,c.back]){assert(side&&typeof side.text==='string'&&side.text.length<=2000&&typeof side.audioText==='string'&&side.audioText.length<=2000&&typeof side.language==='string'&&['reference','recording','file','none'].includes(side.mode));if(side.image)assert(side.image instanceof Blob&&side.image.type.startsWith('image/'));if(side.audio)assert(side.audio instanceof Blob&&side.audio.type.startsWith('audio/'))}
 if(c.memory){const m=c.memory;assert(date(m.due)&&(!m.last_review||date(m.last_review)));for(const k of ['stability','difficulty','elapsed_days','scheduled_days','reps','lapses','learning_steps','state'] as const)assert(typeof m[k]==='number'&&Number.isFinite(m[k])&&m[k]>=0);assert(m.state<=3);m.due=new Date(m.due);if(m.last_review)m.last_review=new Date(m.last_review)}
 }
 for(const d of s.drafts)assert(Number.isInteger(d.baseVersion)&&d.baseVersion>=0&&Number.isInteger(d.revision)&&d.revision>=0&&date(d.savedAt));
 for(const e of db.reviews??[])assert(date(e.at)&&typeof e.known==='boolean'&&db.cards.some(c=>c.id===e.cardId));
 return s;
}
