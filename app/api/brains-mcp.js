import {McpServer} from '@modelcontextprotocol/sdk/server/mcp.js';
import {StreamableHTTPServerTransport} from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import {z} from 'zod';
import {inspectImage,mcpFileReference,validProbeKey} from './chatgpt-image-probe.js';

const file=z.object({
 download_url:z.string(),
 file_id:z.string(),
 mime_type:z.string().optional(),
 file_name:z.string().optional()
}).strict();

export function createBrainsProbeServer(download=fetch){
 const server=new McpServer(
  {name:'brains-image-transfer-probe',version:'0.1.0'},
  {instructions:'Private transfer test only. Call verify_generated_image only when the user explicitly asks to test an image from this conversation. This tool cannot save cards or access a Brains account.'}
 );
 server.registerTool('verify_generated_image',{
  title:'Verificar imagem gerada',
  description:'Verifies the bytes of one image generated or uploaded in this ChatGPT conversation. Returns type, size and SHA-256. Does not save a card or access Brains user data.',
  inputSchema:{file},
  outputSchema:{verified:z.boolean(),mime:z.string(),size:z.number(),sha256:z.string()},
  annotations:{readOnlyHint:true,destructiveHint:false,openWorldHint:true},
  _meta:{'openai/fileParams':['file']}
 },async ({file})=>{
  const reference=mcpFileReference(file);
  if(!reference)return {isError:true,content:[{type:'text',text:'Invalid or unsupported image reference.'}]};
  try{
   const result={verified:true,...await inspectImage(reference,download)};
   return {structuredContent:result,content:[{type:'text',text:`Image verified: ${result.mime}, ${result.size} bytes, SHA-256 ${result.sha256}. Nothing was saved.`}]};
  }catch{return {isError:true,content:[{type:'text',text:'Image unavailable, expired, too large or unsupported.'}]}}
 });
 return server;
}

export default async function handler(req,res){
 res.setHeader('Cache-Control','no-store');
 if(req.method!=='POST'){
  res.statusCode=405;res.setHeader('Allow','POST');return res.end();
 }
 if(Number(req.headers['content-length']||0)>12000){res.statusCode=413;return res.end()}
 const key=process.env.BRAINS_CHATGPT_PROBE_KEY;
 if(!key){res.statusCode=503;return res.end()}
 if(!validProbeKey(req.headers.authorization,key)){res.statusCode=401;return res.end()}
 const server=createBrainsProbeServer();
 const transport=new StreamableHTTPServerTransport({sessionIdGenerator:undefined,enableJsonResponse:true,maxPostBodySize:12000});
 try{await server.connect(transport);await transport.handleRequest(req,res,req.body)}
 catch{if(!res.headersSent){res.statusCode=500;res.end()}}
 finally{await server.close().catch(()=>{})}
}
