import {AccountStore} from './StoreContext';
import {cancelSpeech} from './voice';
import {useEffect,useState,type ReactNode} from 'react';
import type {User} from '@supabase/supabase-js';
import {cloud} from './cloud';
import {AccountPanel} from './AccountPanel';
import type {Locale} from './model';
export function AuthGate({children}:{children:ReactNode}){
 const [user,setUser]=useState<User|null>(null),[loading,setLoading]=useState(!!cloud),[locale]=useState<Locale>('pt');
 useEffect(()=>{let active=true;if(!cloud)return()=>{active=false};
 const {data}=cloud.auth.onAuthStateChange((_event,session)=>{if(active){setUser(session?.user??null);setLoading(false)}});
 return()=>{active=false;data.subscription.unsubscribe();cancelSpeech()};
 },[]);
 if(user)return <AccountStore key={user.id} userId={user.id}>{children}</AccountStore>;
 const title={pt:'Bem-vindo ao Brains',en:'Welcome to Brains',es:'Bienvenido a Brains'}[locale];
 return <main className="login-page"><div className="login-card"><div className="brand"><span className="mark">B</span>Brains</div><h1>{title}</h1>{loading?<p role="status">{locale==='pt'?'Carregando sua conta…':locale==='es'?'Cargando tu cuenta…':'Loading your account…'}</p>:<AccountPanel locale={locale} loginOnly/>}</div></main>;
}
