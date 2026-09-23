import {AccountStore} from './StoreContext';
import {cancelSpeech} from './voice';
import {useEffect,useState,type ReactNode} from 'react';
import type {User} from '@supabase/supabase-js';
import {cloud} from './cloud';
import {AuthForm} from './AuthForm';
import {authTexts} from './auth-texts';
import type {Locale} from './model';
export function AuthGate({children}:{children:ReactNode}){
 const [user,setUser]=useState<User|null>(null),[loading,setLoading]=useState(!!cloud),[locale,setLocale]=useState<Locale>(()=>navigator.language.startsWith('es')?'es':navigator.language.startsWith('en')?'en':'pt');
 const [recovery,setRecovery]=useState(()=>new URLSearchParams(window.location.search).get('auth')==='reset'||new URLSearchParams(window.location.hash.slice(1)).get('type')==='recovery');
 const [callbackError]=useState(()=>new URLSearchParams(window.location.hash.slice(1)).has('error')||new URLSearchParams(window.location.search).has('error'));
 useEffect(()=>{document.documentElement.lang=locale==='pt'?'pt-BR':locale},[locale]);
 useEffect(()=>{let active=true;if(!cloud)return()=>{active=false};
 const {data}=cloud.auth.onAuthStateChange((_event,session)=>{if(active){if(_event==='PASSWORD_RECOVERY')setRecovery(true);setUser(session?.user??null);setLoading(false)}});
 return()=>{active=false;data.subscription.unsubscribe();cancelSpeech()};
 },[]);
 if(user&&!recovery)return <AccountStore key={user.id} userId={user.id}>{children}</AccountStore>;

 return <main className="login-page"><div className="login-card"><div className="brand"><span className="mark">B</span>Brains</div><label htmlFor="auth-locale">{authTexts[locale].language}</label><select id="auth-locale" value={locale} onChange={e=>setLocale(e.target.value as Locale)}><option value="pt">Português (Brasil)</option><option value="en">English</option><option value="es">Español</option></select>{loading?<p role="status">{locale==='pt'?'Carregando sua conta…':locale==='es'?'Cargando tu cuenta…':'Loading your account…'}</p>:<AuthForm locale={locale} recovery={recovery&&!!user} callbackError={callbackError} onRecovered={()=>{setRecovery(false);window.history.replaceState(null,'',window.location.pathname)}}/>}</div></main>;
}
