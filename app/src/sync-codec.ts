import type {Library,Side} from './model';
import {importBackup} from './backup';
import type {SyncRecord} from './sync-plan';
export interface MediaTransfer {
 upload(blob:Blob):Promise<string>;
 download(path:string):Promise<Blob>;
}
// Cards and references are serialized; drafts never leave this device.
export async function encodeLibrary(library:Library,media:MediaTransfer):Promise<SyncRecord[]> {
 const uploads=new Map<Blob,Promise<string>>();
 const upload=(blob:Blob)=>{let result=uploads.get(blob);if(!result){result=media.upload(blob);uploads.set(blob,result)}return result};
 const side=async(value:Side)=>({...value,image:value.image?await upload(value.image):undefined,audio:value.audio?await upload(value.audio):undefined});
 const cards=[];
 for(const card of library.cards)cards.push({...card,front:await side(card.front),back:await side(card.back)});
 const json=(value:unknown)=>JSON.parse(JSON.stringify(value));
 return [
  ...library.areas.map(value=>({id:'area:'+value.id,kind:'area',value:json(value)})),
  ...library.decks.map(value=>({id:'deck:'+value.id,kind:'deck',value:json(value)})),
  ...cards.map(value=>({id:'card:'+value.id,kind:'card',value:json(value)})),
  ...(library.reviews??[]).map(value=>({id:'review:'+value.id,kind:'review',value:json(value)})),
  {id:'preferences',kind:'preferences',value:json(library.preferences)}
 ];
}
export async function decodeLibrary(records:SyncRecord[],media:MediaTransfer):Promise<Library>{
 if(new Set(records.map(r=>r.id)).size!==records.length)throw Error('duplicateSyncId');
 const downloads=new Map<string,Promise<Blob>>();
 const download=(path:unknown)=>{if(typeof path!=='string')throw Error('invalidMediaPath');let result=downloads.get(path);if(!result){result=media.download(path);downloads.set(path,result)}return result};
 const library:Record<string,unknown>={schema:1,structureVersion:2,revision:0,areas:[],decks:[],cards:[],reviews:[]};
 const groups:Record<string,string>={area:'areas',deck:'decks',card:'cards',review:'reviews'};
 for(const record of records){
  const value=structuredClone(record.value) as any;
  if(record.kind==='preferences'){if(record.id!=='preferences'||library.preferences)throw Error('invalidSyncRecord');library.preferences=value;continue}
  const group=groups[String(record.kind)];
  if(!group||!value||record.id!==record.kind+':'+value.id)throw Error('invalidSyncRecord');
  if(record.kind==='card')for(const side of [value.front,value.back]){if(!side)throw Error('invalidSyncRecord');for(const key of ['image','audio'])if(side[key]!==undefined)side[key]=await download(side[key])}
  (library[group] as unknown[]).push(value);
 }
 // Reuse the backup validator for relationships, scheduling dates and media limits.
 const {exportBackup}=await import('./backup');
 const backup=await exportBackup({library:library as unknown as Library,drafts:[]});
 return (await importBackup(backup)).library;
}
