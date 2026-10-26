const origin='https://www.heybrains.app';
const escape=value=>String(value??'').replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
export function emailContent(message,unsubscribeUrl){
 const name=message.first_name?.trim()||'você';
 const area=message.area_name?.trim()||'de estudos';
 const count=Math.max(0,Number(message.pending_count)||0);
 const pending=count===1?'um card':`${count} cards`;
 const next=message.next_due?new Intl.DateTimeFormat('pt-BR',{timeZone:'America/Sao_Paulo',dateStyle:'short'}).format(new Date(message.next_due)):null;
 const templates={
  welcome:{subject:'Sua área tá pronta. Bora aprender? 🧠',intro:`Oi, ${name}! 👋`,paragraphs:[`Sua área ${area} já está pronta no Brains!`,'Agora só falta uma coisa: sua primeira palavra.','Escolha uma palavra que você quer aprender, transforme em card e deixe o Brains te ajudar a memorizar.','Uma palavra de cada vez. É assim que o vocabulário cresce. 🚀'],cta:'Criar meu primeiro card',path:'/areas'},
  first_card_72h:{subject:'Ei, falta só uma palavrinha! 👀',intro:`E aí, ${name}!`,paragraphs:[`Sua área ${area} tá prontinha, mas ainda não tem nenhum card.`,'Pense naquela palavra que você sempre esquece no idioma que está aprendendo.','Agora, transforme ela no seu primeiro card. Simples assim! 🧠'],cta:'Criar meu primeiro card',path:'/areas'},
  first_card_7d:{subject:'Sua área tá se sentindo sozinha... 🥹',intro:`Ei, ${name}!`,paragraphs:['Sua área no Brains tá esperando a primeira palavra chegar. 👀','Que tal começar hoje? Não precisa aprender 100 palavras de uma vez. Comece com uma.','Se algo te deixou em dúvida, adoraria ouvir você. — Thallysson Makcyel, fundador do Brains'],cta:'Criar meu primeiro card',path:'/areas',secondary:'https://wa.me/5538991308550'},
  review_pending:{subject:'Seu vocabulário pediu um refresh! 🧠',intro:`Ei, ${name}!`,paragraphs:[`Tem ${pending} esperando por uma revisão.`,'Sabe aquelas palavras que você aprende e depois esquece? É isso que queremos evitar. 👀','Bora dar uma refrescada na memória?'],cta:'Revisar meus cards',path:'/home'},
  review_complete:{subject:'Tudo revisado! Seu cérebro agradece. ✨',intro:`Mandou bem, ${name}! 🎉`,paragraphs:['Você concluiu todas as revisões por enquanto.','Agora é hora de deixar seu cérebro fazer a parte dele.',...(next?[`Próxima revisão: ${next}`]:[]),'Enquanto isso, que tal adicionar uma palavra nova ao seu vocabulário?'],cta:'Aprender uma nova palavra',path:'/areas'},
  reactivation:{subject:'Ei, lembra daquelas palavras? 👀',intro:`${name}, sumiu! 👀`,paragraphs:['Suas palavras continuam guardadinhas no Brains.','A memória precisa de um empurrãozinho de vez em quando. 🧠','Que tal voltar e revisar algumas? Sem pressão, sem maratona.'],cta:'Retomar meu aprendizado',path:'/home'}
 };
 const t=templates[message.campaign];if(!t)throw Error('unknownCampaign');
 const url=origin+t.path;
 const text=[t.intro,'',...t.paragraphs,'',`${t.cta}: ${url}`,...(t.secondary?[`Falar comigo no WhatsApp: ${t.secondary}`]:[]),'',`Para parar de receber e-mails de aprendizado: ${unsubscribeUrl}`].join('\n');
 const html=`<div style="font-family:Arial,sans-serif;max-width:560px;margin:auto;color:#17233b;line-height:1.55"><div style="font-size:22px;font-weight:800;color:#2458e6;margin:24px 0">Brains</div><h1 style="font-size:22px">${escape(t.intro)}</h1>${t.paragraphs.map(p=>`<p>${escape(p)}</p>`).join('')}<p style="margin:26px 0"><a href="${escape(url)}" style="background:#2458e6;color:white;padding:13px 18px;border-radius:9px;text-decoration:none;font-weight:700">${escape(t.cta)}</a></p>${t.secondary?`<p><a href="${escape(t.secondary)}">Falar comigo no WhatsApp</a></p>`:''}<hr style="border:0;border-top:1px solid #e3e8f1;margin-top:32px"><p style="font-size:12px;color:#526078">Você recebe esta mensagem porque ativou os e-mails de aprendizado no Brains. <a href="${escape(unsubscribeUrl)}">Descadastrar</a></p></div>`;
 return {subject:t.subject,text,html,url};
}
