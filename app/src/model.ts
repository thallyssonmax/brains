export type Locale = 'pt' | 'en' | 'es';
export type AudioMode = 'reference' | 'recording' | 'file' | 'none';
export interface Side { imagePath?: string; audioPath?: string; imagePending?: boolean; audioPending?: boolean; text: string; image?: Blob; audio?: Blob; mode: AudioMode; language: string; audioText: string; recordedFor?: string }
export interface Card { memory?: import('ts-fsrs').Card; id: string; deckId: string; front: Side; back: Side; version: number; createdAt: string; updatedAt: string; archived: boolean; deleted: boolean }
export interface Area { id: string; name: string; archived: boolean; deleted: boolean }
export interface Deck { id: string; areaId: string; name: string; language: string; archived: boolean; deleted: boolean }
export interface Preferences { locale: Locale; goal: number; newLimit: number; timezone: string }
export interface Library { structureVersion?:2; reviews?: import('./review').ReviewEvent[]; schema: 1; revision: number; areas: Area[]; decks: Deck[]; cards: Card[]; preferences: Preferences }
export interface Draft { id: string; card: Card; baseVersion: number; revision: number; savedAt: string }
export const languages = [['en-US','English (US)'],['en-GB','English (UK)'],['es-ES','Español'],['pt-BR','Português (Brasil)']];
export const blankSide = (language:string, reference=true):Side => ({text:'', mode:reference?'reference':'none', language, audioText:''});
export function blankCard(deck:Deck):Card {return {id:crypto.randomUUID(),deckId:deck.id,front:blankSide(deck.language),back:blankSide('pt-BR',false),version:0,createdAt:new Date().toISOString(),updatedAt:new Date().toISOString(),archived:false,deleted:false}}
export function initialLibrary():Library {const language=typeof navigator==='undefined'?'pt':navigator.language;const locale:Locale=language.startsWith('es')?'es':language.startsWith('en')?'en':'pt';return {structureVersion:2,schema:1,revision:0,areas:[],decks:[],cards:[],preferences:{locale,goal:20,newLimit:5,timezone:Intl.DateTimeFormat().resolvedOptions().timeZone||'America/Sao_Paulo'}}}
export function normalize(text:string){return text.trim().normalize('NFKC').toLocaleLowerCase()}
export function validateCard(card:Card, library:Library){if(!card.front.text.trim()||!card.back.text.trim())throw Error('required');const deck=library.decks.find(d=>d.id===card.deckId&&!d.deleted&&!d.archived);if(!deck||!library.areas.some(a=>a.id===deck.areaId&&!a.deleted&&!a.archived))throw Error('missingDeck');for(const side of [card.front,card.back]){if(side.text.length>2000||side.audioText.length>2000)throw Error('tooLong');if(side.image&&(!/^image\/(jpeg|png|webp|gif)$/.test(side.image.type)||side.image.size>5*1024*1024))throw Error('imageLimit');if(['recording','file'].includes(side.mode)&&!side.audio?.size&&!side.audioPath)throw Error('audioRequired');if(side.audio&&(!side.audio.type.startsWith('audio/')||side.audio.size>5*1024*1024))throw Error('audioLimit');}}

