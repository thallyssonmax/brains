const clean=value=>typeof value==='string'?value.normalize('NFKC').trim().replace(/\s+/g,' '):'';

export function learnedVocabulary(library,{areaId,deckId,language,excludeCardId,limit=20}={}){
 const decks=new Map((library.decks??[]).filter(deck=>!deck.deleted&&!deck.archived&&(!areaId||deck.areaId===areaId)&&(!deckId||deck.id===deckId)&&(!language||deck.language===language)).map(deck=>[deck.id,deck]));
 const reviews=new Map();
 for(const event of library.reviews??[]){
  if(!reviews.has(event.cardId))reviews.set(event.cardId,[]);
  reviews.get(event.cardId).push(event);
 }
 const seen=new Set();
 return (library.cards??[]).filter(card=>{
  const memory=card.memory;
  if(card.id===excludeCardId||card.deleted||card.archived||!decks.has(card.deckId)||memory?.state!==2||memory.reps<3||memory.scheduled_days<30)return false;
  const recent=(reviews.get(card.id)??[]).sort((a,b)=>Date.parse(b.at)-Date.parse(a.at)).slice(0,3);
  return recent.length===3&&recent.every(event=>event.known===true);
 }).sort((a,b)=>b.memory.scheduled_days-a.memory.scheduled_days||b.memory.reps-a.memory.reps).flatMap(card=>{
  const term=clean(card.front?.text);
  const key=term.toLocaleLowerCase();
  if(!term||term.length>80||seen.has(key))return [];
  seen.add(key);
  return [{term,language:decks.get(card.deckId).language,cardId:card.id}];
 }).slice(0,Math.max(1,Math.min(20,limit)));
}
