import {createContext,useContext,useState,useEffect,type ReactNode} from 'react';
import {CloudStore,transportFor} from './cloud-store';
import {cloud} from './cloud';
const StoreContext=createContext<CloudStore|null>(null);
export function AccountStore({userId,children}:{userId:string;children:ReactNode}){
 const [store]=useState(()=>new CloudStore(userId,transportFor(cloud!,userId)));
 useEffect(()=>{
  store.activate();const retry=()=>{if(navigator.onLine)void store.retryMedia().catch(()=>{})};retry();
  const timer=setInterval(retry,30000);window.addEventListener('online',retry);window.addEventListener('focus',retry);
  return()=>{store.deactivate();clearInterval(timer);window.removeEventListener('online',retry);window.removeEventListener('focus',retry)};
 },[store]);
 return <StoreContext.Provider value={store}>{children}</StoreContext.Provider>;
}
export function useStore(){const store=useContext(StoreContext);if(!store)throw Error('accountRequired');return store}
