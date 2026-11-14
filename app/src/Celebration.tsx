import { motion, useReducedMotion } from 'motion/react';
import { motionTransition } from './components/ui/motion';
import { Button } from './components/ui/button';
import { X, Check } from 'lucide-react';
import {useEffect,useRef} from 'react';
import './celebration.css';

type Kind='first-card'|'reviews-complete';

export function Celebration({kind,nextReview,onClose,onAction}:{kind:Kind;nextReview?:string;onClose:()=>void;onAction:()=>void}){
 const reduced = useReducedMotion();
 const dialog=useRef<HTMLDialogElement>(null);
 useEffect(()=>{const opener=document.activeElement as HTMLElement|null;const node=dialog.current!;node.showModal();return()=>{node.close();if(opener?.isConnected)opener.focus()}},[]);
 const first=kind==='first-card';
 return <motion.dialog data-motion-dialog ref={dialog} initial={reduced ? false : {opacity:0,y:8}} animate={{opacity:1,y:0}} transition={motionTransition(reduced ? 0 : .24)} className="celebration" aria-labelledby="celebration-title" aria-describedby="celebration-copy" onCancel={event=>{event.preventDefault();onClose()}}>
   <Button autoFocus className="celebration-close" type="button" aria-label="Fechar celebração" onClick={onClose}><X size={20} aria-hidden="true"/></Button>
   <div className="celebration-art" aria-hidden="true"><span className="celebration-card">B</span><span className="celebration-check"><Check size={24}/></span><i/><i/><i/><i/><i/><i/></div>
   <h2 id="celebration-title">{first?'🎉 Seu primeiro card! Aí sim!':'🧠✨ Revisões do dia concluídas!'}</h2>
   <div id="celebration-copy">{first?<><p>Você acabou de dar o primeiro passo para construir seu vocabulário.</p><p>Uma palavra aprendida hoje pode fazer diferença amanhã.</p></>:<><p>Mandou bem! Você revisou tudo o que precisava por hoje.</p><p>Cada revisão ajuda seu vocabulário a ficar mais forte.</p>{nextReview&&<p><strong>Próxima revisão:</strong> {nextReview}</p>}</>}</div>
   <Button className="primary wide" type="button" onClick={onAction}>{first?'Criar mais um card':'Aprender uma nova palavra'}</Button>
 </motion.dialog>
}
