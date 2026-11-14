import {it,expect} from 'vitest';
import {createEmptyCard} from 'ts-fsrs';
import {initialLibrary,blankCard} from './model';
import {reviewQueue, reviewQueues} from './scheduler';

it('preserves queue ordering with a large history',()=>{
 const db=initialLibrary();db.preferences.timezone='America/Sao_Paulo';db.preferences.goal=100;
 db.areas=[{id:'a',name:'English',archived:false,deleted:false}];
 db.decks=[{id:'d',areaId:'a',name:'English',language:'en',archived:false,deleted:false}];
 db.cards=Array.from({length:200},(_,i)=>({...blankCard(db.decks[0]),id:String(i),memory:createEmptyCard(new Date('2026-10-08T15:00:00Z'))}));
 db.reviews=Array.from({length:2000},(_,i)=>({id:String(i),cardId:String(i%200),at:'2026-10-01T15:00:00Z',known:true}));
 const now=new Date('2026-10-09T15:00:00Z');
 expect(reviewQueue(db,now).map(c=>c.id)).toEqual(Array.from({length:100},(_,i)=>String(i)));
});

it('keeps per-area queues independent of the global daily cut', () => {
 const db = initialLibrary();
 db.preferences.timezone = 'UTC';
 db.preferences.goal = 2;
 db.areas = ['a','b','trash'].map(id => ({id, name:id, archived:false, deleted:id==='trash'}));
 db.decks = db.areas.map(area => ({id:'deck-'+area.id, areaId:area.id, name:area.name, language:'en', archived:false, deleted:false}));
 db.cards = ['a1','a2','b1','b2','trash1'].map((id,index) => ({
  ...blankCard(db.decks[index < 2 ? 0 : index < 4 ? 1 : 2]),
  id,
  createdAt:'2026-10-01T12:00:00Z',
 }));
 const now = new Date('2026-10-09T15:00:00Z');
 const queues = reviewQueues(db, now);
 expect(queues.queue.map(card => card.id)).toEqual(['a1','a2']);
 expect(queues.areas.get('a')?.map(card => card.id)).toEqual(['a1','a2']);
 expect(queues.areas.get('b')?.map(card => card.id)).toEqual(['b1','b2']);
 expect(queues.areas.has('trash')).toBe(false);
 db.reviews = [{id:'event',cardId:'a1',at:now.toISOString(),known:true}];
 expect(reviewQueues(db, now).areas.get('b')?.map(card => card.id)).toEqual(['b1']);
});
