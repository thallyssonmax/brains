import {useEffect,useState} from 'react';
import {useStore} from './StoreContext';
import type {T} from './i18n';
export function CloudStatus({t,compact=false}:{t:T;compact?:boolean}){
 const store=useStore();const [,render]=useState(0);
 useEffect(()=>store.subscribe(()=>render(n=>n+1)),[store]);
 if(compact&&!store.pendingCount&&!store.mediaFailed)return null;
 return <section className="notice" role="status">{!compact&&<p>{t('cloudAutomatic')}</p>}{store.pendingCount>0&&<p>{t('mediaPending')} ({store.pendingCount})</p>}{store.mediaFailed&&<><p>{t('mediaRetryHelp')}</p><button className="secondary" onClick={()=>void store.retryMedia().catch(()=>{})}>{t('retryAttachments')}</button></>}</section>;
}
