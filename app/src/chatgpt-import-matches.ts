import {normalize,type Library} from './model';
const canonical=(value:string)=>normalize(value).replace(/\s+/g,' ');
export function importMatches(library:Library,areaId:string,front:string,back:string){
 const decks=new Set(library.decks.filter(deck=>deck.areaId===areaId).map(deck=>deck.id));
 const matching=library.cards.filter(card=>decks.has(card.deckId)&&canonical(card.front.text)===canonical(front));
 return {exact:matching.some(card=>canonical(card.back.text)===canonical(back)),otherMeaning:matching.length>0&&!matching.some(card=>canonical(card.back.text)===canonical(back))};
}
