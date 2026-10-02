import {useEffect,useId,useRef,useState} from 'react';
import {SpeakerHighIcon,StopIcon} from '@phosphor-icons/react';
import type {T} from './i18n';

export const audioSpeeds=[{value:1/3,label:'⅓×'},{value:.5,label:'½×'},{value:1,label:'1×'},{value:2,label:'2×'},{value:3,label:'3×'}];

export function AudioControls({rate,onRate,playing,onPlay,onStop,t,disabled=false}:{rate:number;onRate:(rate:number)=>void;playing:boolean;onPlay:()=>void;onStop:()=>void;t:T;disabled?:boolean}){
 const [open,setOpen]=useState(false);
 const root=useRef<HTMLDivElement>(null),trigger=useRef<HTMLButtonElement>(null);
 const id=useId();
 useEffect(()=>{
  if(!open)return;
  const outside=(event:PointerEvent)=>{if(!root.current?.contains(event.target as Node))setOpen(false)};
  document.addEventListener('pointerdown',outside);
  return()=>document.removeEventListener('pointerdown',outside);
 },[open]);
 return <div className="audio-controls" ref={root} onKeyDown={event=>{if(event.key==='Escape'&&open){event.stopPropagation();setOpen(false);trigger.current?.focus()}}}>
  <button ref={trigger} type="button" className="audio-speed" aria-label={`${t('playbackSpeed')}: ${audioSpeeds.find(speed=>speed.value===rate)?.label}`} aria-expanded={open} aria-controls={id} onClick={()=>setOpen(value=>!value)}>{audioSpeeds.find(speed=>speed.value===rate)?.label}</button>
  {open&&<div className="audio-speed-options" id={id} role="group" aria-label={t('playbackSpeed')}>
   {audioSpeeds.map(speed=><button type="button" key={speed.value} aria-pressed={rate===speed.value} onClick={()=>{onRate(speed.value);setOpen(false);trigger.current?.focus()}}>{speed.label}</button>)}
  </div>}
  <button type="button" className="audio-play" disabled={disabled} onClick={playing?onStop:onPlay}>
   {playing?<StopIcon size={20} weight="fill" aria-hidden="true"/>:<SpeakerHighIcon size={20} aria-hidden="true"/>}{t(playing?'stopAudio':'playAudio')}
  </button>
 </div>
}
