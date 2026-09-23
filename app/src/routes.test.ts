import {describe,it,expect} from 'vitest';
import {accessRedirect,authCallback,authRedirect,productRoute,areaPath} from './routes';
describe('public and authenticated routes',()=>{
 it.each(['/home','/areas','/settings','/areas/existing-id'])('protects %s without changing account data',path=>{
  expect(accessRedirect(path,false,false)).toBe('/login');
  expect(accessRedirect(path,true,false)).toBeNull();
 });
 it('sends an authenticated login to Today, except during password recovery',()=>{
  expect(accessRedirect('/login',true,false)).toBe('/home');
  expect(accessRedirect('/login',true,true)).toBeNull();
  expect(accessRedirect('/home',true,true)).toBe('/login?auth=reset');
 });
 it('uses existing area IDs without creating or translating references',()=>{
  const id='f0837cd4-1111-4444-9999-ffeabcabcdef';
  expect(productRoute(areaPath(id))).toEqual({page:'area',areaId:id});
  expect(productRoute('/areas/')).toEqual({page:'decks',areaId:''});
  expect(productRoute('/unknown')).toBeNull();
  expect(productRoute('/areas/%E0')).toBeNull();
 });
 it('recognizes old recovery and confirmation callbacks, without redirecting ordinary landing anchors',()=>{
  expect(authCallback('?auth=reset','#access_token=test&type=recovery')).toBe(true);
  expect(authCallback('','#access_token=test')).toBe(true);
  expect(authCallback('','#error=access_denied')).toBe(true);
  expect(authCallback('?code=test','')).toBe(true);
  expect(authCallback('','#como-usar')).toBe(false);
  expect(authCallback('?utm_source=test','')).toBe(false);
 });
 it('keeps callbacks on the current origin and new login route',()=>{
  expect(authRedirect('https://heybrains.app')).toBe('https://heybrains.app/login');
  expect(authRedirect('https://heybrains.app',true)).toBe('https://heybrains.app/login?auth=reset');
  expect(authRedirect('https://brains-puce.vercel.app')).toBe('https://brains-puce.vercel.app/login');
 });
});
