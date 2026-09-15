import 'fake-indexeddb/auto';
import {expect,it,vi} from 'vitest';
import {encodeLibrary,decodeLibrary} from './sync-codec';
import {initialLibrary,blankCard} from './model';
import {LocalStore} from './storage';
it('round trips content and shared media without serializing blobs as empty objects',async()=>{
 const library=initialLibrary();library.areas=[{id:'a',name:'English',deleted:false,archived:false}];library.decks=[{id:'d',areaId:'a',name:'English',language:'en-US',deleted:false,archived:false}];
 const card=blankCard(library.decks[0]);card.front.text='Hello';card.back.text='Olá';const audio=new Blob(['audio'],{type:'audio/webm'});card.front.audio=audio;card.back.audio=audio;library.cards=[card];
 const media={upload:vi.fn(async()=> 'owner/audio'),download:vi.fn(async()=>audio)};
 const records=await encodeLibrary(library,media);expect(media.upload).toHaveBeenCalledTimes(1);
 const restored=await decodeLibrary(records,media);expect(restored.cards[0].front.text).toBe('Hello');expect(await restored.cards[0].front.audio!.text()).toBe('audio');expect(media.download).toHaveBeenCalledTimes(1);
 await expect(decodeLibrary([...records,records[0]],media)).rejects.toThrow('duplicateSyncId');
 await expect(decodeLibrary(records.filter(r=>r.kind!=='deck'),media)).rejects.toThrow();
});
it('does not overwrite edits made during a sync and commits baseline atomically',async()=>{
 const store=new LocalStore(crypto.randomUUID());const initial=await store.read();await store.mutate(0,d=>{d.preferences.goal=8});
 await expect(store.commitSynced(initial,[{id:'test'}],0)).rejects.toThrow('conflict');expect((await store.read()).preferences.goal).toBe(8);expect(await store.syncBase()).toEqual([]);
 await store.commitSynced(initial,[{id:'test'}],1);expect((await store.read()).revision).toBe(2);expect(await store.syncBase()).toEqual([{id:'test'}]);await store.close();
});
