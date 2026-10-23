import {useEffect,useMemo,useState} from 'react';
import {Link} from 'react-router-dom';
import {cloud} from './cloud';
import {useStore} from './StoreContext';
import {blankCard,type Library} from './model';
import {importMatches} from './chatgpt-import-matches';
import {optimizeImage} from './image-compression';
import {areaPath,paths} from './routes';
import {parseChatGPTHandoff} from './chatgpt-handoff';

export function ChatGPTImport({handoffKey}:{handoffKey:string}){
 const store=useStore();
 const [library,setLibrary]=useState<Library|null>(null),[areaId,setAreaId]=useState(''),[front,setFront]=useState(''),[back,setBack]=useState('');
 const [image,setImage]=useState<Blob|null>(null),[imageError,setImageError]=useState(false),[allowNoImage,setAllowNoImage]=useState(false),[allowOtherMeaning,setAllowOtherMeaning]=useState(false),[busy,setBusy]=useState(false),[error,setError]=useState(''),[savedId,setSavedId]=useState('');
 const payload=useMemo(()=>{try{return parseChatGPTHandoff(sessionStorage.getItem('brains-chatgpt-'+handoffKey)??'')}catch{return null}},[handoffKey]);
 useEffect(()=>{if(!payload)return;setFront(payload.front);setBack(payload.back);let active=true;void store.read().then(db=>{if(active)setLibrary(db)}).catch(()=>{if(active)setError('Não foi possível carregar suas áreas.')});return()=>{active=false}},[payload,store]);
 useEffect(()=>{if(!payload?.file||!cloud)return;let active=true;void(async()=>{try{const {data}=await cloud.auth.getSession();if(!data.session)throw Error();const response=await fetch('/api/chatgpt-import-image',{method:'POST',headers:{'Content-Type':'application/json',Authorization:`Bearer ${data.session.access_token}`},body:JSON.stringify({payload:sessionStorage.getItem('brains-chatgpt-'+handoffKey)})});if(!response.ok)throw Error();const blob=await response.blob();const optimized=await optimizeImage(new File([blob],'chatgpt-image',{type:blob.type}));if(active)setImage(optimized)}catch{if(active)setImageError(true)}})();return()=>{active=false}},[payload,handoffKey]);
 const preview=useMemo(()=>image?URL.createObjectURL(image):'',[image]);useEffect(()=>()=>{if(preview)URL.revokeObjectURL(preview)},[preview]);
 const areas=library?.areas.filter(area=>!area.deleted&&!area.archived&&library.decks.some(deck=>deck.areaId===area.id&&!deck.deleted&&!deck.archived))??[];
 const deck=library?.decks.find(d=>d.areaId===areaId&&!d.deleted&&!d.archived);
 const {exact,otherMeaning}=library?importMatches(library,areaId,front,back):{exact:false,otherMeaning:false};
 async function save(){
  if(!deck||!library||!front.trim()||!back.trim()||exact||(otherMeaning&&!allowOtherMeaning)||(!image&&!allowNoImage)||busy||savedId)return;
  setBusy(true);setError('');
  try{
   const latest=await store.read();
   if(!latest.areas.some(a=>a.id===areaId&&!a.deleted&&!a.archived)||!latest.decks.some(d=>d.id===deck.id&&!d.deleted&&!d.archived))throw Error('A área não está mais disponível.');
   const freshMatches=importMatches(latest,areaId,front,back);
   if(freshMatches.exact)throw Error('Este card já existe nessa área.');
   if(freshMatches.otherMeaning&&!allowOtherMeaning)throw Error('Confira o card existente antes de continuar.');
   const card=blankCard(deck);card.front.text=front.trim();card.back.text=back.trim();if(image)card.back.image=image;
   const draft={id:crypto.randomUUID(),card,baseVersion:0,revision:0,savedAt:new Date().toISOString()};
   await store.saveCard(card,0,draft);setSavedId(card.id);await store.retryMedia();
   const verified=await store.read();if(verified.cards.find(c=>c.id===card.id)?.back.imagePending)throw Error('Card salvo. A imagem ainda está sendo enviada; mantenha o Brains aberto e tente novamente em instantes.');
   sessionStorage.removeItem('brains-chatgpt-'+handoffKey);
  }catch(e){setError(e instanceof Error?e.message:'Não foi possível salvar o card. Tente novamente.')}finally{setBusy(false)}
 }
 if(!payload)return <main className="main standalone"><h1>Importar card</h1><p role="alert">O link de importação é inválido ou expirou. Peça um novo link no ChatGPT.</p><Link to={paths.home}>Voltar ao Brains</Link></main>;
 return <main className="main standalone chatgpt-import"><Link className="back" to={paths.home}>← Voltar ao Brains</Link><h1>Revisar card</h1><p className="small">Confira o conteúdo gerado no ChatGPT. Nada será salvo sem sua confirmação.</p>
 {savedId?<div className="panel"><h2>Card salvo</h2><p>{error||'O card já está na sua área.'}</p><Link className="primary" to={areaPath(areaId)}>Abrir área →</Link>{error&&<button className="secondary spaced" disabled={busy} onClick={()=>void(async()=>{setBusy(true);try{await store.retryMedia();const db=await store.read();if(!db.cards.find(c=>c.id===savedId)?.back.imagePending)setError('');}finally{setBusy(false)}})()}>Tentar enviar imagem</button>}</div>:<form onSubmit={e=>{e.preventDefault();void save()}}><div className="panel"><label htmlFor="import-area">Área</label><select id="import-area" required value={areaId} onChange={e=>{setAreaId(e.target.value);setAllowOtherMeaning(false)}}><option value="">Selecione uma área</option>{areas.map(a=><option key={a.id} value={a.id}>{a.name}</option>)}</select></div><div className="card-editor-sides"><div className="panel"><h2>Frente</h2><label htmlFor="import-front">Conteúdo</label><textarea id="import-front" maxLength={200} required value={front} onChange={e=>{setFront(e.target.value);setAllowOtherMeaning(false)}}/></div><div className="panel"><h2>Verso</h2><label htmlFor="import-back">Resposta ou frase</label><textarea id="import-back" maxLength={800} required value={back} onChange={e=>setBack(e.target.value)}/>{preview&&<img className="import-image" src={preview} alt="Imagem gerada no ChatGPT para este card"/>}{!image&&payload.file&&!imageError&&<p role="status">Carregando imagem…</p>}{imageError&&<p role="alert">Não foi possível obter a imagem. O link pode ter expirado.</p>}{!image&&<label className="import-checkbox"><input type="checkbox" checked={allowNoImage} onChange={e=>setAllowNoImage(e.target.checked)}/> Salvar sem imagem</label>}</div></div>
 {exact&&<p role="alert" className="notice">Este card já existe na área, inclusive se estiver na lixeira. Confira antes de criar outro.</p>}{otherMeaning&&<div className="notice"><p>Já existe um card com essa frente nesta área. Confirme se é outro significado.</p><label className="import-checkbox"><input type="checkbox" checked={allowOtherMeaning} onChange={e=>setAllowOtherMeaning(e.target.checked)}/> É outro significado</label></div>}{error&&<p role="alert" className="error">{error}</p>}<button className="primary wide" disabled={!deck||!front.trim()||!back.trim()||exact||(otherMeaning&&!allowOtherMeaning)||(!image&&!allowNoImage)||busy}>{busy?'Salvando…':'Confirmar e salvar card'}</button></form>}</main>;
}
