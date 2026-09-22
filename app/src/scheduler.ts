import {createEmptyCard,fsrs,Rating,type Card as Memory} from 'ts-fsrs';
import type {Library,Card} from './model';
import {dayKey,type ReviewEvent} from './review';
export const scheduler=fsrs({request_retention:0.9,enable_fuzz:false,enable_short_term:false});
export function reviewQueue(db:Library,now=new Date(),areaId?:string):Card[]{
 const active=db.cards.filter(c=>!c.archived&&!c.deleted&&db.decks.some(d=>d.id===c.deckId&&!d.archived&&!d.deleted&&(!areaId||d.areaId===areaId)&&db.areas.some(a=>a.id===d.areaId&&!a.archived&&!a.deleted)));
 const today=dayKey(now,db.preferences.timezone);
 const introduced=new Set((db.reviews??[]).filter(e=>e.introduced&&dayKey(new Date(e.at),db.preferences.timezone)===today).map(e=>e.cardId)).size;
 const reviewed=new Set((db.reviews??[]).filter(e=>dayKey(new Date(e.at),db.preferences.timezone)===today).map(e=>e.cardId));
 const due=active.filter(c=>!reviewed.has(c.id)&&c.memory).map(card=>({card,due:effectiveDue(db,card)!})).filter(entry=>entry.due<=now).sort((a,b)=>+a.due-+b.due).map(entry=>entry.card);
 const fresh=active.filter(c=>!reviewed.has(c.id)&&!c.memory).sort((a,b)=>a.createdAt.localeCompare(b.createdAt)||a.id.localeCompare(b.id)).slice(0,Math.max(0,db.preferences.newLimit-introduced));
 return [...due,...fresh];
}
export function applyReview(db:Library,event:ReviewEvent){
 db.reviews??=[];
 if(db.reviews.some(e=>e.id===event.id))return;
 const card=db.cards.find(c=>c.id===event.cardId);
 const original=event.retryOf?db.reviews.find(e=>e.id===event.retryOf):undefined;
 const active=card&&db.decks.some(d=>d.id===card.deckId&&!d.deleted&&!d.archived&&db.areas.some(a=>a.id===d.areaId&&!a.deleted&&!a.archived))&&!card.deleted&&!card.archived;
 const retry=!!(original&&!original.known&&!original.retryOf&&event.sessionId&&original.sessionId===event.sessionId&&original.cardId===event.cardId&&new Date(event.at)>=new Date(original.at)&&!db.reviews.some(e=>e.retryOf===original.id)&&db.reviews.filter(e=>e.cardId===event.cardId).at(-1)?.id===original.id);
 if(!active||(event.retryOf?!retry:!reviewQueue(db,new Date(event.at),db.decks.find(d=>d.id===card!.deckId)?.areaId).some(c=>c.id===card!.id)))throw Error('conflict');
 if(!card)throw Error('conflict');
 const at=new Date(event.at);
 const previous:Memory=card.memory?{...card.memory,due:new Date(card.memory.due),last_review:card.memory.last_review?new Date(card.memory.last_review):undefined}:createEmptyCard(at);
 const result=scheduler.next(previous,at,event.known?Rating.Good:Rating.Again);
 const floor=nextStudyDay(at,db.preferences.timezone);
 if(result.card.due<floor){result.card.due=floor;result.card.scheduled_days=Math.max(1,result.card.scheduled_days);result.log.scheduled_days=result.card.scheduled_days}
 result.card.due=startStudyDay(result.card.due,db.preferences.timezone);
 db.reviews.push({...event,introduced:!card.memory,log:result.log});
 card.memory=result.card;card.version++;card.updatedAt=event.at;
}

// Find the first instant of the next local calendar day, including DST changes.
export function nextStudyDay(at:Date,timezone:string):Date{
 const today=dayKey(at,timezone);let low=at.getTime(),high=low+48*60*60*1000;
 while(high-low>1){const mid=Math.floor((low+high)/2);if(dayKey(new Date(mid),timezone)===today)low=mid;else high=mid}
 return new Date(high);
}

export function effectiveDue(db:Library,card:Card):Date|undefined{
 if(!card.memory)return;
 const due=startStudyDay(new Date(card.memory.due),db.preferences.timezone);
 const last=(db.reviews??[]).filter(e=>e.cardId===card.id).at(-1);
 return last?new Date(Math.max(+due,+nextStudyDay(new Date(last.at),db.preferences.timezone))):due;
}

// First instant of this calendar date in the account timezone (DST-safe).
export function startStudyDay(at:Date,timezone:string):Date{
 const today=dayKey(at,timezone);let low=at.getTime()-48*60*60*1000,high=at.getTime();
 while(high-low>1){const mid=Math.floor((low+high)/2);if(dayKey(new Date(mid),timezone)===today)high=mid;else low=mid}
 return new Date(high);
}
