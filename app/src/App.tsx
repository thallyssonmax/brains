import { indexLibrary } from './library-index';
import { AnimatePresence, LayoutGroup, MotionConfig, motion, useReducedMotion } from 'motion/react';
import { motionTransition } from './components/ui/motion';
import { ChevronDown } from 'lucide-react';
import { Button } from './components/ui/button';
import { CardSurface } from './components/ui/card';
import { Select, SelectOption } from './components/ui/select';
import { Input } from './components/ui/input';
import {matchesCollection,restoreCollectionItem,type CollectionTab} from './collection-state';
import {useLocation,useNavigate,Link} from 'react-router-dom';
import {Plus, ArrowLeft, ArrowRight, BookOpen, Info, Layers, Settings as SettingsIcon} from 'lucide-react';
import {paths,areaPath,productRoute} from './routes';
import {CloudStatus} from './CloudStatus';
import {cancelSpeech} from './voice';
import {AccountPanel} from './AccountPanel';

import {reviewQueue,reviewQueues,applyReview,effectiveDue} from './scheduler';
import {cardSide,dailyProgress} from './review';
import {lazy,Suspense,useCallback,useEffect,useMemo,useRef,useState} from 'react';
import {blankCard,languages,type Area,type Card,type Deck,type Draft,type Library,type Locale} from './model';
import {useStore} from './StoreContext';
import {translator,errorText,type T} from './i18n';
const Editor=lazy(()=>import('./Editor').then(module=>({default:module.Editor})));
const SideView=lazy(()=>import('./Media').then(module=>({default:module.SideView})));
import {Dialog} from './Dialog';
import {Celebration} from './Celebration';
import {EmailConsent} from './EmailConsent';
import {cloud} from './cloud';
import {recordEmailConversion} from './email-attribution';
function recordEngagementConversion(stage:'area'|'card'|'review'|'session'){const client=cloud;if(!client)return;try{void recordEmailConversion(stage,args=>client.rpc('brains_track_email_conversion',args),window.sessionStorage)}catch{/* Attribution never blocks study or account changes. */}}
type Page='home'|'decks'|'area'|'editor'|'settings'|'explore';
type ChangeDialog={kind:'purge';id:string;type:'areas'|'cards'}|{kind:'area'|'deck';item?:Area|Deck}|{kind:'delete';type:'areas'|'decks'|'cards';id:string};
export default function App({preview=false}:{preview?:boolean}={}){
 const reduceMotion = useReducedMotion();
 const store=useStore();
 const location=useLocation(),go=useNavigate();
 const route=productRoute(location.pathname)!;
 const areaId=route.areaId;

 const [now,setNow]=useState(()=>new Date());useEffect(()=>{const timer=setInterval(()=>setNow(new Date()),30000);return()=>clearInterval(timer)},[]);const [data,setData]=useState<Library|null>(null);const [drafts,setDrafts]=useState<Draft[]>([]);const [draft,setDraft]=useState<Draft|null>(null);const [tab,setTab]=useState<CollectionTab>('active');const [search,setSearch]=useState('');const [error,setError]=useState('');const [toast,setToast]=useState('');const [dialog,setDialog]=useState<ChangeDialog|null>(null);const [busy,setBusy]=useState(false);const [explore,setExplore]=useState<Card[]>([]);const [index,setIndex]=useState(0);const [back,setBack]=useState(false);const [flipAnimating,setFlipAnimating]=useState(false);const reviewLock=useRef(false);const [sessionId,setSessionId]=useState(()=>crypto.randomUUID());const t=translator(data?.preferences.locale??'pt');
 const [firstCardCelebration,setFirstCardCelebration]=useState<string|null>(null);
 const [sessionCompleted,setSessionCompleted]=useState(false);
 const currentReviewCard=explore[index];
 const answerFocus=useRef<HTMLElement>(null);
 const revealFocus=useRef<HTMLButtonElement>(null);
 const reviewFocus=useRef<'answer'|'reveal'|null>(null);
 useEffect(()=>{
  if(flipAnimating)return;
  const target=back&&reviewFocus.current==='answer'?answerFocus.current:!back&&reviewFocus.current==='reveal'?revealFocus.current:null;
  if(target){target.focus();reviewFocus.current=null}
 },[back,flipAnimating,currentReviewCard]);
 const processedEmailAction=useRef('');
 const reviewSides=useMemo(()=>{if(!data||!currentReviewCard)return null;const language=data.decks.find(deck=>deck.id===currentReviewCard.deckId)?.language??currentReviewCard.front.language;const card={...currentReviewCard,front:{...currentReviewCard.front,language}};return {front:cardSide(card,false),back:cardSide(card,true)}},[data,currentReviewCard]);
 useEffect(()=>{setBack(false);setFlipAnimating(false);reviewLock.current=false},[index]);
 useEffect(()=>{if(!flipAnimating)return;const timer=window.setTimeout(()=>setFlipAnimating(false),330);return()=>window.clearTimeout(timer)},[flipAnimating,back]);
 const view=location.state?.view;
 const page:Page=view==='editor'&&draft?'editor':view==='explore'&&explore.length?'explore':route.page;
 useEffect(()=>{cancelSpeech();setSearch('');setError('');if(location.state?.view!=='editor')setDraft(null);if(location.state?.view!=='explore')setExplore([]);window.scrollTo(0,0)},[location.key]);
 const refresh=useCallback(async()=>{try{const library=await store.read();const savedDrafts=await store.drafts();setData(previous=>previous&&previous.revision>library.revision?previous:library);setDrafts(savedDrafts.filter(d=>library.decks.some(parent=>parent.id===d.card.deckId)));setError('')}catch(e){setError(errorText(e,translator('pt')))}},[store]);
 useEffect(()=>{void refresh()},[refresh]); useEffect(()=>{
  if(!data)return;
  const query=new URLSearchParams(location.search);
  const action=query.get('createArea')==='1'&&route.page==='decks'?'createArea':query.get('createCard')==='1'&&route.page==='area'?'createCard':query.get('review')==='1'&&route.page==='home'?'review':null;
  if(!action)return;
  const actionKey=location.pathname+':'+action+':'+(route.areaId||'')+':'+(query.get('email_message_id')||'');
  if(processedEmailAction.current===actionKey)return;
  processedEmailAction.current=actionKey;
  query.delete(action);const qs=query.toString();const clean=location.pathname+(qs?'?'+qs:'');
  if(action==='createArea'){go(clean,{replace:true});setDialog({kind:'area'});return}
  if(action==='createCard'){
   const area=data.areas.find(item=>item.id===route.areaId&&!item.deleted&&!item.archived);
   const parent=data.decks.find(deck=>deck.areaId===route.areaId&&!deck.deleted&&!deck.archived);
   if(area&&parent){go(clean,{replace:true});void edit(blankCard(parent))}
   else go(paths.areas+(qs?'?'+qs:''),{replace:true});
   return
  }
  const queue=reviewQueue(data,new Date());
  if(queue.length){setExplore(queue);setSessionCompleted(false);setSessionId(crypto.randomUUID());setIndex(0);setBack(false);go(clean,{replace:true,state:{view:'explore'}})}
  else go(clean,{replace:true});
 },[data?.revision,location.key,location.pathname,location.search,route.page,route.areaId]);
useEffect(()=>{document.documentElement.lang=data?.preferences.locale==='pt'?'pt-BR':data?.preferences.locale??'pt'},[data?.preferences.locale]);useEffect(()=>{if(!toast)return;const timeout=setTimeout(()=>setToast(''),3500);return()=>clearTimeout(timeout)},[toast]);
 useEffect(()=>{if(busy||dialog||!['home','decks','area'].includes(page))return;const reload=()=>{if(document.visibilityState==='visible')void refresh()};const timer=setInterval(reload,15000);window.addEventListener('focus',reload);window.addEventListener('online',reload);document.addEventListener('visibilitychange',reload);return()=>{clearInterval(timer);window.removeEventListener('focus',reload);window.removeEventListener('online',reload);document.removeEventListener('visibilitychange',reload)}},[page,busy,dialog,refresh]);
 const navigate=(next:Page,id=areaId)=>{const path=next==='home'?paths.home:next==='settings'?paths.settings:next==='decks'?paths.areas:id?areaPath(id):paths.areas;go(path,{state:next==='editor'||next==='explore'?{view:next}:null})};
 async function mutate(fn:(library:Library)=>void){if(!data)return false;setBusy(true);try{const updated=await store.mutate(data.revision,fn);setData(updated);setError('');return true}catch(e){setError(errorText(e,t));return false}finally{setBusy(false)}}
 function revealReview(){if(busy||flipAnimating||reviewLock.current)return;reviewFocus.current='answer';cancelSpeech();if(window.matchMedia?.('(prefers-reduced-motion: reduce)').matches){setBack(true);return}setFlipAnimating(true);setBack(true)}
 async function confirmReview(known:boolean){
  const card=explore[index];
  if(!card||!back||busy||flipAnimating||reviewLock.current)return;
  reviewLock.current=true;
  cancelSpeech();
  const previous=data?.reviews?.find(event=>event.sessionId===sessionId&&event.cardId===card.id&&!event.retryOf);
  const event={id:sessionId+':'+index,sessionId,retryOf:previous?.id,cardId:card.id,at:new Date().toISOString(),known};
  let saved=false;
  let repeatInSession=false;
  try{
   saved=await mutate(library=>{repeatInSession=applyReview(library,event)});
   if(!saved)return;
   recordEngagementConversion('review');
   if(repeatInSession){
    setExplore(cards=>[...cards,card]);
   }else if(index+1===explore.length){
    setSessionCompleted(true);
    void cloud?.rpc('brains_review_session_completed',{p_session_id:sessionId}).then(()=>{},()=>{});
    recordEngagementConversion('session');
   }
   reviewFocus.current='reveal';
   setBack(false);
   setIndex(index+1);
  }finally{
   if(!saved)reviewLock.current=false;
  }
 }
 async function edit(card:Card){const existing=drafts.find(d=>d.card.id===card.id);const next=existing??{id:crypto.randomUUID(),card,baseVersion:card.version,revision:0,savedAt:new Date().toISOString()};setBusy(true);try{const saved=existing??next;setDraft(saved);setDrafts(await store.drafts());navigate('editor',data?.decks.find(d=>d.id===card.deckId)?.areaId)}catch(e){setError(errorText(e,t))}finally{setBusy(false)}}
 const activeDeck=(id:string)=>!!data?.decks.some(d=>d.id===id&&!d.deleted&&!d.archived&&data.areas.some(a=>a.id===d.areaId&&!a.deleted&&!a.archived));
 const setState=async(type:'areas'|'decks'|'cards',id:string,field:'deleted',value:boolean)=>{await mutate(db=>{const item=db[type].find(i=>i.id===id);if(!item)return;if(field==='deleted'&&!value)restoreCollectionItem(item);else item[field]=value;if(type==='cards'){const card=item as Card;card.version++;card.updatedAt=new Date().toISOString()}})};
 const study=useMemo(()=>data?{progress:dailyProgress(data,now),...reviewQueues(data,now)}:null,[data,now]);
 const libraryIndex = useMemo(() => data ? indexLibrary(data) : null, [data]);
 const dueFormatter = useMemo(() => new Intl.DateTimeFormat(data?.preferences.locale, {
  timeZone: data?.preferences.timezone, day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit',
 }), [data?.preferences.locale, data?.preferences.timezone]);
 if(!data||!study||!libraryIndex)return <main className="main standalone"><h1>Brains</h1><p role="status">{error||t('loading')}</p>{error&&<Button className="primary" onClick={()=>void refresh()}>{t('retry')}</Button>}{error&&<AccountPanel locale='pt'/>}</main>;
 const area=libraryIndex.areas.get(areaId);const areaDecks=data.decks.filter(d=>d.areaId===areaId);const progress=study.progress;const dailyRemaining=study.queue.length;const dailyTotal=progress.cards+dailyRemaining;const matchState=(item:{deleted:boolean;archived:boolean})=>matchesCollection(item,tab);
 const formatDue=(date:Date|string)=>dueFormatter.format(new Date(date));
 let nextReview: Date | undefined;
 if (page === 'explore' && sessionCompleted) {
  for (const card of data.cards) {
   if (card.deleted || card.archived || !card.memory) continue;
   const due = effectiveDue(data, card);
   if (due && due > now && (!nextReview || due < nextReview)) nextReview = due;
  }
 }
 function createAnotherCard(id:string|undefined){const parent=data!.decks.find(d=>d.areaId===id&&!d.deleted&&!d.archived);if(parent)void edit(blankCard(parent));else navigate('decks')}
 function reviewState(id:string){if(study!.areas.get(id)?.length)return null;if(progress.cards>=data!.preferences.goal)return <p className="review-state">{t('goalReached')}</p>;const cards=(libraryIndex!.cardsByArea.get(id)??[]).filter(c=>{const deck=libraryIndex!.decks.get(c.deckId);return !c.deleted&&!c.archived&&deck&&!deck.archived&&!deck.deleted});const due=cards.filter(c=>c.memory).map(c=>effectiveDue(data!,c)!).sort((a,b)=>+a-+b)[0];return <p className="review-state">{cards.length===0?t('addFirst'): <>{t('noDue')}{due&&<> · {t('nextReview')}: <time dateTime={due.toISOString()}>{formatDue(due)}</time></>}</>}</p>}
 const navigation=(group:string)=><>{(['home','decks','settings'] as const).map((p,i)=>{const current=page===p||(p==='decks'&&['area','explore','editor'].includes(page));const Icon=[BookOpen,Layers,SettingsIcon][i];const label=<>{current&&<motion.span aria-hidden="true" className="nav-indicator" layoutId={reduceMotion ? undefined : group} transition={motionTransition(.18)}/>}<Icon className="nav-icon" aria-hidden="true"/>{t(['today','decks','settings'][i] as 'today')}</>;return page==='editor'?<Button key={p} className={`nav ${current?'active':''}`} disabled>{label}</Button>:<MotionLink whileTap={reduceMotion ? undefined : {scale:.96}} transition={motionTransition()} key={p} to={p==='decks'?paths.areas:paths[p]} aria-current={current?'page':undefined} onClick={()=>setTab('active')} className={`nav ${current?'active':''}`}>{label}</MotionLink>})}</>;

 const visibleCards = page === 'area'
  ? (libraryIndex.cardsByArea.get(areaId) ?? []).filter(card =>
   matchState(card) && (card.front.text + ' ' + card.back.text).toLocaleLowerCase().includes(search.toLocaleLowerCase()))
  : [];
 const filterScope = `collection:${page}:${page === "area" ? areaId : ""}`;
 const filters=<LayoutGroup key={filterScope} id={filterScope}><div className="tabs" role="group" aria-label={t('collection')}>{(['active','trash'] as const).map(value=><Button aria-pressed={tab===value} className={tab===value?'selected':''} key={value} onClick={()=>setTab(value)}>{tab===value&&<motion.span aria-hidden="true" className="tab-indicator" layoutId={reduceMotion ? undefined : "collection-filter"} transition={motionTransition(.18)}/>}<span>{t(value)}</span></Button>)}</div></LayoutGroup>;
 function controls(type:'areas'|'decks'|'cards',item:Area|Deck|Card){return <div className="item-actions">{(item.deleted||item.archived)?<><Button className="text-btn" disabled={busy} onClick={()=>void setState(type,item.id,'deleted',false)}>{t('restore')}</Button>{!item.deleted&&<Button className="text-btn danger" disabled={busy} onClick={()=>setDialog({kind:'delete',type,id:item.id})}>{t('remove')}</Button>}{item.deleted&&(type==='cards'||type==='areas')&&<Button className="text-btn danger" disabled={busy} onClick={()=>setDialog({kind:'purge',id:item.id,type:type as 'areas'|'cards'})}>{t('deleteForever')}</Button>}</>:<><Button className="text-btn danger" disabled={busy} onClick={()=>setDialog({kind:'delete',type,id:item.id})}>{t('remove')}</Button></>}</div>}
 return <MotionConfig reducedMotion="user"><Suspense fallback={<main className="main standalone" role="status">{t('loading')}</main>}><div className="shell"><aside className="side"><div className="brand"><span className="mark">B</span>Brains</div><nav><LayoutGroup id="sidebar">{navigation("active-nav")}</LayoutGroup></nav></aside><main className="main"><header className="top"><div className="brand"><span className="mark">B</span>Brains</div></header>{page!=='settings'&&<CloudStatus compact t={t}/>} {error&&<div className="error" role="alert">{error}<Button className="text-btn" onClick={()=>void refresh()}>{t('reload')}</Button></div>}
 {(page==='home'||page==='decks')&&<>{page==='home'?<><p className="small">{new Date().toLocaleDateString(data.preferences.locale,{day:'numeric',month:'long'})}</p><h1>{t('title')}</h1><p className="muted">{t('subtitle')}</p><div className="hero"><span>{t('dailyProgress')}</span>{dailyTotal>0?<><div className="row"><strong>{progress.cards}<span className="goal-total"> / {dailyTotal}</span></strong><span>{t('studied')}</span></div><div className="track"><ProgressFill value={progress.cards/dailyTotal}/></div></>:<div className="row"><strong>{t('noDue')}</strong></div>}<div className="row"><span>{progress.attempts>0&&<>{progress.attempts} {t('attempts')} · </>}{t('dailyCap')}: {data.preferences.goal}</span>{dailyTotal>0&&<span>{progress.cards>=data.preferences.goal?t('goalReached'):dailyRemaining>0?dailyRemaining+' '+t('remainingToday'):t('complete')}</span>}</div></div></>:<h1>{t('decks')}</h1>}{drafts.length>0&&<div className="notice"><h2>{t('drafts')}</h2>{drafts.map(d=><div className="row" key={d.id}><span>{d.card.front.text||t('untitled')}</span><Button className="text-btn" onClick={()=>{setDraft(d);navigate('editor',data.decks.find(parent=>parent.id===d.card.deckId)?.areaId)}}>{t('resume')} <ArrowRight className="action-icon" size={16} aria-hidden="true"/></Button></div>)}</div>}<div className="section row"><h2>{t('areas')}</h2><Button className="text-btn" onClick={()=>setDialog({kind:'area'})}><Plus className="action-icon" size={16} aria-hidden="true"/> {t('newArea')}</Button></div>{filters}<div className="grid motion-area-grid"><AnimatePresence initial={false} mode="popLayout">{data.areas.filter(matchState).map((a,position)=><motion.section className="tile" key={a.id} initial={reduceMotion || position>=4 ? false : {opacity:0,y:4}} animate={{opacity:1,y:0}} exit={{opacity:0}} transition={{ ...motionTransition(reduceMotion ? 0 : .14), delay: reduceMotion || position >= 4 ? 0 : position * .035 }}><Button className="tile-open" onClick={()=>{setTab('active');navigate('area',a.id)}}><div className="flag" aria-hidden="true"><Layers size={24}/></div><h2>{a.name}</h2><span className="small">{(()=>{const count=libraryIndex.activeCardCounts.get(a.id)??0;return count+' '+t(count===1?'cardSingular':'cards')})()} <ArrowRight className="action-icon" size={16} aria-hidden="true"/></span></Button>{!a.deleted&&!a.archived&&<div className="area-actions"><Button className="secondary" onClick={()=>{setTab('active');navigate('area',a.id)}}>{t('openDecks')}</Button><Button className="primary" disabled={!study.areas.get(a.id)?.length} onClick={()=>{setExplore(reviewQueue(data,new Date(),a.id));setSessionCompleted(false);setSessionId(crypto.randomUUID());setIndex(0);setBack(false);navigate('explore',a.id)}}>{t('review')} <ArrowRight size={16} aria-hidden="true"/></Button></div>}{!a.deleted&&!a.archived&&reviewState(a.id)}<details><summary>{t('manage')}<ChevronDown className="disclosure-icon" size={16} aria-hidden="true"/></summary>{!a.deleted&&<Button className="text-btn" onClick={()=>setDialog({kind:'area',item:a})}>{t('edit')}</Button>}{controls('areas',a)}</details></motion.section>)}</AnimatePresence></div><AnimatePresence>{!data.areas.filter(matchState).length&&<motion.div className="empty" initial={reduceMotion ? false : {opacity:0}} animate={{opacity:1}} exit={{opacity:0}} transition={motionTransition(reduceMotion ? 0 : .14)}><h2>{t(tab==='active'?'empty':'emptyTrash')}</h2>{tab==='active'&&<><p>{t('emptyHelp')}</p><Button className="primary" onClick={()=>setDialog({kind:'area'})}><Plus className="action-icon" size={16} aria-hidden="true"/> {t('newArea')}</Button></>}</motion.div>}</AnimatePresence></>}
 {page==='area'&&!area&&<div className="empty"><p>{t('noResults')}</p><Link to={paths.areas}>{t('back')}</Link></div>}
 {page==='area'&&area&&<><Button className="back" onClick={()=>{setTab('active');navigate('decks')}}><ArrowLeft size={16} aria-hidden="true"/> {t('back')}</Button><div className="row"><h1>{area.name}</h1></div>{!area.deleted&&!area.archived&&<div className="area-actions"><Button className="primary" disabled={busy} onClick={()=>{const parent=areaDecks[0];if(parent)void edit(blankCard(parent))}}><Plus className="action-icon" size={16} aria-hidden="true"/> {t('add')}</Button><Button className="secondary" disabled={!study.areas.get(areaId)?.length} onClick={()=>{setExplore(reviewQueue(data,new Date(),areaId));setSessionId(crypto.randomUUID());setIndex(0);setBack(false);navigate('explore')}}>{t('review')} <ArrowRight className="action-icon" size={16} aria-hidden="true"/></Button></div>}{!area.deleted&&!area.archived&&reviewState(area.id)}{(area.deleted||area.archived)&&<p className="notice">{t('archivedParent')}</p>}{filters}<Input aria-label={t('search')} placeholder={t('search')} value={search} onChange={e=>setSearch(e.target.value)}/><div className="list">{visibleCards.map(c=><section className="entry" key={c.id}><h2>{c.front.text}</h2><p className="small">{c.back.text}</p><p className="small">{c.memory?t('nextReview')+': '+formatDue(effectiveDue(data,c)!):t('newCard')}</p>{!c.deleted&&activeDeck(c.deckId)&&<Button className="text-btn" disabled={busy} onClick={()=>void edit(c)}>{t('edit')}</Button>}{controls('cards',c)}</section>)}</div>{!visibleCards.length&&<p className="empty">{t('noResults')}</p>}</>}
 {page==='editor'&&draft&&<Editor key={draft.id} initial={draft} library={data} t={t} onSaved={updated=>{const created=!!draft&&!draft.baseVersion&&updated.cards.some(c=>c.id===draft.card.id);const first=created&&data.cards.length===0; if(created)recordEngagementConversion('card');const savedArea=updated.decks.find(d=>d.id===draft.card.deckId)?.areaId;setData(updated);if(!first)setToast(t('saved'));void store.drafts().then(setDrafts);navigate('area',savedArea);if(first){if(!cloud)setFirstCardCelebration(savedArea??'');else void cloud.rpc('brains_claim_first_card_celebration').then(({data:show,error})=>{if(show||error)setFirstCardCelebration(savedArea??'')},()=>setFirstCardCelebration(savedArea??''))}}} onExit={()=>{void refresh();navigate('home')}}/>}
 {page==='explore'&&<><Button className="back" disabled={busy||flipAnimating} onClick={()=>navigate('area')}><ArrowLeft size={16} aria-hidden="true"/> {t('back')}</Button>{index<explore.length&&reviewSides?<><div className="row"><h2>{t('viewing')}</h2><span>{index+1} / {explore.length}</span></div><div className="progress" role="progressbar" aria-valuemin={0} aria-valuemax={explore.length} aria-valuenow={index} aria-label={t('viewing')}><ProgressFill value={index/explore.length}/></div><div className="flash review-flash" key={`${explore[index].id}:${index}`}><div className={`flash-flipper${back?' is-back':''}`} onTransitionEnd={event=>{if(event.target===event.currentTarget&&event.propertyName==='transform')setFlipAnimating(false)}} aria-busy={flipAnimating}><section className="flash-face flash-face-front" aria-hidden={back} inert={back}><span className="eyebrow">{t('front')}</span><SideView side={reviewSides.front} t={t} automatic={false} showPronunciation/></section><section className="flash-face flash-face-back" ref={answerFocus} tabIndex={-1} aria-label={t('answer')} aria-hidden={!back} inert={!back}><span className="eyebrow">{t('answer')}</span><SideView side={reviewSides.back} t={t} automatic showPronunciation={false}/></section></div></div><div className="review-actions" aria-busy={busy}><AnimatePresence initial={false}>{back?<motion.div key="grade" className="actions" initial={reduceMotion ? false : {opacity:0}} animate={{opacity:1}} transition={motionTransition()}><Button className="good" disabled={busy||flipAnimating} onClick={()=>void confirmReview(true)}>{busy?t('saving'):t('reviewKnow')}</Button><Button className="bad" disabled={busy||flipAnimating} onClick={()=>void confirmReview(false)}>{busy?t('saving'):t('reviewDontKnow')}</Button></motion.div>:<Button key="reveal" ref={revealFocus} className="primary wide" disabled={busy} onClick={revealReview}>{t('reveal')}</Button>}</AnimatePresence></div><p className="review-state center" role="status" aria-live="polite">{t(back?'confirmRecall':'thinkBeforeReveal')}</p></>:<div className="center">{sessionCompleted?<Celebration kind="reviews-complete" nextReview={nextReview?formatDue(nextReview):undefined} onClose={()=>navigate('home')} onAction={()=>createAnotherCard(areaId)}/>:<Button className="primary wide" onClick={()=>navigate('home')}>{t('home')}</Button>}</div>}</>}
 {page==='settings'&&<h1>{t('settings')}</h1>}
 {page==='settings'&&<CloudStatus t={t}/>}
 
 {page==='settings'&&<Settings preview={preview} key={data.revision} data={data} t={t} onSave={async preferences=>{if(await mutate(d=>{d.preferences=preferences}))setToast(translator(preferences.locale)('preferencesSaved'))}}/>}
 {page==='settings'&&(preview?<CardSurface className="spaced"><h2>Sua conta</h2><p>demo@example.com</p><Button className="secondary" onClick={()=>go(paths.login)}>Sair da conta</Button></CardSurface>:<AccountPanel locale={data.preferences.locale}/>)}
 {page==='settings'&&<Button className="primary wide" type="submit" form="app-settings-form" disabled={busy}>{t('saveSettings')}</Button>}
 </main><nav className="bottom"><LayoutGroup id="bottom-nav">{navigation("active-nav")}</LayoutGroup></nav><AnimatePresence>{toast&&<motion.div className="toast" role="status" initial={reduceMotion ? false : {opacity:0}} animate={{opacity:1}} exit={{opacity:0}} transition={motionTransition(reduceMotion ? 0 : .12)}>{toast}</motion.div>}</AnimatePresence><AnimatePresence>{dialog&&<Dialog title={t(dialog.kind==='purge'?'deleteForever':dialog.kind==='delete'?'confirmRemove':dialog.item?'edit':dialog.kind==='area'?'newArea':'newDeck')} closeLabel={t('cancel')} onClose={()=>{if(!busy)setDialog(null)}}>{dialog.kind==='purge'?<><p>{t(dialog.type==='areas'?'purgeAreaWarning':'purgeWarning')}</p>{dialog.type==='areas'&&<p><strong>{data.areas.find(a=>a.id===dialog.id)?.name}</strong> · {(libraryIndex.cardsByArea.get(dialog.id)??[]).length} {t('cards')}</p>}<Button className="primary wide" disabled={busy} onClick={async()=>{setBusy(true);try{if(dialog.type==='areas')await store.purgeArea(dialog.id,data.revision);else await store.purgeCard(dialog.id,data.revision);setDialog(null);await refresh()}catch(e){setError(errorText(e,t))}finally{setBusy(false)}}}>{t('deleteForever')}</Button></>:dialog.kind==='delete'?<><p>{t('recoverable')}</p><Button className="primary wide" disabled={busy} onClick={async()=>{await setState(dialog.type,dialog.id,'deleted',true);setDialog(null)}}>{t('remove')}</Button></>:<CollectionForm kind={dialog.kind} item={dialog.item&&dialog.kind==='area'?{...dialog.item,language:data.decks.find(d=>d.areaId===dialog.item!.id)?.language??'en-US'}:dialog.item} t={t} busy={busy} onSubmit={async(name,language)=>{let areaCreated=false;const ok=await mutate(d=>{if(dialog.kind==='area'){if(dialog.item){d.areas.find(a=>a.id===dialog.item!.id)!.name=name;for(const parent of d.decks.filter(v=>v.areaId===dialog.item!.id)){parent.name=name;parent.language=language}}else{const id=crypto.randomUUID();areaCreated=true;d.areas.push({id,name,archived:false,deleted:false});d.decks.push({id:crypto.randomUUID(),areaId:id,name,language,archived:false,deleted:false})}}else if(dialog.item){const deck=d.decks.find(v=>v.id===dialog.item!.id)!;deck.name=name;deck.language=language}else d.decks.push({id:crypto.randomUUID(),areaId,name,language,archived:false,deleted:false})});if(ok){setDialog(null);if(areaCreated)recordEngagementConversion('area')}}}/>}</Dialog>}</AnimatePresence>{firstCardCelebration!==null&&<Celebration kind="first-card" onClose={()=>setFirstCardCelebration(null)} onAction={()=>{const id=firstCardCelebration;setFirstCardCelebration(null);createAnotherCard(id)}}/>}</div></Suspense></MotionConfig>
}
function CollectionForm({kind,item,t,busy,onSubmit}:{kind:'area'|'deck';item?:Area|Deck;t:T;busy:boolean;onSubmit:(name:string,language:string)=>Promise<void>}){const [name,setName]=useState(item?.name??'');const [language,setLanguage]=useState(item&&'language'in item?item.language:'en-US');return <form onSubmit={e=>{e.preventDefault();if(name.trim())void onSubmit(name.trim(),language)}}><label htmlFor="collection-name">{t('name')}</label><Input id="collection-name" autoFocus value={name} onChange={e=>setName(e.target.value)} required maxLength={60}/>{<><label htmlFor="collection-language">{t('language')}</label><Select id="collection-language" value={language} onValueChange={value=>setLanguage(value)}>{languages.map(([value,label])=><SelectOption key={value} value={value}>{label}</SelectOption>)}</Select></>}<Button disabled={busy||!name.trim()} className="primary wide spaced">{t(busy?'saving':item?'saveSettings':'create')}</Button></form>}
function Settings({data,t,onSave,preview=false}:{preview?:boolean;data:Library;t:T;onSave:(preferences:Library['preferences'])=>Promise<void>}){
 const [preferences,setPreferences]=useState(data.preferences);
 const [error,setError]=useState('');
 const [showGoalInfo,setShowGoalInfo]=useState(false);
 return <form id="app-settings-form" onSubmit={e=>{e.preventDefault();try{if(!Number.isInteger(preferences.goal)||preferences.goal<1||preferences.goal>999)throw Error();new Intl.DateTimeFormat('en',{timeZone:preferences.timezone}).format();void onSave(preferences)}catch{setError(t('invalidSettings'))}}}>
  <div className="panel">
   <label htmlFor="locale">{t('uiLanguage')}</label>
   <Select id="locale" value={preferences.locale} onValueChange={value=>setPreferences({...preferences,locale:value as Locale})}><SelectOption value="pt">Português (Brasil)</SelectOption><SelectOption value="en">English</SelectOption><SelectOption value="es">Español</SelectOption></Select>
   <div className="setting-label-row"><label htmlFor="goal">{t('goal')}</label><Button className="setting-info-button" type="button" aria-label={t('goalInfoLabel')} aria-expanded={showGoalInfo} aria-controls={showGoalInfo?'goal-info':undefined} onClick={()=>setShowGoalInfo(value=>!value)}><Info size={20} aria-hidden="true"/></Button></div>
   <Input id="goal" aria-describedby={showGoalInfo?'goal-help goal-info':'goal-help'} type="number" min={1} max={999} required value={preferences.goal} onChange={e=>setPreferences({...preferences,goal:+e.target.value})}/>
   <p id="goal-help" className="small">{t('goalHelp')}</p>
   {showGoalInfo&&<p id="goal-info" className="goal-info small">{t('goalInfo')}</p>}
   <label htmlFor="timezone">{t('timezone')}</label>
   <Select id="timezone" value={preferences.timezone} onValueChange={value=>setPreferences({...preferences,timezone:value})}>{Array.from(new Set([preferences.timezone,...((Intl as unknown as {supportedValuesOf?:(key:string)=>string[]}).supportedValuesOf?.("timeZone")??["UTC","America/Sao_Paulo","Europe/Madrid","America/New_York"])])).sort().map(zone=><SelectOption key={zone} value={zone}>{zone.split("/").reverse().join(" · ").replaceAll("_"," ")}</SelectOption>)}</Select>
  </div>
  <EmailConsent preview={preview}/>
  {error&&<p className="error" role="alert">{error}</p>}
 </form>
}


const MotionLink = motion.create(Link);

function ProgressFill({ value }: { value: number }) {
  const reduced = useReducedMotion();
  return <motion.div className="fill" initial={false} animate={{ scaleX: Math.min(1, Math.max(0, value)) }} transition={motionTransition(reduced ? 0 : 0.2)} />;
}
