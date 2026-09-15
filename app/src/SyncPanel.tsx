import {useState} from 'react';
import {cloud} from './cloud';
import {useStore} from './StoreContext';
import {encodeLibrary,decodeLibrary} from './sync-codec';
import {reconcile,type SyncRecord} from './sync-plan';
import {uploadMedia,downloadMedia} from './cloud-media';
import type {Locale} from './model';
const copy={pt:{title:'Sincronização',button:'Sincronizar agora',help:'Envia e recupera cards, mídias e progresso da sua conta. Rascunhos ficam neste aparelho.',busy:'Sincronizando…',done:'Sincronização concluída.',conflict:'Há alterações conflitantes. As versões foram preservadas. Faça um backup antes de resolver o conflito.',error:'Não foi possível sincronizar. Seus dados locais foram preservados. Confira a conexão e tente novamente.'},en:{title:'Sync',button:'Sync now',help:'Send and retrieve cards, media and progress for your account. Drafts stay on this device.',busy:'Syncing…',done:'Sync complete.',conflict:'Conflicting changes found. Both versions are preserved. Back up before resolving the conflict.',error:'Unable to sync. Local data is preserved. Check your connection and retry.'},es:{title:'Sincronización',button:'Sincronizar ahora',help:'Envía y recupera tarjetas, medios y progreso de tu cuenta. Los borradores quedan en este dispositivo.',busy:'Sincronizando…',done:'Sincronización completada.',conflict:'Hay cambios en conflicto. Ambas versiones se conservaron. Guarda una copia antes de resolverlo.',error:'No se pudo sincronizar. Se conservaron los datos locales. Comprueba la conexión y reintenta.'}};
export function SyncPanel({locale,onSynced}:{locale:Locale;onSynced:()=>Promise<void>}){
 const store=useStore(),t=copy[locale];const [busy,setBusy]=useState(false),[message,setMessage]=useState('');
 async function sync(){if(busy||!cloud)return;setBusy(true);setMessage('');let step='auth';try{
  const {data:{user},error}=await cloud.auth.getUser();if(error||!user)throw error??Error('auth');
  if(store.databaseName!== 'brains-account-v1-'+encodeURIComponent(user.id))throw Error('auth');
  const snapshot=await store.read(),base=await store.syncBase();
  const media={upload:(blob:Blob)=>uploadMedia(cloud!,user.id,blob),download:(path:string)=>downloadMedia(cloud!,user.id,path)};
  step='media';const local=await encodeLibrary(snapshot,media);
  step='read';const remote=await cloud.from('brains_sync').select('version,records').eq('user_id',user.id).maybeSingle();if(remote.error)throw remote.error;
  // Fresh devices adopt cloud preferences instead of conflicting with default settings.
  const fresh=!base.length&&!snapshot.revision&&!snapshot.cards.length&&!snapshot.areas.length;
  const plan=reconcile(base,fresh&&remote.data?remote.data.records as SyncRecord[]:local,remote.data?.records??[]);
  if(plan.conflicts.length)throw Error('syncConflict');
  step='decode';const merged=await decodeLibrary(plan.merged,media);
  step='save';const save=await cloud.rpc('brains_sync_save',{expected:remote.data?.version??0,payload:plan.merged});if(save.error)throw save.error;
  const session=await cloud.auth.getSession();if(session.data.session?.user.id!==user.id)throw Error('auth');
  step='local';await store.commitSynced(merged,plan.merged,snapshot.revision);await onSynced();setMessage(t.done);
 }catch(error){setMessage(String((error as {message?:string})?.message??error).match(/conflict/i)?t.conflict:t.error+' ('+step+')'+(step==='media'&&error instanceof Error&&/^media[A-Za-z]+(:[a-zA-Z0-9/:;=.+ -]*)?$/.test(error.message)?' — '+error.message:''))}finally{setBusy(false)}}
 return <section className="panel spaced"><h2>{t.title}</h2><p className="small">{t.help}</p><button className="primary" disabled={busy||!cloud} onClick={()=>void sync()}>{busy?t.busy:t.button}</button><p role="status">{message}</p></section>;
}


