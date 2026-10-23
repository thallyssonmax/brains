import {expect,it} from 'vitest';
import {blankCard,initialLibrary} from './model';
import {importMatches} from './chatgpt-import-matches';

it('includes trashed cards in duplicate checks, without matching another area',()=>{
 const db=initialLibrary();db.areas=[{id:'a',name:'English',archived:false,deleted:false},{id:'b',name:'Spanish',archived:false,deleted:false}];
 db.decks=[{id:'da',areaId:'a',name:'English',language:'en-US',archived:false,deleted:false},{id:'db',areaId:'b',name:'Spanish',language:'es-ES',archived:false,deleted:false}];
 const card=blankCard(db.decks[0]);card.front.text=' Need  ';card.back.text='I need help.';card.deleted=true;db.cards=[card];
 expect(importMatches(db,'a','need','I  need help.')).toEqual({exact:true,otherMeaning:false});
 expect(importMatches(db,'a','NEED','We need water.')).toEqual({exact:false,otherMeaning:true});
 expect(importMatches(db,'b','Need','I need help.')).toEqual({exact:false,otherMeaning:false});
});
