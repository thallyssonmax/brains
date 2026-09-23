import {authRedirect} from './routes';
import {useEffect,useRef,useState} from 'react';
import {cloud,publicAuthSettings} from './cloud';
import type {Locale} from './model';
import {authTexts} from './auth-texts';
import {submitAuth,authErrorKey,type AuthMode} from './auth-actions';
export function AuthForm({locale,recovery=false,onRecovered,callbackError=false}:{locale:Locale;recovery?:boolean;onRecovered:()=>void;callbackError?:boolean}){
 const t=authTexts[locale];const [mode,setMode]=useState<AuthMode>(recovery?'reset':'login');const [email,setEmail]=useState(''),[password,setPassword]=useState(''),[confirm,setConfirm]=useState(''),[busy,setBusy]=useState(false),[error,setError]=useState<keyof typeof t|''>(callbackError?'callbackError':''),[message,setMessage]=useState<keyof typeof t|''>(''),[google,setGoogle]=useState(false),[signupAllowed,setSignupAllowed]=useState(true);const locked=useRef(false);
 useEffect(()=>{let live=true;void publicAuthSettings().then(settings=>{if(live){setGoogle(!!settings.external?.google);setSignupAllowed(!settings.disable_signup)}}).catch(()=>{});return()=>{live=false}},[]);
 useEffect(()=>{if(recovery)setMode('reset')},[recovery]);
 function change(next:AuthMode){setMode(next);setPassword('');setConfirm('');setError('');setMessage('')}
 async function run(action:()=>Promise<void>){if(locked.current)return;locked.current=true;setBusy(true);setError('');setMessage('');try{await action()}catch(e){setError(authErrorKey(e))}finally{locked.current=false;setBusy(false)}}
 if(!cloud)return <p role="alert">{t.setup}</p>;
 const newPassword=mode==='signup'||mode==='reset';
 return <section className="auth-form"><h1>{t[mode]}</h1>{google&&(mode==='login'||mode==='signup')&&<><button className="secondary wide" disabled={busy} onClick={()=>void run(async()=>{const {error}=await cloud!.auth.signInWithOAuth({provider:'google',options:{redirectTo:authRedirect(window.location.origin)}});if(error)throw error})}>{t.google}</button><p className="small center">{t.or}</p></>}
 <form onSubmit={e=>{e.preventDefault();if(newPassword&&password!==confirm){setError('mismatch');return}void run(async()=>{const result=await submitAuth(cloud!,mode,email,password,window.location.origin);if(result.error)throw result.error;setPassword('');setConfirm('');if(mode==='reset'){onRecovered();return}if(mode==='signup')setMessage('sent');if(mode==='forgot')setMessage('recoverySent')})}}>
 <fieldset disabled={busy}>
 {mode!=='reset'&&<><label htmlFor="auth-email">{t.email}</label><input id="auth-email" type="email" autoComplete="username" autoCapitalize="none" spellCheck={false} value={email} onChange={e=>setEmail(e.target.value)} required/></>}
 {mode!=='forgot'&&<><label htmlFor="auth-password">{t.password}</label><input id="auth-password" type="password" autoComplete={newPassword?'new-password':'current-password'} minLength={newPassword?8:undefined} aria-describedby={newPassword?'password-help':undefined} value={password} onChange={e=>setPassword(e.target.value)} required/>{newPassword&&<><p id="password-help" className="small">{t.hint}</p><label htmlFor="auth-confirm">{t.confirm}</label><input id="auth-confirm" type="password" autoComplete="new-password" minLength={8} value={confirm} onChange={e=>setConfirm(e.target.value)} required/></>}</>}
 <button className="primary wide spaced" type="submit">{busy?t.wait:mode==='forgot'?t.send:mode==='reset'?t.save:t[mode]}</button></fieldset></form>
 {error&&<p className="error" role="alert">{t[error]}</p>}{message&&<p className="feedback feedback-success" role="status">{t[message]}</p>}
 {(error==='unconfirmed'||message==='sent')&&<button className="text-btn" disabled={busy} onClick={()=>void run(async()=>{const {error}=await cloud!.auth.resend({type:'signup',email:email.trim(),options:{emailRedirectTo:authRedirect(window.location.origin)}});if(error)throw error;setMessage('sent')})}>{t.resend}</button>}
 <div className="auth-links">{mode==='login'?<><button className="text-btn" disabled={busy} onClick={()=>change('forgot')}>{t.forgotLink}</button>{signupAllowed&&<button className="text-btn" disabled={busy} onClick={()=>change('signup')}>{t.signupLink}</button>}</>:mode==='reset'?<button className="text-btn" disabled={busy} onClick={onRecovered}>{t.cancel}</button>:<button className="text-btn" disabled={busy} onClick={()=>change('login')}>{mode==='signup'?t.loginLink:t.back}</button>}</div></section>;
}

