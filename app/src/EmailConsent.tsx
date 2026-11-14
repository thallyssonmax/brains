import { Checkbox } from './components/ui/checkbox';
import { CardSurface } from './components/ui/card';
import {useEffect,useState} from 'react';
import {cloud} from './cloud';

export function EmailConsent({preview=false}:{preview?:boolean}={}){
 const [enabled,setEnabled]=useState(true),[loading,setLoading]=useState(!preview&&!!cloud),[saving,setSaving]=useState(false),[error,setError]=useState('');
 useEffect(()=>{if(preview||!cloud)return;let active=true;void cloud.rpc('brains_email_consent',{p_enabled:null}).then(({data,error})=>{if(!active)return;if(error){setError('Não foi possível carregar a preferência de e-mails.');setEnabled(false)}else setEnabled(!!data);setLoading(false)});return()=>{active=false}},[preview]);
 async function update(value:boolean){if(preview){setEnabled(value);return}if(!cloud||saving)return;setSaving(true);setError('');const result=await cloud.rpc('brains_email_consent',{p_enabled:value});if(result.error)setError('Não foi possível salvar. Tente novamente.');else setEnabled(!!result.data);setSaving(false)}
 return <CardSurface><h2>E-mails de aprendizado</h2><p className="small">Receba dicas para começar, lembretes de revisão e incentivo para retomar os estudos. Você pode desligar quando quiser. E-mails essenciais da conta continuam disponíveis.</p><label className="email-consent"><Checkbox checked={enabled} disabled={loading||saving} onCheckedChange={checked=>void update((checked === true))}/><span>{enabled?'E-mails de aprendizado ativados':'Quero receber e-mails de aprendizado'}</span></label>{loading&&<p className="small" role="status">Carregando preferência…</p>}{error&&<p className="error" role="alert">{error}</p>}</CardSurface>;
}

