import {useEffect,useState} from 'react';
import {pronunciationFor} from './pronunciation';
import type {T} from './i18n';

let dictionaryPromise:Promise<Record<string,string>>|undefined;
function loadDictionary(){return dictionaryPromise??=import('cmu-pronouncing-dictionary').then(module=>module.dictionary).catch(error=>{dictionaryPromise=undefined;throw error})}

export function PronunciationHint({text,language,t}:{text:string;language:string;t:T}){
 const [result,setResult]=useState<{text:string;language:string;value:string|null}|null>(null);
 useEffect(()=>{
  let active=true;
  if(!text.trim()||!/^en(?:-US)?$/i.test(language))return;
  // Debounce typing; dictionary stays in a separate, cached chunk.
  const timer=setTimeout(()=>{void loadDictionary().then(dictionary=>{if(active)setResult({text,language,value:pronunciationFor(text,language,dictionary)})}).catch(()=>{if(active)setResult(null)})},150);
  return()=>{active=false;clearTimeout(timer)};
 },[text,language]);
 const value=result?.text===text&&result?.language===language?result.value:null;
 return value?<p className="pronunciation-hint" lang="en-US" aria-label={`${t('pronunciationGuide')}: ${value}`} title={t('pronunciationGuide')}>{value}</p>:null;
}
