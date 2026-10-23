import {McpServer} from '@modelcontextprotocol/sdk/server/mcp.js';
import {StreamableHTTPServerTransport} from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import {z} from 'zod';
import {prepareHandoff} from './chatgpt-handoff.js';

export function createImportServer(){
 const server=new McpServer({name:'brains-flashcard-import',version:'0.1.0'},{instructions:'Prepare one Brains flashcard only when the user asks. The tool returns a review link. It never accesses a Brains account or saves a card. The user chooses an area and approves in Brains.'});
 server.registerTool('prepare_flashcard',{
  title:'Preparar flashcard no Brains',
  description:'Create a temporary Brains review link for one flashcard and a ChatGPT-generated image. No card is saved until the user opens the link, signs in, selects an area, reviews and confirms.',
  inputSchema:{front:z.string().min(1).max(200),back:z.string().min(1).max(800),file:z.object({download_url:z.string(),file_id:z.string(),mime_type:z.string().optional(),file_name:z.string().optional()}).strict().optional(),withoutImage:z.boolean().optional()},
  outputSchema:{reviewUrl:z.string(),expiresInMinutes:z.number(),saved:z.boolean()},
  annotations:{readOnlyHint:true,destructiveHint:false,openWorldHint:false},
  _meta:{'openai/fileParams':['file']}
 },async args=>{
  try{const result={reviewUrl:prepareHandoff(args),expiresInMinutes:30,saved:false};return {structuredContent:result,content:[{type:'text',text:`Review the exact front, back and image in Brains before saving: ${result.reviewUrl}\nThis link expires in 30 minutes. No card has been saved.`}]}}
  catch{return {isError:true,content:[{type:'text',text:'The card needs non-empty front and back, plus a generated image reference. If the user explicitly wants no image, set withoutImage=true.'}]}}
 });
 return server;
}

export default async function handler(req,res){
 res.setHeader('Cache-Control','no-store');
 if(req.method!=='POST'){res.statusCode=405;res.setHeader('Allow','POST');return res.end()}
 if(Number(req.headers['content-length']||0)>16000){res.statusCode=413;return res.end()}
 const server=createImportServer(),transport=new StreamableHTTPServerTransport({sessionIdGenerator:undefined,enableJsonResponse:true,maxPostBodySize:16000});
 try{await server.connect(transport);await transport.handleRequest(req,res,req.body)}catch{if(!res.headersSent){res.statusCode=500;res.end()}}finally{await server.close().catch(()=>{})}
}
