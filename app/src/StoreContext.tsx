import {createContext,useContext,useState,type ReactNode} from 'react';
import {LocalStore,accountDatabaseName} from './storage';
const StoreContext=createContext<LocalStore|null>(null);
export function AccountStore({userId,children}:{userId:string;children:ReactNode}){
 const [store]=useState(()=>new LocalStore(accountDatabaseName(userId)));
 return <StoreContext.Provider value={store}>{children}</StoreContext.Provider>;
}
export function useStore(){const store=useContext(StoreContext);if(!store)throw Error('accountRequired');return store}
