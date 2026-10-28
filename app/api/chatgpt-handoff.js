import {mcpFileReference} from './chatgpt-image-probe.js';

export const HANDOFF_TTL=30*60*1000;
export function prepareHandoff({front,back,file,withoutImage=false},now=Date.now()){
 if(typeof front!=='string'||!front.trim())throw Error('MISSING_FRONT');
 if(front.length>200)throw Error('FRONT_TOO_LONG');
 if(typeof back!=='string'||!back.trim())throw Error('MISSING_BACK');
 if(back.length>800)throw Error('BACK_TOO_LONG');
 if(!withoutImage&&!file)throw Error('MISSING_IMAGE');
 if(!withoutImage&&!mcpFileReference(file))throw Error('INVALID_IMAGE_REFERENCE');
 const payload={v:1,front:front.trim(),back:back.trim(),createdAt:now,...(!withoutImage?{file:{download_url:file.download_url,file_id:file.file_id,mime_type:file.mime_type}}:{withoutImage:true})};
 return 'https://www.heybrains.app/import/chatgpt#payload='+Buffer.from(JSON.stringify(payload)).toString('base64url');
}

export function readHandoff(value,now=Date.now()){
 if(typeof value!=='string'||value.length>16000||!/^[A-Za-z0-9_-]+$/.test(value))throw Error('invalid_handoff');
 let payload;try{payload=JSON.parse(Buffer.from(value,'base64url').toString('utf8'))}catch{throw Error('invalid_handoff')}
 if(payload?.v!==1||!Number.isFinite(payload.createdAt)||payload.createdAt>now+60_000||now-payload.createdAt>HANDOFF_TTL)throw Error('expired_handoff');
 if(typeof payload.front!=='string'||typeof payload.back!=='string'||!payload.front.trim()||!payload.back.trim()||payload.front.length>200||payload.back.length>800)throw Error('invalid_handoff');
 if(payload.withoutImage!==true&&!mcpFileReference(payload.file))throw Error('invalid_handoff');
 return payload;
}
