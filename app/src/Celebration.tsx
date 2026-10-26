import {useEffect,useRef} from 'react';
import './celebration.css';

type Kind='first-card'|'reviews-complete';

export function Celebration({kind,nextReview,onClose,onAction}:{kind:Kind;nextReview?:string;onClose:()=>void;onAction:()=>void}){
 const dialog=useRef<HTMLDialogElement>(null);
 useEffect(()=>{const opener=document.activeElement as HTMLElement|null;const node=dialog.current!;node.showModal();return()=>{node.close();if(opener?.isConnected)opener.focus()}},[]);
 const first=kind==='first-card';
 return <dialog ref={dialog} className="celebration" aria-labelledby="celebration-title" aria-describedby="celebration-copy" onCancel={event=>{event.preventDefault();onClose()}}>
   <button autoFocus className="celebration-close" type="button" aria-label="Fechar celebração" onClick={onClose}>×</button>
   <div className="celebration-art" aria-hidden="true"><span className="celebration-card">B</span><span className="celebration-check">✓</span><i/><i/><i/><i/><i/><i/></div>
   <h2 id="celebration-title">{first?'🎉 Seu primeiro card! Aí sim!':'🧠✨ Revisões do dia concluídas!'}</h2>
   <div id="celebration-copy">{first?<><p>Você acabou de dar o primeiro passo para construir seu vocabulário.</p><p>Uma palavra aprendida hoje pode fazer diferença amanhã.</p></>:<><p>Mandou bem! Você revisou tudo o que precisava por hoje.</p><p>Cada revisão ajuda seu vocabulário a ficar mais forte.</p>{nextReview&&<p><strong>Próxima revisão:</strong> {nextReview}</p>}</>}</div>
   <button className="primary wide" type="button" onClick={onAction}>{first?'Criar mais um card':'Aprender uma nova palavra'}</button>
 </dialog>
}
