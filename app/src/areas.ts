import type {Library,Draft} from './model';
// Old deck records are retained for compatibility, but no longer form a user-facing level.
export function flattenAreas(library:Library,drafts:Draft[]){
 if(library.structureVersion===2)return false;
 const originals=new Map(library.decks.map(d=>[d.id,{...d}]));
 const primary=new Map<string,string>();
 for(const area of library.areas){let deck=library.decks.find(d=>d.areaId===area.id);if(!deck){deck={id:crypto.randomUUID(),areaId:area.id,name:area.name,language:'en-US',archived:false,deleted:false};library.decks.push(deck)}primary.set(area.id,deck.id)}
 for(const card of library.cards){const old=originals.get(card.deckId);if(!old)continue;card.deckId=primary.get(old.areaId)!;card.archived ||= old.archived;card.deleted ||= old.deleted}
 for(const draft of drafts){const old=originals.get(draft.card.deckId);if(old){draft.card.deckId=primary.get(old.areaId)!;draft.card.archived ||= old.archived;draft.card.deleted ||= old.deleted;draft.revision++}}
 for(const deck of library.decks){deck.archived=false;deck.deleted=false}
 library.structureVersion=2;library.revision++;return true;
}
