import {useEffect,useState} from 'react';
import type {OAuthAuthorizationDetails} from '@supabase/supabase-js';
import {Link,useLocation} from 'react-router-dom';
import {cloud} from './cloud';
import {paths} from './routes';

const oauthEnv=(import.meta as ImportMeta&{env:Record<string,string>}).env;
const permittedClients=new Set([
 oauthEnv.VITE_BRAINS_CHATGPT_CLIENT_ID,
 oauthEnv.VITE_BRAINS_PUBLIC_CHATGPT_CLIENT_ID
].flatMap(value=>String(value??'').split(',')).map(value=>value.trim()).filter(Boolean));

export function OAuthConsent(){
 const location=useLocation();
 const id=new URLSearchParams(location.search).get('authorization_id')??'';
 const [details,setDetails]=useState<OAuthAuthorizationDetails|null>(null);
 const [error,setError]=useState('');const [busy,setBusy]=useState(false);
 useEffect(()=>{let live=true;if(!cloud||!id){setError('Esta conexão ainda não está disponível.');return}
  void cloud.auth.oauth.getAuthorizationDetails(id).then(({data,error})=>{
   if(!live)return;
   if(error||!data){setError('Não foi possível verificar a solicitação.');return}
   if('redirect_url'in data){window.location.assign(data.redirect_url);return}
   setDetails(data)
   if(!permittedClients.size)setError('Falta configurar os IDs de clientes OAuth autorizados na Vercel. Confira o ID abaixo antes de concluir a configuração.');
   else if(!permittedClients.has(data.client.id))setError('Este cliente não está autorizado no Brains. Confira o ID abaixo antes de alterar a configuração.');
  }).catch(()=>{if(live)setError('Não foi possível verificar a solicitação.')});
  return()=>{live=false}
 },[id]);
 async function decide(approve:boolean){if(!cloud||!details||busy)return;setBusy(true);setError('');
  try{const result=approve?await cloud.auth.oauth.approveAuthorization(id,{skipBrowserRedirect:true}):await cloud.auth.oauth.denyAuthorization(id,{skipBrowserRedirect:true});
   if(result.error||!result.data?.redirect_url)throw Error();
   window.location.assign(result.data.redirect_url)
  }catch{setError('Não foi possível concluir. Tente novamente.');setBusy(false)}
 }
 return <main className="login-page"><section className="login-card"><Link to={paths.home} className="brand"><span className="mark">B</span>Brains</Link><h1>Conectar ao Brains</h1>
  {details?<><p><strong>{details.client.name}</strong> solicita acesso à sua conta Brains.</p><p className="small">Conta: {details.user.email}</p><p>Com esta conexão, o ChatGPT poderá consultar suas áreas ativas e adicionar cards de texto à área escolhida. Ele só deve salvar os cards depois que você aprovar o conteúdo nesta conversa.</p><p className="small">A integração não importa imagens nem arquivos de áudio. A voz de referência continua disponível nos dois lados do card dentro do Brains.</p><p className="small">Permissões OAuth solicitadas: {details.scope||'padrão do aplicativo'}.</p><p className="small">ID do cliente: <code>{details.client.id}</code></p>{permittedClients.has(details.client.id)?<><p className="small">Você pode recusar agora. Confira o nome do aplicativo antes de autorizar.</p><div className="actions"><button className="secondary" disabled={busy} onClick={()=>void decide(false)}>Recusar</button><button className="primary" disabled={busy} onClick={()=>void decide(true)}>Autorizar</button></div></>:<p className="notice" role="status">{error||'Cliente não autorizado.'}</p>}</>:!error&&<p role="status">Verificando solicitação…</p>}
  {!details&&error&&<p className="error" role="alert">{error}</p>}</section></main>
}
