import {describe,it,expect} from 'vitest';
import {Client} from '@modelcontextprotocol/sdk/client/index.js';
import {InMemoryTransport} from '@modelcontextprotocol/sdk/inMemory.js';
import importHandler,{clientIdFromToken,createImportServer} from '../api/brains-mcp-import.js';

function fixture(){
 const library={schema:1,revision:3,areas:[{id:'area-en',name:'English',archived:false,deleted:false}],decks:[{id:'deck-en',areaId:'area-en',name:'English',language:'en-US',archived:false,deleted:false}],cards:[],reviews:[],preferences:{locale:'en',goal:10,newLimit:2,timezone:'UTC'}};
 let row={version:3,document:structuredClone(library)};const saved=[];
 return {saved,store:{async read(){return structuredClone(row)},async save(version,operationId,document){if(version!==row.version)throw Error('CONFLICT');row={version:version+1,document:structuredClone(document)};saved.push({version,operationId,document:structuredClone(document)});return row}},get row(){return row}};
}
async function withClient(store,fn){
 const server=createImportServer(store),client=new Client({name:'brains-test',version:'1.0.0'});
 const [a,b]=InMemoryTransport.createLinkedPair();
 try{await server.connect(b);await client.connect(a);return await fn(client)}finally{await client.close();await server.close()}
}

describe('authenticated Brains card tools',()=>{
 it('requires a bearer token and returns OAuth resource discovery metadata',async()=>{
  const req={method:'POST',headers:{},body:{}};
  const headers={};const res={setHeader:(key,value)=>{headers[key]=value},end(value){this.body=value}};
  await importHandler(req,res);
  expect(res.statusCode).toBe(401);
  expect(headers['WWW-Authenticate']).toContain('https://www.heybrains.app/.well-known/oauth-protected-resource');
 });
 it('extracts the client allowlist only from a verified OAuth JWT payload format',()=>{
  const payload=Buffer.from(JSON.stringify({sub:'user-id',client_id:'brains-chatgpt-client'})).toString('base64url');
  expect(clientIdFromToken(`header.${payload}.signature`)).toBe('brains-chatgpt-client');
  expect(clientIdFromToken('not-a-jwt')).toBe('');
 });

 it('exposes only area listing and an explicitly approved text-card writer',async()=>withClient(fixture().store,async client=>{
  const {tools}=await client.listTools();
  expect(tools.map(tool=>tool.name)).toEqual(['list_areas','create_flashcards']);
  expect(tools[1].inputSchema.properties).not.toHaveProperty('file');
  expect(tools[1].annotations).toMatchObject({readOnlyHint:false,destructiveHint:false});
 }));

 it('lists only active areas and does not return cards or review history',async()=>{
  const db=fixture();
  db.row.document.areas.push({id:'area-trash',name:'Deleted',archived:false,deleted:true});
  await withClient(db.store,async client=>{
   const result=await client.callTool({name:'list_areas',arguments:{}});
   expect(result.structuredContent.areas).toEqual([{id:'area-en',name:'English',language:'en-US',cardCount:0}]);
  });
 });

 it('saves only the approved front and back while preserving existing cards and history',async()=>{
  const db=fixture();
  db.row.document.cards.push({id:'old',deckId:'deck-en',front:{text:'Existing',mode:'reference',language:'en-US',audioText:''},back:{text:'An existing card.',mode:'reference',language:'pt-BR',audioText:''},version:2,createdAt:'2026-01-01T00:00:00.000Z',updatedAt:'2026-01-01T00:00:00.000Z',archived:false,deleted:false,memory:{due:'2026-02-01T00:00:00.000Z'}});
  db.row.document.reviews=[{id:'review-old',cardId:'old',known:true,at:'2026-01-02T00:00:00.000Z'}];
  const original=structuredClone(db.row.document);
  await withClient(db.store,async client=>{
   const result=await client.callTool({name:'create_flashcards',arguments:{areaId:'area-en',cards:[{front:'to become',back:'I want to become fluent in English.'}]}});
   expect(result.structuredContent).toMatchObject({saved:true,areaName:'English',count:1});
  });
  const updated=db.saved[0].document;
  expect(updated.cards).toHaveLength(2);
  expect(updated.cards[0]).toEqual(original.cards[0]);
  expect(updated.reviews).toEqual(original.reviews);
  expect(updated.cards[1]).toMatchObject({front:{text:'to become',mode:'reference',language:'en-US'},back:{text:'I want to become fluent in English.',mode:'reference',language:'pt-BR'},version:0,archived:false,deleted:false});
  expect(updated.cards[1].memory).toBeUndefined();
 });

 it('prevents duplicate cards and distinct meanings unless the user approved them',async()=>{
  const db=fixture();
  const existing={id:'existing',deckId:'deck-en',front:{text:'to bet'},back:{text:'I do not like to bet.'},version:1,createdAt:'2026-01-01',updatedAt:'2026-01-01',archived:false,deleted:false};
  db.row.document.cards.push(existing);
  await withClient(db.store,async client=>{
   const duplicate=await client.callTool({name:'create_flashcards',arguments:{areaId:'area-en',cards:[{front:'TO BET',back:'I do not like to bet.'}]}});
   expect(duplicate.isError).toBe(true);expect(duplicate.content[0].text).toContain('DUPLICATE_CARD');
   const meaning=await client.callTool({name:'create_flashcards',arguments:{areaId:'area-en',cards:[{front:'to bet',back:'She bet on the blue horse.'}]}});
   expect(meaning.isError).toBe(true);expect(meaning.content[0].text).toContain('DUPLICATE_FRONT');
   const approved=await client.callTool({name:'create_flashcards',arguments:{areaId:'area-en',allowDifferentMeaning:true,cards:[{front:'to bet',back:'She bet on the blue horse.'}]}});
   expect(approved.structuredContent.saved).toBe(true);
  });
 });

 it('never writes to a missing or inactive area',async()=>{
  const db=fixture();
  await withClient(db.store,async client=>{
   const result=await client.callTool({name:'create_flashcards',arguments:{areaId:'unknown',cards:[{front:'Need',back:'I need help.'}]}});
   expect(result.isError).toBe(true);expect(result.content[0].text).toContain('MISSING_AREA');
   expect(db.saved).toHaveLength(0);
  });
 });
});
