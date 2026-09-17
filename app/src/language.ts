import {eld} from 'eld/extrasmall';
export function detectTextLanguage(text:string,fallback:string){
 const result=eld.detect(text.trim().slice(0,2000));
 const reliable=!!result.language&&result.isReliable();
 return {language:reliable?result.language:fallback,reliable};
}
export const detectionLanguages=Object.values(eld.info().Languages);
