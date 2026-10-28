import {McpServer} from '@modelcontextprotocol/sdk/server/mcp.js';
import {StreamableHTTPServerTransport} from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import {z} from 'zod';
import {prepareHandoff} from './chatgpt-handoff.js';

const MAX_REQUEST_BYTES=16_000;
const imageFile=z.object({
 download_url:z.string(),
 file_id:z.string(),
 mime_type:z.string().optional(),
 file_name:z.string().optional()
}).strict();

export function createPrepareServer(){
 const server=new McpServer({
  name:'brains-flashcard-import',
  title:'Brains — Criar flashcard',
  version:'1.2.0',
  websiteUrl:'https://www.heybrains.app',
  description:'Das palavras da conversa para a memória: prepare um flashcard para revisão no Brains.',
  icons:[{src:'https://www.heybrains.app/brains-plugin-logo.svg',mimeType:'image/svg+xml',sizes:['256x256']}]
 },{
  instructions:'Only prepare a flashcard when the user explicitly asks. Keep the front focused and the back simple and contextual. When the user requests an image, pass the actual ChatGPT file attachment through the file input; never pass a local path, sandbox URI, or bare file ID. If an image was created in code, attach it to the conversation first so ChatGPT can provide its file reference. Never set withoutImage unless the user explicitly chose a card without an image; on transfer failure, report the error and ask the user to attach or retry the image. Favor a clear scene without text or card borders. Return a link labeled “Revisar flashcard no Brains” and state that nothing was saved. The user chooses an area, reviews, and confirms inside Brains. This plugin never reads a Brains account or saves a card.'
 });

 server.registerTool('prepare_flashcard',{
  title:'Preparar flashcard para revisar no Brains',
  description:'Prepare a temporary Brains review link for one flashcard. When an image is requested, pass the actual ChatGPT attachment using the file object {download_url,file_id,mime_type?,file_name?}. Do not pass a local path, sandbox URI, or bare file ID. A code-generated image must first be attached to the conversation. Set withoutImage=true only when the user explicitly chose no image. The user edits, chooses an area and confirms in Brains; this tool never saves a card.',
  icons:[{src:'https://www.heybrains.app/brains-plugin-logo.svg',mimeType:'image/svg+xml',sizes:['256x256']}],
  inputSchema:{
   front:z.string().min(1).max(200).describe('Text shown on the front of the flashcard.'),
   back:z.string().min(1).max(800).describe('Answer or contextual sentence shown on the back.'),
   file:imageFile.optional().describe('Actual ChatGPT file attachment. Must include download_url and file_id. Local paths, sandbox URIs, and bare file IDs are not valid references.'),
   withoutImage:z.boolean().optional().describe('Set true only when the user explicitly chose a card without an image. Never use as a fallback for image transfer failure.')
  },
  outputSchema:{reviewUrl:z.string(),expiresInMinutes:z.number(),saved:z.boolean()},
  annotations:{readOnlyHint:true,destructiveHint:false,openWorldHint:false},
  _meta:{'openai/fileParams':['file']}
 },async args=>{
  try{
   const result={reviewUrl:prepareHandoff(args),expiresInMinutes:30,saved:false};
   return {structuredContent:result,content:[{type:'text',text:`Revisar flashcard no Brains: ${result.reviewUrl}\nConfira frente, verso e imagem. O link expira em 30 minutos. Nenhum card foi salvo.`}]};
  }catch(error){
   const code=error instanceof Error?error.message:'IMAGE_PROCESSING_FAILED';
   const messages={
    MISSING_FRONT:'Provide non-empty front text.',
    FRONT_TOO_LONG:'Front text exceeds 200 characters.',
    MISSING_BACK:'Provide non-empty back text.',
    BACK_TOO_LONG:'Back text exceeds 800 characters.',
    MISSING_IMAGE:'The user requested an image, but no ChatGPT file attachment was received. Attach the image and retry; do not switch to withoutImage.',
    INVALID_IMAGE_REFERENCE:'The file reference is not a supported ChatGPT attachment. Pass the file object, not a path, sandbox URI, or bare file ID.',
    IMAGE_ACCESS_FAILED:'The image could not be accessed. Ask the user to attach the image again and retry.',
    UNSUPPORTED_IMAGE_FORMAT:'Use a PNG, JPEG, or WebP image.',
    IMAGE_TOO_LARGE:'The image exceeds the 5 MiB limit.',
    IMAGE_PROCESSING_FAILED:'The image could not be prepared. Ask the user to retry.'
   };
   return {isError:true,content:[{type:'text',text:`${code}: ${messages[code]??'The flashcard draft could not be prepared. Check front, back, and the image file reference.'}`}]};
  }
 });
 return server;
}

export default async function handler(req,res){
 res.setHeader('Cache-Control','no-store');
 if(req.method!=='POST'){res.statusCode=405;res.setHeader('Allow','POST');return res.end()}
 if(Number(req.headers['content-length']||0)>MAX_REQUEST_BYTES){res.statusCode=413;return res.end()}
 const server=createPrepareServer();
 const transport=new StreamableHTTPServerTransport({sessionIdGenerator:undefined,enableJsonResponse:true,maxPostBodySize:MAX_REQUEST_BYTES});
 try{
  await server.connect(transport);
  await transport.handleRequest(req,res,req.body);
 }catch{
  if(!res.headersSent){res.statusCode=500;res.end()}
 }finally{
  await server.close().catch(()=>{});
 }
}
