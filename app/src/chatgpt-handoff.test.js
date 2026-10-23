import {describe,it,expect} from 'vitest';
import {Client} from '@modelcontextprotocol/sdk/client/index.js';
import {InMemoryTransport} from '@modelcontextprotocol/sdk/inMemory.js';
import {prepareHandoff,readHandoff} from '../api/chatgpt-handoff.js';
import {createImportServer} from '../api/brains-mcp-import.js';

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
  expect(()=>prepareHandoff({front:'x',back:'y',file:{...file,download_url:'https://example.com/x'}})).toThrow();
  expect(()=>prepareHandoff({front:' ',back:'y',file})).toThrow();
  expect(()=>prepareHandoff({front:'x',back:'y'})).toThrow();
  expect(prepareHandoff({front:'x',back:'y',withoutImage:true})).toContain('#payload=');
 });
 it('exposes a read-only tool without account or database access',async()=>{
  const server=createImportServer(),client=new Client({name:'test',version:'1.0.0'});
  const [a,b]=InMemoryTransport.createLinkedPair();
  try{await server.connect(b);await client.connect(a);const {tools}=await client.listTools();expect(tools[0]._meta['openai/fileParams']).toEqual(['file']);const result=await client.callTool({name:'prepare_flashcard',arguments:{front:'Need',back:'I need help.',file}});expect(result.structuredContent.saved).toBe(false);expect(result.structuredContent.reviewUrl).toContain('/import/chatgpt#payload=')}
  finally{await client.close();await server.close()}
 });
});
