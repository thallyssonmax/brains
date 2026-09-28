import {AccountStore} from './StoreContext';
import {cancelSpeech} from './voice';
import {lazy,Suspense,useEffect,useState,type ReactNode} from 'react';
import {AnalyticsTracker} from './AnalyticsTracker';
import type {User} from '@supabase/supabase-js';
import {cloud} from './cloud';
import {AuthForm} from './AuthForm';

import type {Locale} from './model';
import {Navigate,useLocation,useNavigate,Link} from 'react-router-dom';
import {accessRedirect,isAdminRoute,paths,productRoute} from './routes';
const Admin=lazy(()=>import('./Admin'));
export function AuthGate({children}:{children:ReactNode}){
 const location=useLocation(),navigate=useNavigate();
 const [user,setUser]=useState<User|null>(null),[loading,setLoading]=useState(!!cloud),[locale]=useState<Locale>(()=>navigator.language.startsWith('es')?'es':navigator.language.startsWith('en')?'en':'pt');
 const [recovery,setRecovery]=useState(()=>new URLSearchParams(window.location.search).get('auth')==='reset'||new URLSearchParams(window.location.hash.slice(1)).get('type')==='recovery');
 const [callbackError]=useState(()=>new URLSearchParams(window.location.hash.slice(1)).has('error')||new URLSearchParams(window.location.search).has('error'));
 useEffect(()=>{document.documentElement.lang=locale==='pt'?'pt-BR':locale},[locale]);
 useEffect(()=>{let active=true;if(!cloud)return()=>{active=false};
 const {data}=cloud.auth.onAuthStateChange((_event,session)=>{if(active){if(_event==='PASSWORD_RECOVERY')setRecovery(true);setUser(session?.user??null);setLoading(false)}});
 return()=>{active=false;data.subscription.unsubscribe();cancelSpeech()};
 },[]);
 const redirect=!loading?accessRedirect(location.pathname,!!user,recovery,location.search):null;
 const tracker=<AnalyticsTracker userId={user?.id??null} ready={!loading}/>;
 if(redirect)return <>{tracker}<Navigate to={redirect} replace/></>;
 if(!loading&&user&&!recovery&&isAdminRoute(location.pathname))return <>{tracker}<Suspense fallback={<main className="login-page" role="status">Carregando Admin…</main>}><Admin key={user.id}/></Suspense></>;
 if(!loading&&user&&!recovery&&productRoute(location.pathname))return <>{tracker}<AccountStore key={user.id} userId={user.id}>{children}</AccountStore></>;
 if(!loading&&location.pathname!==paths.login)return <main className="login-page"><div className="login-card"><h1>404</h1><p>{locale==='pt'?'Página não encontrada.':locale==='es'?'Página no encontrada.':'Page not found.'}</p><Link to={user?paths.home:paths.login}>{locale==='pt'?'Acessar o Brains':locale==='es'?'Acceder a Brains':'Open Brains'}</Link></div></main>;

 return <>{tracker}<main className="login-page"><div className="login-card"><a href={paths.landing} className="brand"><span className="mark">B</span>Brains</a>{loading?<p role="status">{locale==='pt'?'Carregando sua conta…':locale==='es'?'Cargando tu cuenta…':'Loading your account…'}</p>:<AuthForm locale={locale} recovery={recovery&&!!user} callbackError={callbackError} onRecovered={()=>{setRecovery(false);navigate(paths.home,{replace:true})}}/>}</div></main></>;
}
