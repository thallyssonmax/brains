import {it,expect} from 'vitest';
import {flattenAreas} from './areas';
import {initialLibrary,blankCard,type Draft} from './model';
it('flattens old decks without losing cards, drafts, review history or archived status',()=>{
 const data=initialLibrary();delete data.structureVersion;data.areas=[{id:'a',name:'English',archived:false,deleted:false}];data.decks=[{id:'d1',areaId:'a',name:'General',language:'en-US',archived:false,deleted:false},{id:'d2',areaId:'a',name:'Travel',language:'en-US',archived:true,deleted:false}];
 const c1=blankCard(data.decks[0]),c2=blankCard(data.decks[1]);c2.front.audio=new Blob(['audio'],{type:'audio/webm'});data.cards=[c1,c2];data.reviews=[{id:'r',cardId:c2.id,at:new Date().toISOString(),known:true}];const drafts:Draft[]=[{id:'draft',card:{...c2},baseVersion:0,revision:1,savedAt:''}];
 expect(flattenAreas(data,drafts)).toBe(true);expect(data.cards).toHaveLength(2);expect(data.cards[1].deckId).toBe('d1');expect(data.cards[1].archived).toBe(true);expect(data.cards[1].front.audio).toBe(c2.front.audio);expect(drafts[0].card.deckId).toBe('d1');expect(data.reviews[0].cardId).toBe(c2.id);expect(flattenAreas(data,drafts)).toBe(false);
});
