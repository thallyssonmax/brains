import {describe,it,expect} from 'vitest';
import {learnedVocabulary} from '../shared/learned-vocabulary.js';
import {Client} from '@modelcontextprotocol/sdk/client/index.js';
import {InMemoryTransport} from '@modelcontextprotocol/sdk/inMemory.js';
import {createImportServer} from '../api/brains-mcp-import.js';

describe('learned vocabulary',()=>{
 it('returns only recently recalled mature cards from the selected area',()=>{
  const card=(id,overrides={})=>({id,deckId:'deck',front:{text:id},memory:{state:2,reps:5,scheduled_days:45},archived:false,deleted:false,...overrides});
  const library={decks:[{id:'deck',areaId:'area',language:'en-US'}],cards:[card('learned'),card('failed'),card('young',{memory:{state:2,reps:5,scheduled_days:10}}),card('archived',{archived:true})],reviews:['learned','failed','young','archived'].flatMap(id=>[1,2,3].map(n=>({cardId:id,at:`2026-11-${String(n).padStart(2,'0')}T12:00:00Z`,known:id!=='failed'||n!==3})))};
  expect(learnedVocabulary(library,{areaId:'area'}).map(item=>item.term)).toEqual(['learned']);
  expect(learnedVocabulary(library,{areaId:'other'})).toEqual([]);
 });
 it('exposes selected terms through a read-only MCP tool',async()=>{
  const library={areas:[{id:'area',name:'English'}],decks:[{id:'deck',areaId:'area',language:'en-US'}],cards:[{id:'known',deckId:'deck',front:{text:'take care'},memory:{state:2,reps:4,scheduled_days:35}}],reviews:[1,2,3].map(day=>({cardId:'known',at:`2026-11-0${day}T12:00:00Z`,known:true}))};
  const server=createImportServer({read:async()=>({document:library})});
  const client=new Client({name:'test',version:'1.0.0'});
  const [clientTransport,serverTransport]=InMemoryTransport.createLinkedPair();
  try{
   await server.connect(serverTransport);await client.connect(clientTransport);
   const listed=await client.listTools();
   expect(listed.tools.find(tool=>tool.name==='get_learned_vocabulary')?.annotations?.readOnlyHint).toBe(true);
   const result=await client.callTool({name:'get_learned_vocabulary',arguments:{areaId:'area'}});
   expect(result.structuredContent).toEqual({terms:[{term:'take care',language:'en-US'}]});
  }finally{await client.close();await server.close()}
 });
});
