import {describe,expect,it} from 'vitest';
import {accessRedirect,isAdminRoute} from './routes';
import {conversion} from './admin-data';
import {trackedPath} from './analytics';
describe('admin boundaries',()=>{
 it.each(['/admin','/admin/','/admin/users','/admin/funnel'])('requires authentication on %s',path=>{expect(isAdminRoute(path)).toBe(true);expect(accessRedirect(path,false,false)).toBe('/login?next=admin');expect(accessRedirect(path,true,false)).toBeNull()});
 it.each(['/administrator','/admin/users/private','/admin/other'])('does not expand the route scope to %s',path=>expect(isAdminRoute(path)).toBe(false));
 it('never sends private or unknown paths to analytics',()=>{expect(trackedPath('/admin/users')).toBeNull();expect(trackedPath('/login?token=secret')).toBeNull();expect(trackedPath('/areas/private-id')).toBe('/areas');expect(trackedPath('/settings')).toBe('/settings')});
 it('does not invent conversion when the previous step is empty',()=>{expect(conversion(0,0)).toBeNull();expect(conversion(32,100)).toBe(32)});
});
