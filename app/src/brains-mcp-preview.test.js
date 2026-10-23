import {describe,it,expect} from 'vitest';
import {Client} from '@modelcontextprotocol/sdk/client/index.js';
import {InMemoryTransport} from '@modelcontextprotocol/sdk/inMemory.js';
import {createPreviewServer} from '../api/brains-mcp-preview.js';

describe('public metadata-only MCP preview',()=>{
 it('accepts a generated-image reference without fetching or saving it',async()=>{
  const server=createPreviewServer();
  const client=new Client({name:'brains-test',version:'1.0.0'});
  const [clientTransport,serverTransport]=InMemoryTransport.createLinkedPair();
  try{
   await server.connect(serverTransport);await client.connect(clientTransport);
   const {tools}=await client.listTools();
   expect(tools[0]._meta['openai/fileParams']).toEqual(['file']);
   const result=await client.callTool({name:'check_image_reference',arguments:{file:{download_url:'https://files.oaiusercontent.com/example?se=x',file_id:'file_12345678',mime_type:'image/png'}}});
   expect(result.structuredContent).toEqual({received:true,host:'files.oaiusercontent.com',declaredMime:'image/png'});
  }finally{await client.close();await server.close()}
 });
});
