import {describe,it,expect} from 'vitest';
import {accessRedirect,authCallback,authRedirect,productRoute,areaPath,consentDestination,returnDestination,loginDestination} from './routes';
describe('public and authenticated routes',()=>{
 it.each(['/home','/areas','/settings','/areas/existing-id'])('preserves a safe destination for %s during login',path=>{
  expect(accessRedirect(path,false,false)).toBe('/login?next='+encodeURIComponent(path));
  expect(accessRedirect(path,true,false)).toBeNull();
 });
 it('returns to the safe requested destination after login',()=>{
  expect(accessRedirect('/login',true,false,'?next=%2Fareas%2Farea-id%3FcreateCard%3D1')).toBe('/areas/area-id?createCard=1');
  expect(accessRedirect('/login',true,false)).toBe('/home');
  expect(accessRedirect('/login',true,true)).toBeNull();
  expect(accessRedirect('/home',true,true)).toBe('/login?auth=reset');
 });
 it('returns to Admin only when login was opened for Admin',()=>{
  expect(accessRedirect('/admin',false,false)).toBe('/login?next=admin');
  expect(accessRedirect('/login',false,false,'?next=admin')).toBeNull();
  expect(accessRedirect('/login',true,false,'?next=admin')).toBe('/admin');
  expect(accessRedirect('/login',true,false)).toBe('/home');
  expect(accessRedirect('/login',true,true,'?next=admin')).toBeNull();
 });
 it('preserves OAuth authorization through login and consent',()=>{
  const id='f0837cd4-1111-4444-9999-ffeabcabcdef';
  expect(accessRedirect('/oauth/consent',false,false,'?authorization_id='+id)).toBe('/login?next=oauth&authorization_id='+id);
  expect(accessRedirect('/login',true,false,'?next=oauth&authorization_id='+id)).toBe('/oauth/consent?authorization_id='+id);
  expect(consentDestination('?next=oauth&authorization_id=bad')).toBeNull();
  expect(consentDestination('?next=https://evil.example&authorization_id='+id)).toBeNull();
  expect(accessRedirect('/oauth/consent',true,false,'?authorization_id='+id)).toBeNull();
  expect(accessRedirect('/oauth/consent',false,false)).toBe('/login');
 });
 it.each(['?next=https://evil.example','?next=//evil.example','?next=/admin','?next=/settings?x=unsafe','?next=/areas?createArea=1%26email_message_id%3Devil','?next='+encodeURIComponent('\\\\evil.example')])('rejects arbitrary or unsafe return destinations: %s',search=>{
  expect(returnDestination(search)).toBeNull();
 });
 it('keeps only known Brains actions and the opaque message id',()=>{
  const message='f0837cd4-1111-4444-9999-ffeabcabcdef';
  expect(returnDestination('?next='+encodeURIComponent('/areas?createArea=1&email_message_id='+message))).toBe('/areas?email_message_id='+message+'&createArea=1');
  expect(returnDestination('?next='+encodeURIComponent('/home?review=1&email_message_id='+message+'&utm_source=bad'))).toBe('/home?email_message_id='+message+'&review=1');
  expect(loginDestination('?next=%2Fsettings%3Ffoo%3Dbar')).toBe('/home');
 });
 it('uses existing area IDs without creating or translating references',()=>{
  const id='f0837cd4-1111-4444-9999-ffeabcabcdef';
  expect(productRoute(areaPath(id))).toEqual({page:'area',areaId:id});
  expect(productRoute('/areas/')).toEqual({page:'decks',areaId:''});
  expect(productRoute('/unknown')).toBeNull();
  expect(productRoute('/areas/%E0')).toBeNull();
 });
 it('recognizes old recovery and confirmation callbacks without redirecting ordinary anchors',()=>{
  expect(authCallback('?auth=reset','#access_token=test&type=recovery')).toBe(true);
  expect(authCallback('','#access_token=test')).toBe(true);
  expect(authCallback('','#error=access_denied')).toBe(true);
  expect(authCallback('?code=test','')).toBe(true);
  expect(authCallback('','#como-usar')).toBe(false);
  expect(authCallback('?utm_source=test','')).toBe(false);
 });
 it('keeps auth callbacks on the current origin and preserves the CTA after confirmation',()=>{
  expect(authRedirect('https://heybrains.app')).toBe('https://heybrains.app/login');
  expect(authRedirect('https://heybrains.app',true)).toBe('https://heybrains.app/login?auth=reset');
  expect(authRedirect('https://heybrains.app',false,'/home?review=1')).toBe('https://heybrains.app/login?next=%2Fhome%3Freview%3D1');
  expect(authRedirect('https://brains-puce.vercel.app')).toBe('https://brains-puce.vercel.app/login');
 });
});
