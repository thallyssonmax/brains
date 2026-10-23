import {describe,it,expect} from 'vitest';
import {fileReference,inspectImage} from '../api/chatgpt-image-probe.js';
const ref={id:'file-12345678',download_link:'https://files.oaiusercontent.com/file-12345678?se=abc'};
describe('ChatGPT image transfer probe',()=>{
 it('accepts only one file from the documented host',()=>{
  expect(fileReference({openaiFileIdRefs:[ref]})?.id).toBe(ref.id);
  for(const link of ['http://files.oaiusercontent.com/x','https://evil.test/x','https://files.oaiusercontent.com.evil.test/x','https://localhost/x'])expect(fileReference({openaiFileIdRefs:[{...ref,download_link:link}]})).toBeNull();
  expect(fileReference({openaiFileIdRefs:[ref,ref]})).toBeNull();
 });
 it('inspects bytes without storing user media or returning a temporary URL',async()=>{
  const png=Buffer.from([137,80,78,71,13,10,26,10,0,1]);
  const result=await inspectImage(fileReference({openaiFileIdRefs:[ref]}),async()=>new Response(png,{headers:{'content-type':'text/plain'}}));
  expect(result).toMatchObject({mime:'image/png',size:png.length});
  expect(result.sha256).toMatch(/^[a-f0-9]{64}$/);
 });
 it('rejects non-images and oversized responses',async()=>{
  const reference=fileReference({openaiFileIdRefs:[ref]});
  await expect(inspectImage(reference,async()=>new Response('hello'))).rejects.toThrow('type');
  await expect(inspectImage(reference,async()=>new Response('x',{headers:{'content-length':String(6*1024*1024)}}))).rejects.toThrow('size');
 });
});
