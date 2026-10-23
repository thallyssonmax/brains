import {McpServer} from '@modelcontextprotocol/sdk/server/mcp.js';
import {StreamableHTTPServerTransport} from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import {z} from 'zod';
import {prepareHandoff} from './chatgpt-handoff.js';

export function createImportServer(){
 const server=new McpServer({name:'brains-flashcard-import',title:'Brains — Criar flashcard',version:'0.2.0',websiteUrl:'https://www.heybrains.app',description:'Das palavras da conversa para a memória: prepare um flashcard para revisão no Brains.',icons:[{src:'https://www.heybrains.app/brains-plugin-logo.svg',mimeType:'image/svg+xml',sizes:['256x256']}]},{instructions:'Only prepare one flashcard when the user explicitly asks. Keep the front focused and the back simple and contextual. When the user wants an image, attach the exact image generated in this ChatGPT conversation; favor a clear scene without text or card borders. Return a link labeled “Revisar flashcard no Brains” and state that nothing was saved. The user chooses an area, reviews and confirms inside Brains. This plugin never reads a Brains account or saves a card.'});
 server.registerTool('prepare_flashcard',{
  title:'Preparar flashcard para revisar no Brains',
  description:'Prepare a temporary Brains review link for one flashcard with the exact image generated in this ChatGPT conversation. The user edits, chooses an area and confirms in Brains; this tool never saves a card.',
  icons:[{src:'https://www.heybrains.app/brains-plugin-logo.svg',mimeType:'image/svg+xml',sizes:['256x256']}],
  inputSchema:{front:z.string().min(1).max(200),back:z.string().min(1).max(800),file:z.object({download_url:z.string(),file_id:z.string(),mime_type:z.string().optional(),file_name:z.string().optional()}).strict().optional(),withoutImage:z.boolean().optional()},
  outputSchema:{reviewUrl:z.string(),expiresInMinutes:z.number(),saved:z.boolean()},
  annotations:{readOnlyHint:true,destructiveHint:false,openWorldHint:false},
  _meta:{'openai/fileParams':['file']}
 },async args=>{
  try{const result={reviewUrl:prepareHandoff(args),expiresInMinutes:30,saved:false};return {structuredContent:result,content:[{type:'text',text:`Revisar flashcard no Brains: ${result.reviewUrl}\nConfira frente, verso e imagem. O link expira em 30 minutos. Nenhum card foi salvo.`}]}}
  catch{return {isError:true,content:[{type:'text',text:'Preencha frente e verso e inclua a referência da imagem gerada. Se o usuário escolher explicitamente um card sem imagem, use withoutImage=true.'}]}}
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
