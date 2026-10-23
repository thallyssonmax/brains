import {McpServer} from '@modelcontextprotocol/sdk/server/mcp.js';
import {StreamableHTTPServerTransport} from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import {z} from 'zod';
import {mcpFileReference} from './chatgpt-image-probe.js';

export function createPreviewServer(){
 const server=new McpServer({name:'brains-image-reference-preview',version:'0.1.0'},{instructions:'Technical test only. This server does not download images, access Brains accounts or save cards.'});
 server.registerTool('check_image_reference',{
  title:'Conferir referência de imagem',
  description:'Checks whether ChatGPT can pass one generated image to the Brains plugin. Returns only file type and source host; it does not download or store anything.',
  inputSchema:{file:z.object({download_url:z.string(),file_id:z.string(),mime_type:z.string().optional(),file_name:z.string().optional()}).strict()},
  outputSchema:{received:z.boolean(),host:z.string(),declaredMime:z.string()},
  annotations:{readOnlyHint:true,destructiveHint:false,openWorldHint:false},
  _meta:{'openai/fileParams':['file']}
 },async ({file})=>{
  const reference=mcpFileReference(file);
  if(!reference)return {isError:true,content:[{type:'text',text:'Unsupported file reference.'}]};
  const result={received:true,host:reference.url.hostname,declaredMime:file.mime_type??'unknown'};
  return {structuredContent:result,content:[{type:'text',text:`Image reference received from ${result.host}; declared type ${result.declaredMime}. Nothing was downloaded or saved.`}]};
 });
 return server;
}

export default async function handler(req,res){
 res.setHeader('Cache-Control','no-store');
 if(req.method!=='POST'){res.statusCode=405;res.setHeader('Allow','POST');return res.end()}
 if(Number(req.headers['content-length']||0)>12000){res.statusCode=413;return res.end()}
 const server=createPreviewServer();
 const transport=new StreamableHTTPServerTransport({sessionIdGenerator:undefined,enableJsonResponse:true,maxPostBodySize:12000});
 try{await server.connect(transport);await transport.handleRequest(req,res,req.body)}
 catch{if(!res.headersSent){res.statusCode=500;res.end()}}
 finally{await server.close().catch(()=>{})}
}
