import {cloud} from './cloud';
export type Metric='accounts'|'areas'|'cards';
export interface Point{day:string;accounts:number;areas:number;cards:number}
export interface Overview{accounts:number;areas:number;cards:number;accounts_today:number;areas_today:number;cards_today:number;dau:number;wau:number;mau:number;period_active:number;tracking_since:string;series:Point[]}
export interface Funnel{steps:number[];active_users:number;tracking_since:string;pages:{path:string;views:number;users:number;active_percent:number|null}[]}
export interface AdminUser{id:string;email:string;created_at:string;last_sign_in_at:string|null;last_activity:string|null;areas:number;decks:number;cards:number}
export interface Users{total:number;rows:AdminUser[];recent:{event_name:string;created_at:string}[]}
export async function adminRequest<T>(name:string,args:Record<string,unknown>={},signal?:AbortSignal):Promise<T>{
 if(!cloud)throw Error('Conexão indisponível.');
 const request=cloud.rpc(name,args);
 const {data,error}=await (signal?request.abortSignal(signal):request);
 if(error)throw Error(error.code==='42501'?'Acesso restrito a administradores.':'Não foi possível carregar os dados. Tente novamente.');
 return data as T;
}
export const number=(value:number)=>new Intl.NumberFormat('pt-BR').format(value);
export const date=(value:string|null)=>value?new Intl.DateTimeFormat('pt-BR',{timeZone:'America/Sao_Paulo',dateStyle:'short',timeStyle:'short'}).format(new Date(value)):'Sem registro';
export function conversion(current:number,previous:number){return previous>0?Math.round(current/previous*100):null}
