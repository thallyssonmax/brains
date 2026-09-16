import type {SupabaseClient} from '@supabase/supabase-js';
import {LocalStore} from './storage';
import {initialLibrary,validateCard,type Card,type Draft,type Library} from './model';
import {importBackup,type Snapshot} from './backup';
import {checkMediaPath,MEDIA_BUCKET} from './cloud-media';

export interface CloudRow {version:number;document:Library}
export interface CloudTransport {
 read():Promise<CloudRow|null>;
 save(version:number,id:string,document:Library):Promise<CloudRow>;
 upload(path:string,blob:Blob):Promise<void>;
 download(path:string):Promise<Blob>;
}
export interface UploadTask {id:string;committed?:boolean;createdAt?:number;cardId:string;side:'front'|'back';kind:'image'|'audio';path:string;blob:Blob}
export function transportFor(client:SupabaseClient,userId:string):CloudTransport{
 const auth=async()=>{const {data,error}=await client.auth.getSession();if(error||data.session?.user.id!==userId)throw Error('authenticationRequired')};
 return {
  async read(){await auth();const {data,error}=await client.from('brains_cloud').select('version,document').eq('user_id',userId).maybeSingle();if(error)throw Error('cloudUnavailable');return data as CloudRow|null},
  async save(version,id,document){await auth();const args={expected_version:version,operation_id:id,payload:document};let result=await client.rpc('brains_cloud_save',args);if(result.error&&!result.error.message.includes('conflict')){await auth();result=await client.rpc('brains_cloud_save',args)}if(result.error)throw Error(result.error.message.includes('conflict')?'conflict':'cloudUnavailable');return result.data as CloudRow},
  async upload(path,blob){await auth();checkMediaPath(userId,path);const mime=blob.type.split(';')[0].trim();const bytes=await blob.arrayBuffer();const bucket=client.storage.from(MEDIA_BUCKET);const {error}=await bucket.upload(path,bytes,{upsert:false,contentType:mime});if(error){const old=await bucket.download(path);if(old.error||!old.data)throw Error('mediaUploadFailed');const found=new Uint8Array(await old.data.arrayBuffer()),expected=new Uint8Array(bytes);if(found.length!==expected.length||found.some((b,i)=>b!==expected[i]))throw Error('mediaUploadFailed')}},
  async download(path){await auth();checkMediaPath(userId,path);const {data,error}=await client.storage.from(MEDIA_BUCKET).download(path);if(error)throw Error('mediaUploadFailed');return data}
 };
}

export class CloudStore extends LocalStore {
 private listeners=new Set<()=>void>();
 private processing?:Promise<void>;
 private active=true;
 private snapshots=new Map<number,string>();
 private writing=0;
 private readonly downloads=new Map<string,Promise<Blob>>();
 private comparable(db:Library){const copy=structuredClone(db);copy.revision=0;for(const c of copy.cards)for(const side of [c.front,c.back]){delete side.imagePending;delete side.audioPending}return JSON.stringify(copy)}
 private remember(db:Library){this.snapshots.set(db.revision,this.comparable(db));if(this.snapshots.size>50)this.snapshots.delete(this.snapshots.keys().next().value!);return db}
 pendingCount=0;
 mediaFailed=false;
 constructor(readonly userId:string,private remote:CloudTransport,name='brains-drafts-v3-'+userId){super(name)}
 subscribe=(fn:()=>void)=>{this.listeners.add(fn);return()=>{this.listeners.delete(fn)}};
 private notify(){if(this.active)for(const fn of this.listeners)fn()}
 activate(){this.active=true}
 deactivate(){this.active=false}
 private async decode(row:CloudRow):Promise<Library>{
  const db=(await importBackup(new Blob([JSON.stringify({format:'brains-backup',version:1,data:{library:{...row.document,revision:row.version},drafts:[]}})]))).library;
  for(const card of db.cards)for(const side of [card.front,card.back])for(const key of ['imagePath','audioPath'] as const)if(side[key])checkMediaPath(this.userId,side[key]!);
  return this.remember(db);
 }
 override async read(){const row=await this.remote.read();return row?this.decode(row):this.remember(initialLibrary())}
 private async commit(db:Library,expected:number){
  if(!this.active)throw Error('authenticationRequired');
  for(const c of db.cards)for(const side of [c.front,c.back])for(const key of ['imagePath','audioPath'] as const)if(side[key])checkMediaPath(this.userId,side[key]!);
  const document=JSON.parse(JSON.stringify(db));
  for(const c of document.cards)for(const s of [c.front,c.back]){delete s.image;delete s.audio}
  return this.decode(await this.remote.save(expected,crypto.randomUUID(),document));
 }
 override async mutate(expected:number,change:(db:Library)=>void){
  const baseline=this.snapshots.get(expected);this.writing++;
  try{for(let attempt=0;attempt<3;attempt++){
   const db=await this.read();
   if(db.revision!==expected&&(!baseline||this.comparable(db)!==baseline))throw Error('conflict');
   const revision=db.revision;change(db);
   try{return await this.commit(db,revision)}catch(e){if(!(e instanceof Error&&e.message==='conflict')||attempt===2)throw e}
  }throw Error('conflict')}finally{this.writing--}
 }
 override async saveCard(card:Card,baseVersion:number,draft:Draft){
  this.writing++;try{return await this.saveCardNow(card,baseVersion,draft)}finally{this.writing--;void this.retryMedia().catch(()=>{})}
 }
 private async saveCardNow(card:Card,baseVersion:number,draft:Draft){
  const db=await this.read();validateCard(card,db);const old=db.cards.find(c=>c.id===card.id);if((old?.version??0)!==baseVersion||old?.deleted)throw Error('conflict');
  if((await this.drafts()).some(d=>d.id===draft.id&&d.revision!==draft.revision))throw Error('draftConflict');
  const saved=structuredClone(card);const tasks:UploadTask[]=[];
  for(const which of ['front','back'] as const){const side=saved[which];for(const kind of ['image','audio'] as const){
   const pathKey=(kind+'Path') as 'imagePath'|'audioPath',pendingKey=(kind+'Pending') as 'imagePending'|'audioPending';
   if(old&&side[pathKey]===old[which][pathKey])side[pendingKey]=old[which][pendingKey];
   const blob=side[kind];if(blob){const path=this.userId+'/'+crypto.randomUUID();side[kind+'Path' as 'imagePath'|'audioPath']=path;side[kind+'Pending' as 'imagePending'|'audioPending']=true;tasks.push({id:path,createdAt:Date.now(),cardId:card.id,side:which,kind,path,blob});delete side[kind]}
  }}
  // Persist the files first; failed cloud writes keep the editor's original draft.
  for(const task of tasks)await this.putUpload(task);
  saved.version=baseVersion+1;saved.updatedAt=new Date().toISOString();db.cards=db.cards.filter(c=>c.id!==card.id).concat(saved);
  const result=await this.commit(db,db.revision);
  for(const task of tasks)await this.putUpload({...task,committed:true}).catch(()=>{});
  await this.removeDraft(draft.id,draft.revision).catch(()=>{});
  return result;
 }
 override async purgeCard(id:string,revision:number){await this.mutate(revision,db=>{if(!db.cards.some(c=>c.id===id&&c.deleted))throw Error('conflict');db.cards=db.cards.filter(c=>c.id!==id);db.reviews=db.reviews?.filter(r=>r.cardId!==id)});for(const draft of await this.drafts())if(draft.card.id===id)await this.removeDraft(draft.id,draft.revision);for(const task of await this.uploads())if(task.cardId===id)await this.removeUpload(task.id)}
 async retryMedia(){if(this.writing)return;if(this.processing)return this.processing;this.processing=this.processMedia().finally(()=>{this.processing=undefined});return this.processing}
 private async processMedia(){
  this.mediaFailed=false;
  const tasks=await this.uploads();this.pendingCount=tasks.length;this.notify();
  for(const task of tasks){if(!this.active||this.writing)break;try{
   let db=await this.read();const pathKey=(task.kind+'Path') as 'imagePath'|'audioPath',pendingKey=(task.kind+'Pending') as 'imagePending'|'audioPending';
   if(db.cards.find(c=>c.id===task.cardId)?.[task.side][pathKey]!==task.path){if(task.committed||(task.createdAt&&Date.now()-task.createdAt>86400000))await this.removeUpload(task.id);continue}
   await this.remote.upload(task.path,task.blob);
   for(let attempt=0;attempt<3;attempt++){if(!this.active)break;if(this.writing)throw Error('retryLater');db=await this.read();const card=db.cards.find(c=>c.id===task.cardId);if(!card||card[task.side][pathKey]!==task.path)break;card[task.side][pendingKey]=false;
    try{await this.commit(db,db.revision);break}catch(e){if(!(e instanceof Error&&e.message==='conflict')||attempt===2)throw e}
   }
   if(this.active)await this.removeUpload(task.id);
  }catch{this.mediaFailed=true}}
  this.pendingCount=(await this.uploads()).length;this.notify();
 }
 async download(path:string){
  checkMediaPath(this.userId,path);if(!this.active)throw Error('authenticationRequired');
  const task=(await this.uploads()).find(t=>t.path===path);if(task)return task.blob;
  let request=this.downloads.get(path);if(!request){request=this.remote.download(path).catch(e=>{this.downloads.delete(path);throw e});this.downloads.set(path,request);if(this.downloads.size>20)this.downloads.delete(this.downloads.keys().next().value!)}return request;
 }
 override async snapshot():Promise<Snapshot>{
  const library=await this.read(),drafts=await this.drafts();
  for(const card of [...library.cards,...drafts.map(d=>d.card)])for(const side of [card.front,card.back])for(const kind of ['image','audio'] as const){
   const path=side[kind+'Path' as 'imagePath'|'audioPath'];if(path&&!side[kind])side[kind]=await this.download(path);
  }
  return {library,drafts};
 }
 override async hasRecovery(){return false}
 override async restore(snapshot:Snapshot|null,revision:number):Promise<void>{
  if(!snapshot)throw Error('invalidBackup');
  this.writing++;
  try{
   const current=await this.read();if(current.revision!==revision)throw Error('conflict');
   const next=structuredClone(snapshot),tasks:UploadTask[]=[];
   for(const card of next.library.cards){
    card.version=Math.max(card.version,current.cards.find(c=>c.id===card.id)?.version??0)+1;
    for(const which of ['front','back'] as const)for(const kind of ['image','audio'] as const){
     const side=card[which],pathKey=(kind+'Path') as 'imagePath'|'audioPath',pendingKey=(kind+'Pending') as 'imagePending'|'audioPending';
     const blob=side[kind];if(side[pathKey]&&!blob)throw Error('invalidBackup');
     delete side[pathKey];delete side[pendingKey];
     if(blob){const path=this.userId+'/'+crypto.randomUUID();side[pathKey]=path;side[pendingKey]=true;delete side[kind];tasks.push({id:path,path,cardId:card.id,side:which,kind,blob,createdAt:Date.now()})}
    }
   }
   for(const draft of next.drafts){for(const side of [draft.card.front,draft.card.back]){if((side.imagePath&&!side.image)||(side.audioPath&&!side.audio))throw Error('invalidBackup');delete side.imagePath;delete side.audioPath;delete side.imagePending;delete side.audioPending}}
   for(const task of tasks)await this.putUpload(task);
   await this.commit(next.library,revision);
   await this.replaceDrafts(next.drafts.map(d=>({...d,id:crypto.randomUUID(),revision:1,baseVersion:next.library.cards.find(c=>c.id===d.card.id)?.version??0}))).catch(()=>{throw Error('draftRestoreFailed')});
   for(const task of tasks)await this.putUpload({...task,committed:true}).catch(()=>{});
  }finally{this.writing--;void this.retryMedia().catch(()=>{})}
 }
}
