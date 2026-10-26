import {useEffect,useState} from 'react';
import {cloud} from './cloud';

export function EmailConsent(){
 const [enabled,setEnabled]=useState(false),[loading,setLoading]=useState(true),[saving,setSaving]=useState(false),[error,setError]=useState('');
 useEffect(()=>{let active=true;void cloud?.rpc('brains_email_consent',{p_enabled:null}).then(({data,error})=>{if(!active)return;if(error)setError('Não foi possível carregar a preferência de e-mails.');else setEnabled(!!data);setLoading(false)});return()=>{active=false}},[]);
 async function update(value:boolean){if(!cloud||saving)return;setSaving(true);setError('');const result=await cloud.rpc('brains_email_consent',{p_enabled:value});if(result.error)setError('Não foi possível salvar. Tente novamente.');else setEnabled(!!result.data);setSaving(false)}
 return <section className="panel"><h2>E-mails de aprendizado</h2><p className="small">Receba dicas para começar, lembretes de revisão e incentivo para retomar os estudos. Você pode desligar quando quiser. E-mails essenciais da conta continuam disponíveis.</p><label className="email-consent"><input type="checkbox" checked={enabled} disabled={loading||saving} onChange={event=>void update(event.target.checked)}/><span>{enabled?'E-mails de aprendizado ativados':'Quero receber e-mails de aprendizado'}</span></label>{loading&&<p className="small" role="status">Carregando preferência…</p>}{error&&<p className="error" role="alert">{error}</p>}</section>;
}
