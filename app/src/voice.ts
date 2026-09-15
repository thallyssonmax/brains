type Voice={name:string;lang:string;default:boolean};
export function chooseVoice<T extends Voice>(voices:T[],language:string):T|undefined{
 const lang=language.toLowerCase().replace('_','-');
 const candidates=voices.filter(v=>v.lang.toLowerCase().replace('_','-').split('-')[0]===lang.split('-')[0]);
 const score=(v:T)=>(v.lang.toLowerCase().replace('_','-')===lang?100:0)+(/natural|premium|enhanced|neural/i.test(v.name)?30:0)+(/google/i.test(v.name)?10:0)+(v.default?1:0);
 return candidates.sort((a,b)=>score(b)-score(a))[0];
}

// A pending request belongs to the current screen; cancellation also removes its listener.
let pending: (()=>void)|undefined;
export function cancelSpeech(){pending?.();pending=undefined;window.speechSynthesis?.cancel()}
export function withLoadedVoices(synth:SpeechSynthesis,ready:(voices:SpeechSynthesisVoice[])=>void){
 const current=synth.getVoices();
 if(current.length){ready(current);return ()=>{}}
 let done=false;
 const finish=(deliver:boolean)=>{if(done)return;done=true;clearTimeout(timer);synth.removeEventListener('voiceschanged',changed);if(deliver)ready(synth.getVoices())};
 const changed=()=>{if(synth.getVoices().length)finish(true)};
 const timer=setTimeout(()=>finish(true),3000);
 synth.addEventListener('voiceschanged',changed);
 changed();
 return ()=>finish(false);
}
export function requestVoices(synth:SpeechSynthesis,ready:(voices:SpeechSynthesisVoice[])=>void){cancelSpeech();pending=withLoadedVoices(synth,ready)}
