import {describe,it,expect} from 'vitest';
import {clearEmailMessage,currentEmailMessage,emailMessageFromSearch,recordEmailConversion,rememberEmailMessage} from './email-attribution';
function fakeStorage(){const values=new Map<string,string>();return {getItem:(key:string)=>values.get(key)??null,setItem:(key:string,value:string)=>{values.set(key,value)},removeItem:(key:string)=>{values.delete(key)}}}
const id='f0837cd4-1111-4444-9999-ffeabcabcdef';
describe('explicit email attribution',()=>{
 it('accepts only opaque UUID message references',()=>{
  expect(emailMessageFromSearch('?email_message_id='+id)).toBe(id);
  expect(emailMessageFromSearch('?email_message_id=https://evil.example')).toBeNull();
  expect(emailMessageFromSearch('?other='+id)).toBeNull();
 });
 it('stores the attribution only for the current session and expires it after seven days',()=>{
  const storage=fakeStorage();
  expect(rememberEmailMessage(id,storage,100)).toBe(true);
  expect(currentEmailMessage(storage,101)).toBe(id);
  expect(currentEmailMessage(storage,100+7*24*60*60*1000)).toBeNull();
  expect(currentEmailMessage(storage,101)).toBeNull();
 });
 it('records a user action against the explicit return message and tolerates failure',async()=>{
  const storage=fakeStorage();rememberEmailMessage(id,storage);
  const calls:{p_message_id:string;p_stage:string}[]=[];
  await recordEmailConversion('area',async args=>{calls.push(args);return {}},storage);
  expect(calls).toEqual([{p_message_id:id,p_stage:'area'}]);
  await recordEmailConversion('card',async()=>{throw Error('offline')},storage);
  clearEmailMessage(storage);
  expect(currentEmailMessage(storage,101)).toBeNull();
 });
});
