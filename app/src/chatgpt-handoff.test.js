import {describe,it,expect} from 'vitest';
import {Client} from '@modelcontextprotocol/sdk/client/index.js';
import {InMemoryTransport} from '@modelcontextprotocol/sdk/inMemory.js';
import {prepareHandoff,readHandoff} from '../server/chatgpt-handoff.js';
import {createPrepareServer} from '../api/brains-mcp-prepare.js';

const file={download_url:'https://files.oaiusercontent.com/example?se=x',file_id:'file_12345678',mime_type:'image/png'};
describe('ChatGPT review handoff',()=>{
 it('passes exact text and image only through a short-lived review link',()=>{
  const url=prepareHandoff({front:'  Need  ',back:'I need help.',file},1000);
  expect(url).toMatch(/^https:\/\/www\.heybrains\.app\/import\/chatgpt#payload=/);
  const value=new URL(url).hash.slice('#payload='.length);
  expect(readHandoff(value,2000)).toMatchObject({front:'Need',back:'I need help.',file});
  expect(()=>readHandoff(value,31*60*1000)).toThrow('expired_handoff');
 });
 it('rejects external image hosts, blank text and accidental missing images',()=>{
  expect(()=>prepareHandoff({front:'x',back:'y',file:{...file,download_url:'https://example.com/x'}})).toThrow('INVALID_IMAGE_REFERENCE');
  expect(()=>prepareHandoff({front:' ',back:'y',file})).toThrow('MISSING_FRONT');
  expect(()=>prepareHandoff({front:'x',back:' ',file})).toThrow('MISSING_BACK');
  expect(()=>prepareHandoff({front:'x',back:'y'})).toThrow('MISSING_IMAGE');
  expect(prepareHandoff({front:'x',back:'y',withoutImage:true})).toContain('#payload=');
 });
 it('exposes a read-only tool without account or database access',async()=>{
  const server=createPrepareServer(),client=new Client({name:'test',version:'1.0.0'});
  const [a,b]=InMemoryTransport.createLinkedPair();
  try{await server.connect(b);await client.connect(a);const {tools}=await client.listTools();expect(tools[0]._meta['openai/fileParams']).toEqual(['file']);expect(tools[0].inputSchema.properties.file.required).toEqual(['download_url','file_id']);expect(Object.keys(tools[0].inputSchema.properties.file.properties)).toEqual(['download_url','file_id','mime_type','file_name']);const result=await client.callTool({name:'prepare_flashcard',arguments:{front:'Need',back:'I need help.',file}});expect(result.structuredContent.saved).toBe(false);expect(result.structuredContent.reviewUrl).toContain('/import/chatgpt#payload=')}
  finally{await client.close();await server.close()}
 });
 it('keeps three image references paired with separate drafts and never saves them',async()=>{
  const server=createPrepareServer(),client=new Client({name:'test-batch',version:'1.0.0'});
  const [a,b]=InMemoryTransport.createLinkedPair();
  const cards=[
   {front:'to become',back:'I want to become fluent in English.',file:{...file,file_id:'file_become01',download_url:'https://files.oaiusercontent.com/become.png?sig=1'}},
   {front:'to bet',back:'I don’t like to bet.',file:{...file,file_id:'file_bet00001',download_url:'https://files.oaiusercontent.com/bet.png?sig=2'}},
   {front:'to bite',back:'My son loves to bite his toys.',file:{...file,file_id:'file_bite0001',download_url:'https://files.oaiusercontent.com/bite.png?sig=3'}}
  ];
  try{
   await server.connect(b);await client.connect(a);
   for(const card of cards){
    const result=await client.callTool({name:'prepare_flashcard',arguments:card});
    expect(result.structuredContent.saved).toBe(false);
    const payload=readHandoff(new URL(result.structuredContent.reviewUrl).hash.slice('#payload='.length));
    expect(payload).toMatchObject({front:card.front,back:card.back,file:{file_id:card.file.file_id,download_url:card.file.download_url}});
   }
  }finally{await client.close();await server.close()}
 });
 it('returns diagnostic codes for a missing or unsupported image reference',async()=>{
  const server=createPrepareServer(),client=new Client({name:'test-errors',version:'1.0.0'});
  const [a,b]=InMemoryTransport.createLinkedPair();
  try{
   await server.connect(b);await client.connect(a);
   const missing=await client.callTool({name:'prepare_flashcard',arguments:{front:'Need',back:'I need help.'}});
   expect(missing.content[0].text).toContain('MISSING_IMAGE');
   const invalid=await client.callTool({name:'prepare_flashcard',arguments:{front:'Need',back:'I need help.',file:{...file,download_url:'https://example.com/image.png'}}});
   expect(invalid.content[0].text).toContain('INVALID_IMAGE_REFERENCE');
   const path=await client.callTool({name:'prepare_flashcard',arguments:{front:'Need',back:'I need help.',file:'/mnt/data/image.png'}});
   expect(path.content[0].text).toContain('expected object, received string at file');
  }finally{await client.close();await server.close()}
 });
});
