import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { motionTransition } from './components/ui/motion';
import { Button } from './components/ui/button';
import {useEffect,useId,useRef,useState} from 'react';
import {Volume2, Square} from 'lucide-react';
import type {T} from './i18n';

export const audioSpeeds=[{value:1/3,label:'⅓×'},{value:.5,label:'½×'},{value:1,label:'1×'},{value:2,label:'2×'},{value:3,label:'3×'}];

export function AudioControls({rate,onRate,playing,onPlay,onStop,t,disabled=false}:{rate:number;onRate:(rate:number)=>void;playing:boolean;onPlay:()=>void;onStop:()=>void;t:T;disabled?:boolean}){
 const reduced = useReducedMotion();
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
  <Button ref={trigger} type="button" className="audio-speed" aria-label={`${t('playbackSpeed')}: ${audioSpeeds.find(speed=>speed.value===rate)?.label}`} aria-expanded={open} aria-controls={id} onClick={()=>setOpen(value=>!value)}>{audioSpeeds.find(speed=>speed.value===rate)?.label}</Button>
  <AnimatePresence>{open&&<motion.div initial={reduced ? false : {opacity:0}} animate={{opacity:1}} exit={{opacity:0}} transition={motionTransition(reduced ? 0 : .14)} className="audio-speed-options" id={id} role="group" aria-label={t('playbackSpeed')}>
   {audioSpeeds.map(speed=><Button type="button" key={speed.value} aria-pressed={rate===speed.value} onClick={()=>{onRate(speed.value);setOpen(false);trigger.current?.focus()}}>{speed.label}</Button>)}
  </motion.div>}</AnimatePresence>
  <Button type="button" className="audio-play" disabled={disabled} onClick={playing?onStop:onPlay}>
   {playing?<Square size={20} fill="currentColor" aria-hidden="true"/>:<Volume2 size={20} aria-hidden="true"/>}{t(playing?'stopAudio':'playAudio')}
  </Button>
 </div>
}
