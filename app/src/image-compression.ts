/// <reference types="vite/client" />
import compress from 'browser-image-compression';
import workerURL from 'browser-image-compression/dist/browser-image-compression.js?url';
export const IMAGE_INPUT_LIMIT=20*1024*1024;
const STORED_LIMIT=5*1024*1024;
export async function optimizeImage(file:File):Promise<Blob>{
 if(!/^image\/(jpeg|png|webp|gif)$/.test(file.type)||!file.size||file.size>IMAGE_INPUT_LIMIT)throw Error('imageInputLimit');
 // Canvas would flatten animations; preserve GIF and animated PNG/WebP.
 const bytes=new Uint8Array(await file.arrayBuffer());
 const marker=file.type==='image/png'?'acTL':file.type==='image/webp'?'ANIM':'';
 const animated=file.type==='image/gif'||!!marker&&bytes.some((_,i)=>[...marker].every((ch,j)=>bytes[i+j]===ch.charCodeAt(0)));
 let result:Blob=file;
 if(!animated){try{
  const optimized=await compress(file,{maxWidthOrHeight:1600,maxSizeMB:Number.POSITIVE_INFINITY,initialQuality:0.8,maxIteration:1,useWebWorker:true,libURL:workerURL,preserveExif:false});
  if(optimized.size>0&&optimized.size<file.size)result=optimized;
 }catch{ /* Keep a valid original when this browser cannot compress it. */ }}
 if(result.size>STORED_LIMIT)throw Error('imageOutputLimit');
 return result;
}
