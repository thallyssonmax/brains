import type {Library} from '../src/model';
export function learnedVocabulary(library:Library,options?:{areaId?:string;deckId?:string;language?:string;excludeCardId?:string;limit?:number}):{term:string;language:string;cardId:string}[];
