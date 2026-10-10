import {it,expect} from 'vitest';
import {createEmptyCard} from 'ts-fsrs';
import {initialLibrary,blankCard} from './model';
import {reviewQueue} from './scheduler';

it('preserves queue ordering with a large history',()=>{
 const db=initialLibrary();db.preferences.timezone='America/Sao_Paulo';db.preferences.goal=100;
 db.areas=[{id:'a',name:'English',archived:false,deleted:false}];
 db.decks=[{id:'d',areaId:'a',name:'English',language:'en',archived:false,deleted:false}];
 db.cards=Array.from({length:200},(_,i)=>({...blankCard(db.decks[0]),id:String(i),memory:createEmptyCard(new Date('2026-10-08T15:00:00Z'))}));
 db.reviews=Array.from({length:2000},(_,i)=>({id:String(i),cardId:String(i%200),at:'2026-10-01T15:00:00Z',known:true}));
 const now=new Date('2026-10-09T15:00:00Z');
 expect(reviewQueue(db,now).map(c=>c.id)).toEqual(Array.from({length:100},(_,i)=>String(i)));
});
