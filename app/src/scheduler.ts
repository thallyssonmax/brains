import {createEmptyCard,fsrs,Rating,type Card as Memory} from 'ts-fsrs';
import type {Library,Card} from './model';
import {dayKey,type ReviewEvent} from './review';
export const scheduler=fsrs({request_retention:0.9,enable_fuzz:false,enable_short_term:true});
export function reviewQueue(db:Library,now=new Date(),areaId?:string):Card[]{
 const active=db.cards.filter(c=>!c.archived&&!c.deleted&&db.decks.some(d=>d.id===c.deckId&&!d.archived&&!d.deleted&&(!areaId||d.areaId===areaId)&&db.areas.some(a=>a.id===d.areaId&&!a.archived&&!a.deleted)));
 const today=dayKey(now,db.preferences.timezone);
 const introduced=new Set((db.reviews??[]).filter(e=>e.introduced&&dayKey(new Date(e.at),db.preferences.timezone)===today).map(e=>e.cardId)).size;
 const due=active.filter(c=>c.memory&&new Date(c.memory.due)<=now).sort((a,b)=>+new Date(a.memory!.due)-+new Date(b.memory!.due));
 const fresh=active.filter(c=>!c.memory).sort((a,b)=>a.createdAt.localeCompare(b.createdAt)||a.id.localeCompare(b.id)).slice(0,Math.max(0,db.preferences.newLimit-introduced));
 return [...due,...fresh];
}
export function applyReview(db:Library,event:ReviewEvent){
 db.reviews??=[];
 if(db.reviews.some(e=>e.id===event.id))return;
 const card=db.cards.find(c=>c.id===event.cardId);
 if(!card||!reviewQueue(db,new Date(event.at),db.decks.find(d=>d.id===card.deckId)?.areaId).some(c=>c.id===card.id))throw Error('conflict');
 const at=new Date(event.at);
 const previous:Memory=card.memory?{...card.memory,due:new Date(card.memory.due),last_review:card.memory.last_review?new Date(card.memory.last_review):undefined}:createEmptyCard(at);
 const result=scheduler.next(previous,at,event.known?Rating.Good:Rating.Again);
 db.reviews.push({...event,introduced:!card.memory,log:result.log});
 card.memory=result.card;card.version++;card.updatedAt=event.at;
}
