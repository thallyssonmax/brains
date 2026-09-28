import {useEffect,useRef,useState} from 'react';
import {Link,NavLink,useLocation,useSearchParams} from 'react-router-dom';
import {Dialog} from './Dialog';
import {adminRequest,conversion,date,number,type AdminUser,type Funnel,type Metric,type Overview,type Point,type Users} from './admin-data';
import './admin.css';

function useAdminData<T>(rpc:string,args:Record<string,unknown>){
 const key=JSON.stringify(args);
 const [state,setState]=useState<{data:T|null;error:string;loading:boolean}>({data:null,error:'',loading:true});
 const [version,retry]=useState(0);
 useEffect(()=>{const controller=new AbortController();setState({data:null,error:'',loading:true});void adminRequest<T>(rpc,JSON.parse(key),controller.signal).then(data=>{if(!controller.signal.aborted)setState({data,error:'',loading:false})}).catch(error=>{if(!controller.signal.aborted)setState({data:null,error:error.message,loading:false})});return()=>controller.abort()},[rpc,key,version]);
 return {...state,retry:()=>retry(x=>x+1)};
}
function Status({loading,error,retry}:{loading:boolean;error:string;retry:()=>void}){
 return loading?<div className="admin-loading" role="status"><div/><div/><div/><p>Carregando dados…</p></div>:error?<div className="error" role="alert">{error}<button className="text-btn" onClick={retry}>Tentar novamente</button></div>:null;
}
type ChartMode='columns'|'lines';
function GrowthChart({points,metric,mode}:{points:Point[];metric:Metric;mode:ChartMode}){
 const canvas=useRef<HTMLCanvasElement>(null);
 const [selected,setSelected]=useState<number|null>(null);
 const peak=Math.max(1,...points.map(p=>p[metric]));
 const divisions=Math.min(4,peak),maximum=Math.ceil(peak/divisions)*divisions;
 useEffect(()=>{const node=canvas.current;if(!node)return;const draw=()=>{
  const width=node.clientWidth,height=240,scale=window.devicePixelRatio||1;node.width=width*scale;node.height=height*scale;
  const ctx=node.getContext('2d');if(!ctx)return;ctx.scale(scale,scale);ctx.clearRect(0,0,width,height);
  const left=38,right=12,top=16,bottom=28,plotWidth=width-left-right,plotHeight=height-top-bottom;
  ctx.font='12px Inter, sans-serif';ctx.textAlign='right';
  for(let i=0;i<=divisions;i++){const y=top+plotHeight*i/divisions;ctx.strokeStyle='#e8edf5';ctx.beginPath();ctx.moveTo(left,y);ctx.lineTo(width-right,y);ctx.stroke();ctx.fillStyle='#526078';ctx.fillText(String(maximum-i*maximum/divisions),left-8,y+4)}
  const step=plotWidth/Math.max(points.length,1);
  if(mode==='columns'){
   points.forEach((p,i)=>{const h=p[metric]/maximum*plotHeight;ctx.fillStyle=selected===i?'#173da6':'#2458e6';ctx.fillRect(left+i*step+step*.18,top+plotHeight-h,Math.max(1,step*.64),h)});
  }else{
   ctx.strokeStyle='#2458e6';ctx.lineWidth=2;ctx.lineJoin='round';ctx.beginPath();
   points.forEach((p,i)=>{const x=left+(i+.5)*step,y=top+plotHeight-p[metric]/maximum*plotHeight;if(i===0)ctx.moveTo(x,y);else ctx.lineTo(x,y)});ctx.stroke();
   points.forEach((p,i)=>{if(points.length>31&&i!==selected)return;ctx.beginPath();ctx.arc(left+(i+.5)*step,top+plotHeight-p[metric]/maximum*plotHeight,i===selected?5:3,0,Math.PI*2);ctx.fillStyle=i===selected?'#173da6':'#2458e6';ctx.fill()});
  }
  ctx.textAlign='left';ctx.fillStyle='#526078';if(points.length){ctx.fillText(points[0].day.slice(5).split('-').reverse().join('/'),left,height-4);ctx.textAlign='right';ctx.fillText(points[points.length-1].day.slice(5).split('-').reverse().join('/'),width-right,height-4)}
 };draw();const observer=new ResizeObserver(draw);observer.observe(node);return()=>observer.disconnect()},[points,metric,maximum,divisions,selected,mode]);
 const total=points.reduce((sum,p)=>sum+p[metric],0);
 return <><div className="admin-chart-summary"><strong>{number(total)}</strong><span className="small">no período selecionado</span><span className="small" aria-live="polite">{selected!==null&&points[selected]?`${points[selected].day.split('-').reverse().join('/')} · ${number(points[selected][metric])}`:''}</span></div>
 {total===0?<div className="admin-empty"><h3>Sem novas criações neste período</h3><p>Experimente outro período para acompanhar a evolução.</p></div>:<canvas ref={canvas} className="admin-chart" role="img" aria-label={`Gráfico de ${mode==='lines'?'linhas':'colunas'}. Criações por dia: ${number(total)} no período. Os valores estão disponíveis na tabela abaixo.`} onMouseMove={e=>{const r=e.currentTarget.getBoundingClientRect();setSelected(Math.max(0,Math.min(points.length-1,Math.floor((e.clientX-r.left-38)/(r.width-50)*points.length))))}} onMouseLeave={()=>setSelected(null)}/>}
 <details className="admin-chart-data"><summary>Ver valores por dia</summary><div className="admin-table-scroll"><table><thead><tr><th>Dia</th><th>Criações</th></tr></thead><tbody>{points.map(p=><tr key={p.day}><td>{p.day.split('-').reverse().join('/')}</td><td>{number(p[metric])}</td></tr>)}</tbody></table></div></details></>;
}
function OverviewPage({days}:{days:number}){
 const state=useAdminData<Overview>('brains_admin_overview',{p_days:days});
 const [metric,setMetric]=useState<Metric>('accounts');
 const [chartMode,setChartMode]=useState<ChartMode>('columns');
 const d=state.data;
 return <><Status {...state}/>{d&&<>
 <div className="admin-kpis">{[
  ['Contas',d.accounts,`+${number(d.accounts_today)} hoje`,'Total de contas cadastradas'],
  ['Áreas',d.areas,`+${number(d.areas_today)} hoje`,'Áreas existentes, incluindo arquivadas; exclui lixeira'],
  ['Cards',d.cards,`+${number(d.cards_today)} hoje`,'Cards existentes; exclui lixeira'],
  ['DAU',d.dau,'Ativos hoje','Usuários únicos que criaram áreas ou cards, ou revisaram cards hoje'],
  ['WAU',d.wau,'Últimos 7 dias','Usuários com atividade real nos últimos 7 dias, incluindo hoje'],
  ['MAU',d.mau,'Últimos 30 dias','Usuários com atividade real nos últimos 30 dias, incluindo hoje']
 ].map(([label,value,detail,title])=><article className="admin-kpi" key={label} title={String(title)}><span>{label}</span><strong>{number(Number(value))}</strong><small>{detail}</small></article>)}</div>
 <section className="panel admin-growth"><div className="row"><div><h2>Crescimento</h2><p className="small">Novas criações por dia</p></div><div className="admin-segment" aria-label="Métrica do gráfico">{(['accounts','areas','cards'] as Metric[]).map((m,i)=><button key={m} aria-pressed={metric===m} className={metric===m?'selected':''} onClick={()=>setMetric(m)}>{['Contas','Áreas','Cards'][i]}</button>)}</div></div>{metric==='areas'&&<p className="small">Histórico de áreas disponível desde {date(d.tracking_since)}; dias anteriores não são exibidos.</p>}<div className="admin-chart-mode" role="group" aria-label="Visualização do gráfico"><button type="button" aria-pressed={chartMode==='columns'} className={chartMode==='columns'?'selected':undefined} onClick={()=>setChartMode('columns')}>Colunas</button><button type="button" aria-pressed={chartMode==='lines'} className={chartMode==='lines'?'selected':undefined} onClick={()=>setChartMode('lines')}>Linhas</button></div><GrowthChart mode={chartMode} points={metric==='areas'?d.series.filter(p=>p.day>=new Intl.DateTimeFormat('en-CA',{timeZone:'America/Sao_Paulo',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(d.tracking_since))):d.series} metric={metric}/></section>
 <div className="admin-note-row"><p className="small"><strong>{number(d.period_active)} usuários ativos</strong> no período selecionado. Atividade significa criar ou revisar conteúdo; abrir páginas não conta.</p><Link to={'/admin/funnel?period='+days} className="text-btn">Explorar o funil →</Link></div>
 <details className="admin-definitions"><summary>Como ler estes números</summary><p>Contas, áreas e cards são totais atuais. DAU, WAU e MAU mantêm suas janelas fixas. O filtro altera o gráfico e os ativos do período. Dias seguem o horário de Brasília.</p><p>O histórico de áreas está disponível desde {date(d.tracking_since)}. Registros anteriores entram no total, mas não no gráfico. O histórico de cards usa a data de criação já existente em cada card.</p><p>Criações de cards e revisões vêm da biblioteca existente. Exclusões definitivas também removem esse histórico da fonte.</p></details>
 </>}</>;
}
function FunnelPage({days}:{days:number}){
 const state=useAdminData<Funnel>('brains_admin_funnel',{p_days:days});const d=state.data;
 return <><Status {...state}/>{d&&<><section className="panel"><div className="row"><div><h2>Da primeira visita à Home</h2><p className="small">Uma jornada, quatro etapas.</p></div><span className="tag">{conversion(d.steps[3],d.steps[0])??'—'}{d.steps[0]>0?'%':''} chegam à Home</span></div>
 {d.steps[0]===0?<div className="admin-empty"><h3>O funil ainda não tem visitas neste período</h3><p>As jornadas aparecerão a partir dos novos acessos à landing page.</p></div>:<ol className="admin-funnel">{['Landing Page','Login','Autenticação concluída','Home'].map((label,i)=>{const rate=i?conversion(d.steps[i],d.steps[i-1]):100;const lost=i?d.steps[i-1]-d.steps[i]:0;return <li key={label}><div className="admin-stage-heading"><span className="admin-stage-number">0{i+1}</span><h3>{label}</h3><strong>{number(d.steps[i])}</strong><span className="small">usuários únicos</span></div><div className="admin-funnel-track"><div style={{width:`${d.steps[0]?d.steps[i]/d.steps[0]*100:0}%`}}/></div><p className="small">{i===0?'Entrada do funil':<><strong>{rate===null?'—':`${rate}%`}</strong> avançaram · {number(lost)} abandonaram{rate!==null?` (${100-rate}%)`:''}</>}</p></li>})}</ol>}
 <p className="small">Etapas em ordem, dentro do período. Entradas diretas no app não entram neste funil. Antes do login, a identificação depende do navegador.</p></section>
 <section className="panel"><h2>Page usage</h2><p className="small">Acessos às páginas do produto, sem etapas obrigatórias.</p><div className="admin-table-scroll"><table><thead><tr><th>Página</th><th>Page views</th><th>Usuários únicos</th><th>Dos ativos</th></tr></thead><tbody>{['/home','/areas','/settings'].map((path,i)=>{const page=d.pages.find(p=>p.path===path);return <tr key={path}><td><strong>{['Home','Areas','Settings'][i]}</strong><span className="small admin-cell-sub">{path}</span></td><td>{number(page?.views??0)}</td><td>{number(page?.users??0)}</td><td>{page?.active_percent==null?'—':`${page.active_percent}%`}</td></tr>})}</tbody></table></div><p className="small">“Dos ativos” considera somente quem teve atividade real no período e também visitou a página. Base: {number(d.active_users)} usuários ativos.</p></section><p className="small">Coleta disponível desde {date(d.tracking_since)}. Views contam visitas; usuários únicos contam pessoas autenticadas, sem repetir acessos.</p></>}</>;
}
function UserDetails({user,onClose}:{user:AdminUser;onClose:()=>void}){
 const state=useAdminData<Users>('brains_admin_users',{p_user_id:user.id});const [copy,setCopy]=useState('Copiar e-mail');const d=state.data?.rows[0];
 const recent=state.data?.recent.filter(e=>e.event_name!=='deck_created')??[];
 return <div className="admin-drawer"><Dialog title="Detalhes do usuário" closeLabel="Fechar detalhes" onClose={onClose}><Status {...state}/>{d&&<><div className="admin-user-heading"><span className="avatar">{d.email?.charAt(0).toUpperCase()||'U'}</span><h3>{d.email||'Conta sem e-mail'}</h3></div><button className="secondary" disabled={!d.email} onClick={()=>{void navigator.clipboard.writeText(d.email).then(()=>setCopy('E-mail copiado')).catch(()=>setCopy('Não foi possível copiar'))}}>{copy}</button><div role="status" className="small">{copy==='Copiar e-mail'?'':copy}</div><dl className="admin-user-dates"><dt>Conta criada</dt><dd>{date(d.created_at)}</dd><dt>Última atividade no produto</dt><dd>{date(d.last_activity)}</dd><dt>Último login</dt><dd>{date(d.last_sign_in_at)}</dd></dl><div className="admin-user-counts">{[['Áreas',d.areas],['Cards',d.cards]].map(([label,value])=><div key={label}><strong>{number(Number(value))}</strong><span className="small">{label}</span></div>)}</div><h3>Atividade recente</h3>{recent.length?<ul className="admin-recent">{recent.map((e,i)=><li key={i}><strong>{{card_reviewed:'Revisou um card',card_created:'Criou um card',area_created:'Criou uma área'}[e.event_name]??'Atividade no produto'}</strong><time>{date(e.created_at)}</time></li>)}</ul>:<p className="small">Nenhuma atividade registrada.</p>}</>}{!state.loading&&!state.error&&!d&&<p>Usuário não encontrado.</p>}</Dialog></div>;
}
function UsersPage(){
 const [search,setSearch]=useState(''),[query,setQuery]=useState(''),[page,setPage]=useState(0),[selected,setSelected]=useState<AdminUser|null>(null);
 useEffect(()=>{const timer=setTimeout(()=>{setQuery(search.trim());setPage(0)},300);return()=>clearTimeout(timer)},[search]);
 const state=useAdminData<Users>('brains_admin_users',{p_search:query,p_page:page});const d=state.data;
 return <section className="panel admin-users"><div className="row"><div><h2>Seus usuários</h2><p className="small">Conheça quem está usando o Brains.</p></div><div className="admin-search"><label htmlFor="admin-search">Buscar por e-mail</label><input id="admin-search" type="search" placeholder="Buscar por e-mail…" value={search} maxLength={200} onChange={e=>setSearch(e.target.value)}/></div></div><Status {...state}/>{d&&<>{d.rows.length?<div className="admin-table-scroll"><table><thead><tr><th>Usuário / E-mail</th><th>Criado em</th><th>Última atividade</th><th>Áreas</th><th>Cards</th></tr></thead><tbody>{d.rows.map(u=><tr key={u.id}><td><button className="admin-user-link" onClick={()=>setSelected(u)}>{u.email||'Conta sem e-mail'}</button></td><td>{date(u.created_at)}</td><td>{date(u.last_activity)}</td><td>{number(u.areas)}</td><td>{number(u.cards)}</td></tr>)}</tbody></table></div>:<div className="admin-empty"><h3>{query?'Nenhum usuário encontrado':'Ainda não há usuários'}</h3><p>{query?'Tente outro e-mail.':'As contas cadastradas aparecerão aqui.'}</p>{query&&<button className="text-btn" onClick={()=>setSearch('')}>Limpar busca</button>}</div>}<div className="row admin-pagination"><p className="small">{number(d.total)} {d.total===1?'usuário':'usuários'} · Página {page+1} de {Math.max(1,Math.ceil(d.total/25))}</p><div><button className="secondary" disabled={page===0} onClick={()=>setPage(p=>p-1)}>Anterior</button> <button className="secondary" disabled={(page+1)*25>=d.total} onClick={()=>setPage(p=>p+1)}>Próxima</button></div></div></>}{selected&&<UserDetails user={selected} onClose={()=>setSelected(null)}/>}</section>;
}
export default function Admin(){
 const access=useAdminData<boolean>('brains_admin_access',{});
 const location=useLocation(),[params,setParams]=useSearchParams();
 const days=[7,30,90,0].includes(Number(params.get('period')??30))?Number(params.get('period')??30):30;
 const tab=location.pathname.replace(/\/$/,'').endsWith('/users')?'users':location.pathname.replace(/\/$/,'').endsWith('/funnel')?'funnel':'overview';
 if(access.loading||access.error)return <main className="admin-shell"><Status {...access}/><Link to="/home" className="text-btn">Voltar ao Brains</Link></main>;
 if(!access.data)return <main className="login-page"><div className="login-card"><span className="badge">Área privada</span><h1>Acesso restrito</h1><p>Esta área está disponível apenas para administradores do Brains.</p><Link to="/home" className="primary">Voltar ao Brains</Link></div></main>;
 return <div className="admin-app"><header className="admin-header"><div className="admin-header-inner"><Link to="/home" className="brand"><span className="mark">B</span>Brains <span className="badge">Admin</span></Link><Link className="text-btn" to="/home">Voltar ao produto ↗</Link></div></header><main className="admin-shell"><div className="admin-title"><div><p className="admin-eyebrow">BRAINS ANALYTICS</p><h1>{tab==='overview'?'O Brains em números':tab==='funnel'?'Entenda a jornada':'Conheça seus usuários'}</h1><p className="muted">{tab==='overview'?'Crescimento e uso, em um só lugar.':tab==='funnel'?'Veja quem chega, quem avança e onde o caminho para.':'Da primeira conta aos hábitos de estudo.'}</p></div>{tab!=='users'&&<div className="admin-period"><label htmlFor="admin-period">Período</label><select id="admin-period" value={days} onChange={e=>setParams({period:e.target.value})}><option value={7}>7 dias</option><option value={30}>30 dias</option><option value={90}>90 dias</option><option value={0}>Todo período</option></select></div>}</div><nav className="admin-nav" aria-label="Admin">{[['overview','Overview','/admin'],['funnel','Funnel','/admin/funnel'],['users','Users','/admin/users']].map(([id,label,path])=><NavLink key={id} end to={path+'?period='+days} className={()=>tab===id?'active':''}>{label}</NavLink>)}</nav>{tab==='overview'?<OverviewPage days={days}/>:tab==='funnel'?<FunnelPage days={days}/>:<UsersPage/>}<footer className="admin-footer">Dados do Brains · Horário de Brasília · Acesso administrativo</footer></main></div>;
}
