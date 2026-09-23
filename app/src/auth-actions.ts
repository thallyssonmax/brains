import type {SupabaseClient} from '@supabase/supabase-js';
import {authRedirect} from './routes';
export type AuthMode='login'|'signup'|'forgot'|'reset';
export async function submitAuth(client:SupabaseClient,mode:AuthMode,email:string,password:string,origin:string){
 const redirect=authRedirect(origin);
 if(mode==='login')return client.auth.signInWithPassword({email:email.trim(),password});
 if(mode==='signup')return client.auth.signUp({email:email.trim(),password,options:{emailRedirectTo:redirect}});
 if(mode==='forgot')return client.auth.resetPasswordForEmail(email.trim(),{redirectTo:redirect+'?auth=reset'});
 return client.auth.updateUser({password});
}
export function authErrorKey(error:unknown){
 const code=(error as {code?:string})?.code;
 if(code==='email_not_confirmed')return 'unconfirmed';
 if(code==='weak_password')return 'weak';
 if(code==='over_request_rate_limit'||code==='over_email_send_rate_limit')return 'rate';
 if(code==='signup_disabled')return 'closed';
 if(code==='email_address_not_authorized'||code==='unexpected_failure')return 'emailError';
 if(code==='same_password')return 'same';
 return 'error';
}
