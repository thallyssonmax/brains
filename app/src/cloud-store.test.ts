import 'fake-indexeddb/auto';
import {describe,it,expect} from 'vitest';
import {CloudStore,type CloudRow,type CloudTransport} from './cloud-store';
import {blankCard,type Card} from './model';
import {applyReview} from './scheduler';
import {exportBackup,importBackup} from './backup';

function server(){
 let row:CloudRow|null=null;let unavailable=false,mediaFailure=false;
 const files=new Map<string,Blob>();
 const remote:CloudTransport={
  async read(){if(unavailable)throw Error('cloudUnavailable');return structuredClone(row)},
  async save(version,_id,document){if(unavailable)throw Error('cloudUnavailable');if(version!==(row?.version??0))throw Error('conflict');row={version:version+1,document:structuredClone(document)};return structuredClone(row)},
  async upload(path,blob){if(mediaFailure)throw Error('mediaUploadFailed');files.set(path,blob)},
  async download(path){const blob=files.get(path);if(!blob)throw Error('mediaUploadFailed');return blob}
 };
 return {remote,files,offline:(value:boolean)=>{unavailable=value},failMedia:(value:boolean)=>{mediaFailure=value}};
}
async function setup(){
 const backend=server(),user=crypto.randomUUID();
 const store=new CloudStore(user,backend.remote,crypto.randomUUID()),other=new CloudStore(user,backend.remote,crypto.randomUUID());
 const data=await store.mutate(0,d=>{d.areas.push({id:'a',name:'English',archived:false,deleted:false});d.decks.push({id:'d',areaId:'a',name:'English',language:'en-US',archived:false,deleted:false})});
 const card=blankCard(data.decks[0]);card.front.text='Hello';card.back.text='Olá';
 async function draft(value:Card=card){return store.saveDraft({id:crypto.randomUUID(),card:value,baseVersion:value.version,revision:0,savedAt:''})}
 return {store,other,backend,card,draft,data,user};
}

describe('authoritative cloud library',()=>{
 it('shows account cards and review progress on a second device without manual sync',async()=>{
  const {store,other,card,draft}=await setup();const saved=await store.saveCard(card,0,await draft());
  expect((await other.read()).cards[0].front.text).toBe('Hello');
  await store.mutate(saved.revision,db=>applyReview(db,{id:'review',cardId:card.id,known:true,at:new Date().toISOString()}));
  const result=await other.read();expect(result.reviews).toHaveLength(1);expect(result.cards[0].memory?.due).toBeInstanceOf(Date);
 });
 it('never treats a network failure as an empty account',async()=>{
  const {store,backend}=await setup();backend.offline(true);await expect(store.read()).rejects.toThrow('cloudUnavailable');
 });
 it('retains the draft and does not report a save when the database is unreachable',async()=>{
  const {store,backend,card,draft}=await setup();const local=await draft();backend.offline(true);
  await expect(store.saveCard(card,0,local)).rejects.toThrow('cloudUnavailable');expect(await store.drafts()).toHaveLength(1);
 });
 it('keeps metadata available when media fails and resumes the durable queue after reopening',async()=>{
  const {store,other,backend,card,draft,user}=await setup();backend.failMedia(true);card.front.mode='recording';card.front.audio=new Blob(['voice'],{type:'audio/mp4'});
  const saved=await store.saveCard(card,0,await draft());await store.retryMedia();
  expect(saved.cards[0].front.audio).toBeUndefined();expect((await other.read()).cards[0].front.audioPending).toBe(true);
  expect(await store.uploads()).toHaveLength(1);expect(store.mediaFailed).toBe(true);
  const name=store.databaseName;store.deactivate();await store.close();backend.failMedia(false);
  const reopened=new CloudStore(user,backend.remote,name);await reopened.retryMedia();const result=await other.read();
  expect(result.cards[0].front.audioPending).toBe(false);expect(await reopened.uploads()).toHaveLength(0);
  expect(await (await other.download(result.cards[0].front.audioPath!)).text()).toBe('voice');
 });
 it('does not turn an attachment completion into a false metadata edit conflict',async()=>{
  const {store,backend,card,draft}=await setup();backend.failMedia(true);card.back.image=new Blob(['photo'],{type:'image/jpeg'});
  const saved=await store.saveCard(card,0,await draft());await store.retryMedia();backend.failMedia(false);await store.retryMedia();
  const next=await store.mutate(saved.revision,d=>{d.preferences.goal=25});expect(next.preferences.goal).toBe(25);expect(next.cards[0].back.imagePending).toBe(false);
 });
 it('rejects real concurrent changes and preserves the losing draft',async()=>{
  const {store,other,card,draft}=await setup();await store.saveCard(card,0,await draft());const before=await store.read();const local=await draft(before.cards[0]);
  await other.mutate(before.revision,d=>{d.cards[0].front.text='Changed elsewhere';d.cards[0].version++});
  await expect(store.saveCard(before.cards[0],1,local)).rejects.toThrow('conflict');expect(await store.drafts()).toHaveLength(1);
  await expect(store.mutate(before.revision,d=>{d.preferences.goal=50})).rejects.toThrow('conflict');
 });
 it('removes pending tasks when a card is permanently deleted without resurrecting it',async()=>{
  const {store,other,backend,card,draft}=await setup();backend.failMedia(true);card.back.image=new Blob(['photo'],{type:'image/png'});
  let db=await store.saveCard(card,0,await draft());await store.retryMedia();db=await store.mutate(db.revision,d=>{d.cards[0].deleted=true});
  await store.purgeCard(card.id,db.revision);backend.failMedia(false);await store.retryMedia();expect((await other.read()).cards).toHaveLength(0);expect(await store.uploads()).toHaveLength(0);
 });
 it('does not overwrite a newer image when a stale upload finishes',async()=>{
  const {store,other,backend,card,draft}=await setup();backend.failMedia(true);card.back.image=new Blob(['old'],{type:'image/png'});
  await store.saveCard(card,0,await draft());await store.retryMedia();let db=await store.read();
  const edited={...db.cards[0],back:{...db.cards[0].back,image:new Blob(['new'],{type:'image/png'})}};
  await store.saveCard(edited,edited.version,await draft(edited));backend.failMedia(false);await store.retryMedia();db=await other.read();
  expect(await (await other.download(db.cards[0].back.imagePath!)).text()).toBe('new');expect(await store.uploads()).toHaveLength(0);
 });
 it('exports complete files and imports them with new account-owned paths',async()=>{
  const {store,backend,card,draft}=await setup();card.back.image=new Blob(['photo'],{type:'image/png'});await store.saveCard(card,0,await draft());await store.retryMedia();
  const exported=await importBackup(await exportBackup(await store.snapshot()));
  const second=server(),user=crypto.randomUUID(),target=new CloudStore(user,second.remote,crypto.randomUUID());
  await target.restore(exported,0);await target.retryMedia();const result=await target.read();
  expect(result.cards[0].back.imagePath).toMatch(new RegExp('^'+user+'/'));expect(await (await target.download(result.cards[0].back.imagePath!)).text()).toBe('photo');expect(backend.files.size).toBe(1);
 });
 it('refuses cross-account media references and stops writing after logout',async()=>{
  const {store,card,draft}=await setup();card.back.imagePath=crypto.randomUUID()+'/foreign';
  await expect(store.saveCard(card,0,await draft())).rejects.toThrow('mediaOwnerMismatch');store.deactivate();
  await expect(store.mutate(1,d=>{d.preferences.goal=9})).rejects.toThrow('authenticationRequired');
 });
});
