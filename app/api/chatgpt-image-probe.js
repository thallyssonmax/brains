import {createHash,timingSafeEqual} from 'node:crypto';

const MAX_BYTES=5*1024*1024;
const reply=(res,status,body)=>{res.statusCode=status;res.setHeader('Content-Type','application/json; charset=utf-8');res.setHeader('Cache-Control','no-store');res.end(JSON.stringify(body))};
export function validProbeKey(header,secret){
 if(typeof header!=='string'||typeof secret!=='string'||secret.length<32)return false;
 const token=/^Bearer ([A-Za-z0-9_-]{32,128})$/.exec(header)?.[1];
 if(!token)return false;
 const supplied=createHash('sha256').update(token).digest();
 const expected=createHash('sha256').update(secret).digest();
 return timingSafeEqual(supplied,expected);
}

function trustedImageUrl(value){
 let url;
 try{url=new URL(value)}catch{return null}
 if(url.protocol!=='https:'||url.username||url.password||url.port||!/^(?:files|sdmntpr[a-z0-9-]{1,40})\.oaiusercontent\.com$/.test(url.hostname))return null;
 return url;
}

export function fileReference(body){
 const files=body?.openaiFileIdRefs;
 if(!Array.isArray(files)||files.length!==1)return null;
 const file=files[0];
 if(!file||typeof file!=='object'||typeof file.id!=='string'||!/^file[-_][A-Za-z0-9_-]{8,120}$/.test(file.id)||typeof file.download_link!=='string')return null;
 const url=trustedImageUrl(file.download_link);
 if(!url)return null;
 return {id:file.id,url};
}

export function mcpFileReference(file){
 if(!file||typeof file!=='object'||typeof file.file_id!=='string'||!/^file[-_][A-Za-z0-9_-]{8,120}$/.test(file.file_id)||typeof file.download_url!=='string')return null;
 const url=trustedImageUrl(file.download_url);
 return url?{id:file.file_id,url}:null;
}

export function imageMime(bytes){
 if(bytes.length>=8&&bytes.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10])))return 'image/png';
 if(bytes.length>=3&&bytes[0]===255&&bytes[1]===216&&bytes[2]===255)return 'image/jpeg';
 if(bytes.length>=12&&bytes.toString('ascii',0,4)==='RIFF'&&bytes.toString('ascii',8,12)==='WEBP')return 'image/webp';
 return null;
}

export async function inspectImage(reference,download=fetch){
 const response=await download(reference.url,{redirect:'error',signal:AbortSignal.timeout(8000),headers:{Accept:'image/png,image/jpeg,image/webp'}});
 if(!response.ok||!response.body)throw Error('download');
 const length=Number(response.headers.get('content-length'));
 if(Number.isFinite(length)&&length>MAX_BYTES)throw Error('size');
 const chunks=[];let size=0;
 for await(const chunk of response.body){size+=chunk.length;if(size>MAX_BYTES){await response.body.cancel().catch(()=>{});throw Error('size')}chunks.push(Buffer.from(chunk))}
 const bytes=Buffer.concat(chunks);
 const mime=imageMime(bytes);
 if(!mime)throw Error('type');
 return {mime,size,sha256:createHash('sha256').update(bytes).digest('hex')};
}

export default async function handler(req,res){
 if(req.method!=='POST')return reply(res,405,{error:'method'});
 if(Number(req.headers['content-length']||0)>4000)return reply(res,413,{error:'input'});
 const secret=process.env.BRAINS_CHATGPT_PROBE_KEY;
 if(!secret)return reply(res,503,{error:'unavailable'});
 if(!validProbeKey(req.headers.authorization,secret))return reply(res,401,{error:'authentication'});
 const reference=fileReference(req.body);
 if(!reference)return reply(res,400,{error:'image_reference'});
 try{return reply(res,200,{verified:true,fileId:reference.id,...await inspectImage(reference)})}
 catch{return reply(res,422,{error:'image_unavailable'})}
}
