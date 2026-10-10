import {describe,it,expect} from 'vitest';
import {matchesCollection,restoreCollectionItem} from './collection-state';
describe('two collection tabs',()=>{
 it('keeps every legacy state accessible in exactly one tab without mutating it',()=>{
  for(const deleted of [false,true])for(const archived of [false,true]){
   const item={deleted,archived};
   expect(matchesCollection(item,'active')).toBe(!deleted&&!archived);
   expect(matchesCollection(item,'trash')).toBe(deleted||archived);
   expect(item).toEqual({deleted,archived});
  }
 });
 it('restores archived and deleted items without changing their study fields',()=>{
  const item={id:'existing',deleted:true,archived:true,memory:{due:'2026-10-15',reps:12},reviews:[{id:'review'}]};
  const before=structuredClone(item);restoreCollectionItem(item);
  expect(item).toEqual({...before,deleted:false,archived:false});
 });
});
