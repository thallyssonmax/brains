import {describe,it,expect} from 'vitest';
import {Client} from '@modelcontextprotocol/sdk/client/index.js';
import {InMemoryTransport} from '@modelcontextprotocol/sdk/inMemory.js';
import {createBrainsProbeServer} from '../api/brains-mcp.js';
import {fetchImage,mcpFileReference} from '../api/chatgpt-image-probe.js';

describe('Brains private MCP probe',()=>{
 it('advertises a file input and verifies image bytes without a Brains account',async()=>{
  const bytes=Buffer.from([137,80,78,71,13,10,26,10,0,1]);
  const server=createBrainsProbeServer(async()=>new Response(bytes));
  const client=new Client({name:'brains-test',version:'1.0.0'});
  const [clientTransport,serverTransport]=InMemoryTransport.createLinkedPair();
  try{
   await server.connect(serverTransport);
   await client.connect(clientTransport);
   const {tools}=await client.listTools();
   expect(tools).toHaveLength(1);
   expect(tools[0]._meta['openai/fileParams']).toEqual(['file']);
   expect(tools[0].inputSchema.properties.file.required).toEqual(['download_url','file_id']);
   const result=await client.callTool({name:'verify_generated_image',arguments:{file:{download_url:'https://files.oaiusercontent.com/file-12345678?x=1',file_id:'file-12345678'}}});
   expect(result.structuredContent).toMatchObject({verified:true,mime:'image/png',size:bytes.length});
  }finally{await client.close();await server.close()}
 });
 it('classifies unsupported, oversized and inaccessible image bytes safely',async()=>{
  const reference=mcpFileReference({download_url:'https://files.oaiusercontent.com/file?sig=x',file_id:'file_12345678'});
  await expect(fetchImage(reference,async()=>new Response(Buffer.from('not an image')))).rejects.toThrow('UNSUPPORTED_IMAGE_FORMAT');
  await expect(fetchImage(reference,async()=>new Response(new Uint8Array(5*1024*1024+1)))).rejects.toThrow('IMAGE_TOO_LARGE');
  await expect(fetchImage(reference,async()=>new Response(null,{status:403}))).rejects.toThrow('IMAGE_ACCESS_FAILED');
  await expect(fetchImage(reference,async()=>{throw Error('network')})).rejects.toThrow('IMAGE_ACCESS_FAILED');
 });
});
