import {describe,it,expect} from 'vitest';
import {initialLibrary,blankCard} from './model';
import {applyReview,reviewQueue} from './scheduler';
function fixture(){const db=initialLibrary();db.preferences.timezone='UTC';db.preferences.newLimit=1;db.areas=[{id:'a',name:'English',archived:false,deleted:false}];db.decks=[{id:'d',areaId:'a',name:'English',language:'en',archived:false,deleted:false}];db.cards=[blankCard(db.decks[0]),blankCard(db.decks[0])];return db}
const now=new Date('2026-09-13T12:00:00Z');
describe('spaced reviews',()=>{
 it('persists scheduling and applies the global new limit, with idempotent events',()=>{const db=fixture();const c=reviewQueue(db,now)[0];const event={id:'e',cardId:c.id,at:now.toISOString(),known:false};applyReview(db,event);applyReview(db,event);expect(db.reviews).toHaveLength(1);expect(c.memory!.due>now).toBe(true);expect(reviewQueue(db,now)).toHaveLength(0);expect(reviewQueue(db,new Date(c.memory!.due))[0].id).toBe(c.id);expect(c.memory!.reps).toBe(1)});
 it('prioritizes overdue cards and excludes archived cards',()=>{const db=fixture();const c=reviewQueue(db,now)[0];applyReview(db,{id:'e',cardId:c.id,at:now.toISOString(),known:true});const tomorrow=new Date('2026-09-15T12:00:00Z');expect(reviewQueue(db,tomorrow)[0].id).toBe(c.id);c.archived=true;expect(reviewQueue(db,tomorrow).some(v=>v.id===c.id)).toBe(false)});
 it('rejects early reviews without changing history',()=>{const db=fixture();const c=reviewQueue(db,now)[0];applyReview(db,{id:'1',cardId:c.id,at:now.toISOString(),known:true});expect(()=>applyReview(db,{id:'2',cardId:c.id,at:now.toISOString(),known:true})).toThrow('conflict');expect(db.reviews).toHaveLength(1)});
});
