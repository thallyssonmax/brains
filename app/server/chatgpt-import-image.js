import {createClient} from '@supabase/supabase-js';
import {readHandoff} from './chatgpt-handoff.js';
import {fetchImage,mcpFileReference} from '../api/chatgpt-image-probe.js';

export async function handleChatGPTImportImage(req,res){
 res.setHeader('Cache-Control','no-store');
 if(req.method!=='POST'){res.statusCode=405;res.setHeader('Allow','POST');return res.end()}
 if(Number(req.headers['content-length']||0)>16000){res.statusCode=413;return res.end()}
 const token=/^Bearer (\S+)$/.exec(req.headers.authorization??'')?.[1];
 const url=process.env.SUPABASE_URL??process.env.VITE_SUPABASE_URL;
 const key=process.env.SUPABASE_PUBLISHABLE_KEY??process.env.VITE_SUPABASE_PUBLISHABLE_KEY;
 if(!token||!url||!key){res.statusCode=401;return res.end()}
 const client=createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false}});
 const {data,error}=await client.auth.getUser(token);
 if(error||!data.user){res.statusCode=401;return res.end()}
 try{
  const payload=readHandoff(req.body?.payload);
  const reference=mcpFileReference(payload.file);
  if(!reference)throw Error('invalid_image');
  const image=await fetchImage(reference);
  res.statusCode=200;res.setHeader('Content-Type',image.mime);res.setHeader('Content-Length',String(image.size));res.setHeader('X-Content-Type-Options','nosniff');res.end(image.bytes);
 }catch(error){
  const code=error instanceof Error?error.message:'IMAGE_ACCESS_FAILED';
  const allowed=new Set(['invalid_handoff','expired_handoff','invalid_image','IMAGE_ACCESS_FAILED','UNSUPPORTED_IMAGE_FORMAT','IMAGE_TOO_LARGE']);
  const safeCode=allowed.has(code)?code:'IMAGE_ACCESS_FAILED';
  res.statusCode=422;res.setHeader('Content-Type','application/json; charset=utf-8');res.end(JSON.stringify({code:safeCode}));
 }
}
