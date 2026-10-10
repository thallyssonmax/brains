export type CollectionTab='active'|'trash';
type ItemState={deleted:boolean;archived:boolean};
// Legacy archives remain recoverable without rewriting persisted user data.
export function matchesCollection(item:ItemState,tab:CollectionTab){
 return tab==='trash'?item.deleted||item.archived:!item.deleted&&!item.archived;
}
export function restoreCollectionItem(item:ItemState){item.deleted=false;item.archived=false}
