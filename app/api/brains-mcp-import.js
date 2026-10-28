import {createClient} from '@supabase/supabase-js';
import {McpServer} from '@modelcontextprotocol/sdk/server/mcp.js';
import {StreamableHTTPServerTransport} from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import {z} from 'zod';

const APP_ORIGIN='https://www.heybrains.app';
const MAX_BODY=64*1024;
const MAX_BATCH=20;

const canonical=value=>value.normalize('NFKC').trim().replace(/\s+/g,' ').toLocaleLowerCase();

function activeCardsForArea(library,areaId){
 const deckIds=new Set(library.decks.filter(deck=>deck.areaId===areaId&&!deck.deleted&&!deck.archived).map(deck=>deck.id));
 return library.cards.filter(card=>deckIds.has(card.deckId)&&!card.deleted&&!card.archived);
}

function flashcard(deck,front,back,now=new Date().toISOString()){
 return {
  id:crypto.randomUUID(),deckId:deck.id,
  front:{text:front,mode:'reference',language:deck.language,audioText:''},
  back:{text:back,mode:'reference',language:'pt-BR',audioText:''},
  version:0,createdAt:now,updatedAt:now,archived:false,deleted:false
 };
}

function errorResult(error){
 const code=error instanceof Error?error.message:'SAVE_FAILED';
 const messages={
  MISSING_AREA:'No active area matches that choice. Call list_areas and ask the user which area to use.',
  MISSING_LIBRARY:'This account has no active Brains area yet. Ask the user to create an area in Brains first.',
  DUPLICATE_CARD:'A card with this front and back already exists in this area. Do not create another copy.',
  DUPLICATE_FRONT:'A card with this front already exists in this area with a different back. Ask the user to confirm that this is a distinct meaning, then retry with allowDifferentMeaning=true.',
  CONFLICT:'The Brains library changed during this request. Nothing was overwritten. Call list_areas and retry after confirming the cards with the user.',
  CLOUD_UNAVAILABLE:'Brains could not read the user library. No cards were saved; ask the user to retry later.',
  SAVE_FAILED:'Brains could not confirm the save. Check the library before retrying to avoid duplicates.',
  INVALID_LIBRARY:'The Brains library has an unsupported structure. No data was changed; contact Brains support.'
 };
 return {isError:true,content:[{type:'text',text:`${code}: ${messages[code]??'The cards could not be created. No library data was overwritten.'}`}]};
}

export function createImportServer(store,account={id:'',email:null}){
 const server=new McpServer({name:'brains-flashcard-import',title:'Brains — Criar flashcard',version:'0.3.4',websiteUrl:APP_ORIGIN,description:'Crie cards de texto no Brains depois de aprovar o conteúdo nesta conversa.',icons:[{src:`${APP_ORIGIN}/brains-plugin-logo-v1.svg`,mimeType:'image/svg+xml',sizes:['256x256']}]},{instructions:"This MCP is connected to a Brains account selected by ChatGPT through OAuth. Whenever the user asks which Brains account is connected, who is signed in, or asks for the account email or ID, ALWAYS call get_connected_account before answering. State the returned email; if no email is available, state the stable account ID. Never say that this integration cannot provide account identity, and never offer listing areas as a substitute. When the user names a target Brains account or says they have multiple connected accounts, also call get_connected_account first and confirm whether this OAuth connection matches the requested account before listing areas or creating cards. If the requested account is not connected, do not use the current account as a substitute; guide the user to ChatGPT Settings > Plugins or Apps > Brains > Connected accounts > Connect another account, when available. After connection, call get_connected_account again and confirm the account. Never claim to switch accounts yourself or access another account through the current connection. If no account is specified, use the OAuth connection selected by ChatGPT. If the user asks which account it is, call get_connected_account and state the result. Call list_areas when the target area is unclear. Draft front and back, show the exact content and target area, and wait for the user to explicitly approve before create_flashcards. Never infer approval from a request to prepare a proposal. Only active, non-archived cards count as duplicates; deleted or archived cards may be recreated. Explain active duplicates and ask for separate explicit confirmation before retrying. Save only the exact approved text. This integration does not transfer images or audio files. Reference voice playback is provided by Brains; recordings are made in the Brains app."});

 server.registerTool('get_connected_account',{
  title:'Identificar conta Brains conectada',
  description:'SEMPRE chame esta ferramenta antes de responder se o usuário perguntar qual conta Brains está conectada, quem está conectado ou pedir o e-mail/ID da conta. Informe o e-mail retornado ou, se ausente, o ID estável. Nunca diga que a integração não disponibiliza essa identidade. A ferramenta retorna somente a identidade autenticada nesta conexão; não enumera nem acessa outras contas.',
  inputSchema:{},outputSchema:{account:z.object({accountId:z.string(),email:z.string().email().nullable()})},
  annotations:{readOnlyHint:true,destructiveHint:false,openWorldHint:false}
 },async()=>{
  const profile={accountId:String(account.id??''),email:typeof account.email==='string'&&account.email?account.email:null};
  const response={account:profile};
  return {structuredContent:response,content:[{type:'text',text:`Conta Brains conectada: ${profile.email??`ID ${profile.accountId}`}.`}]};
 });

 server.registerTool('list_areas',{
  title:'Listar áreas do Brains',
  description:'Lista apenas as áreas ativas desta conexão. Se houver várias contas conectadas ou uma conta específica for solicitada, confirme a conta com get_connected_account antes de listar.',
  inputSchema:{},outputSchema:{areas:z.array(z.object({id:z.string(),name:z.string(),language:z.string(),cardCount:z.number()}))},
  annotations:{readOnlyHint:true,destructiveHint:false,openWorldHint:false}
 },async()=>{
  try{
   const row=await store.read();
   if(!row)return {structuredContent:{areas:[]},content:[{type:'text',text:'Nenhuma área ativa foi encontrada. Crie uma área no Brains antes de importar cards.'}]};
   const library=row.document;
   if(!Array.isArray(library?.areas)||!Array.isArray(library?.decks)||!Array.isArray(library?.cards))throw Error('INVALID_LIBRARY');
   const areas=library.areas.filter(area=>!area.deleted&&!area.archived).flatMap(area=>{
    const decks=library.decks.filter(deck=>deck.areaId===area.id&&!deck.deleted&&!deck.archived);
    if(!decks.length)return [];
    return [{id:area.id,name:area.name,language:decks[0].language,cardCount:activeCardsForArea(library,area.id).length}];
   });
   return {structuredContent:{areas},content:[{type:'text',text:areas.length?JSON.stringify(areas):'Nenhuma área ativa foi encontrada. Crie uma área no Brains antes de importar cards.'}]};
  }catch(error){return errorResult(error)}
 });

 server.registerTool('create_flashcards',{
  title:'Salvar cards aprovados no Brains',
  description:'Salva de 1 a 20 cards de texto na área escolhida da conta autenticada. IMPORTANTE: só chame depois de mostrar ao usuário a área e o texto exato de todos os cards e receber aprovação explícita nesta conversa. Esta ação grava os cards imediatamente no Brains. Não recebe imagem nem arquivo de áudio; a voz de referência do app funciona nos dois lados.',
  inputSchema:{areaId:z.string().min(1).max(100),cards:z.array(z.object({front:z.string().trim().min(1).max(200),back:z.string().trim().min(1).max(800)}).strict()).min(1).max(MAX_BATCH),allowDifferentMeaning:z.boolean().optional().describe('Use true only if the user explicitly approved a distinct meaning for a front that already exists in the chosen area.')},
  outputSchema:{saved:z.boolean(),areaName:z.string(),count:z.number(),cards:z.array(z.object({front:z.string(),back:z.string()}))},
  annotations:{readOnlyHint:false,destructiveHint:false,idempotentHint:false,openWorldHint:false}
 },async({areaId,cards,allowDifferentMeaning=false})=>{
  try{
   if(!cards.length||cards.length>MAX_BATCH)throw Error('SAVE_FAILED');
   for(let attempt=0;attempt<3;attempt++){
    const row=await store.read();
    if(!row)throw Error('MISSING_LIBRARY');
    const library=row.document;
    if(!Array.isArray(library?.areas)||!Array.isArray(library?.decks)||!Array.isArray(library?.cards)||!Array.isArray(library?.reviews)){
     if(!Array.isArray(library?.reviews)&&library?.reviews===undefined)library.reviews=[];
     else throw Error('INVALID_LIBRARY');
    }
    const area=library.areas.find(item=>item.id===areaId&&!item.deleted&&!item.archived);
    if(!area)throw Error('MISSING_AREA');
    const decks=library.decks.filter(item=>item.areaId===area.id&&!item.deleted&&!item.archived);
    const deck=decks[0];
    if(!deck)throw Error('MISSING_AREA');
    const seen=new Map();
    for(const card of activeCardsForArea(library,area.id)){
     const front=canonical(card.front.text),back=canonical(card.back.text);
     if(!seen.has(front))seen.set(front,new Set());seen.get(front).add(back);
    }
    const batchSeen=new Map();
    for(const card of cards){
     const front=canonical(card.front),back=canonical(card.back);
     const stored=seen.get(front)??new Set(),pending=batchSeen.get(front)??new Set();
     if(stored.has(back)||pending.has(back))throw Error('DUPLICATE_CARD');
     if((stored.size||pending.size)&&!allowDifferentMeaning)throw Error('DUPLICATE_FRONT');
     pending.add(back);batchSeen.set(front,pending);
    }
    const now=new Date().toISOString();
    const updated=structuredClone(library);
    const created=cards.map(card=>flashcard(deck,card.front.trim(),card.back.trim(),now));
    updated.cards.push(...created);
    const operationId=crypto.randomUUID();
    try{
     await store.save(row.version,operationId,updated);
     const response={saved:true,areaName:area.name,count:created.length,cards:created.map(({front,back})=>({front:front.text,back:back.text}))};
     return {structuredContent:response,content:[{type:'text',text:`Salvei ${response.count} ${response.count===1?'card':'cards'} na área “${response.areaName}”. O Brains usará a voz de referência para a frente e o verso. Nenhum arquivo de imagem ou áudio foi importado.`}]};
    }catch(error){
     if(error instanceof Error&&error.message==='CONFLICT'&&attempt<2)continue;
     throw error;
    }
   }
   throw Error('CONFLICT');
  }catch(error){return errorResult(error)}
 });
 return server;
}

function setting(...names){for(const name of names){const value=process.env[name];if(value)return value}return ''}
// Read this claim only after Supabase Auth has verified the token with getUser.
export function clientIdFromToken(token){
 try{const parts=token.split('.');if(parts.length!==3)return '';return JSON.parse(Buffer.from(parts[1],'base64url').toString('utf8')).client_id??''}catch{return ''}
}

async function authenticatedStore(req){
 const match=/^Bearer\s+(.+)$/i.exec(String(req.headers.authorization??''));
 if(!match)return {error:'unauthorized'};
 const url=setting('SUPABASE_URL','VITE_SUPABASE_URL');
 const key=setting('SUPABASE_PUBLISHABLE_KEY','VITE_SUPABASE_PUBLISHABLE_KEY');
 const allowedClientId=setting('BRAINS_CHATGPT_CLIENT_ID','VITE_BRAINS_CHATGPT_CLIENT_ID');
 if(!url||!key||!allowedClientId)return {error:'configuration'};
 const token=match[1];
 const client=createClient(url,key,{global:{headers:{Authorization:`Bearer ${token}`}},auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false}});
 const {data,error}=await client.auth.getUser(token);
 if(error||!data.user)return {error:'unauthorized'};
 if(clientIdFromToken(token)!==allowedClientId)return {error:'forbidden'};
 return {account:{id:data.user.id,email:data.user.email??null},store:{
  async read(){
   const result=await client.from('brains_cloud').select('version,document').eq('user_id',data.user.id).maybeSingle();
   if(result.error)throw Error('CLOUD_UNAVAILABLE');
   return result.data;
  },
  async save(version,operationId,document){
   const args={expected_version:version,operation_id:operationId,payload:document};
   let result=await client.rpc('brains_cloud_save',args);
   if(result.error&&!result.error.message.includes('conflict'))result=await client.rpc('brains_cloud_save',args);
   if(result.error)throw Error(result.error.message.includes('conflict')?'CONFLICT':'SAVE_FAILED');
   return result.data;
  }
 }};
}

export default async function handler(req,res){
 res.setHeader('Cache-Control','no-store');
 if(req.method!=='POST'){res.statusCode=405;res.setHeader('Allow','POST');return res.end()}
 if(Number(req.headers['content-length']||0)>MAX_BODY){res.statusCode=413;return res.end()}
 let store,account;
 try{
  const auth=await authenticatedStore(req);
  if(auth.error){
   if(auth.error==='configuration'){res.statusCode=503;return res.end('Brains authentication is not configured.')}
   if(auth.error==='forbidden'){res.statusCode=403;return res.end('This OAuth client is not authorized for Brains.')}
   const resourceMetadata=`${APP_ORIGIN}/.well-known/oauth-protected-resource`;
   res.statusCode=401;res.setHeader('WWW-Authenticate',`Bearer realm="Brains", resource_metadata="${resourceMetadata}"`);return res.end('Authentication required.');
  }
  store=auth.store;account=auth.account;
 }catch{res.statusCode=401;res.setHeader('WWW-Authenticate',`Bearer realm="Brains", resource_metadata="${APP_ORIGIN}/.well-known/oauth-protected-resource"`);return res.end('Authentication required.')}
 const server=createImportServer(store,account),transport=new StreamableHTTPServerTransport({sessionIdGenerator:undefined,enableJsonResponse:true,maxPostBodySize:MAX_BODY});
 try{await server.connect(transport);await transport.handleRequest(req,res,req.body)}catch{if(!res.headersSent){res.statusCode=500;res.end('MCP request failed.')}}finally{await server.close().catch(()=>{})}
}
