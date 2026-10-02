// Approximate US-English respelling, derived from CMU's ARPABET entries.
// This is a reading aid, not IPA or a transcription of the device's voice.
const sounds:Record<string,string>={AA:'ah',AE:'a',AH:'uh',AO:'aw',AW:'ow',AY:'eye',EH:'eh',ER:'er',EY:'ay',IH:'i',IY:'ee',OW:'oh',OY:'oy',UH:'uu',UW:'oo',B:'b',CH:'ch',D:'d',DH:'dh',F:'f',G:'g',HH:'h',JH:'j',K:'k',L:'l',M:'m',N:'n',NG:'ng',P:'p',R:'r',S:'s',SH:'sh',T:'t',TH:'th',V:'v',W:'w',Y:'y',Z:'z',ZH:'zh'};
const onsets=new Set(['P R','B R','T R','D R','K R','G R','F R','TH R','SH R','P L','B L','K L','G L','F L','S L','S M','S N','S P','S T','S K','S W','T W','D W','K W','G W','P Y','B Y','K Y','G Y','F Y','V Y','M Y','HH Y','S P R','S T R','S K R','S P L','S K W']);
export function respell(phones:string):string|null{
 const tokens=phones.split(' '),vowels=tokens.flatMap((p,i)=>/\d$/.test(p)?[i]:[]);
 if(!vowels.length||tokens.some(p=>!sounds[p.replace(/\d/g,'')]))return null;
 const cuts=[0];
 for(let i=1;i<vowels.length;i++){
  const from=vowels[i-1]+1,to=vowels[i];let cut=to;
  for(let j=from;j<to;j++){const cluster=tokens.slice(j,to).join(' ');if(onsets.has(cluster)||(j===to-1&&tokens[j]!=='NG')){cut=j;break}}
  cuts.push(cut);
 }
 cuts.push(tokens.length);
 return cuts.slice(0,-1).map((start,i)=>{const syllable=tokens.slice(start,cuts[i+1]);const value=syllable.map(p=>sounds[p.replace(/\d/g,'')]).join('');return syllable.some(p=>p.endsWith('1'))?value.toUpperCase():value}).join('-');
}
export function pronunciationFor(text:string,language:string,dictionary:Record<string,string>):string|null{
 // CMU is American English. Never silently present it as a British pronunciation.
 if(!/^en(?:-US)?$/i.test(language))return null;
 const normalized=text.trim().replace(/[’]/g,"'").replace(/[.!?,;:]+$/,'');
 if(!/^[a-zA-Z]+(?:'[a-zA-Z]+)?(?:[ -][a-zA-Z]+(?:'[a-zA-Z]+)?)*$/.test(normalized))return null;
 const words=normalized.toLowerCase().split(/[ -]/);
 if(words.length>12)return null;
 const result:string[]=[];
 for(const word of words){
  if(!Object.hasOwn(dictionary,word))return null;
  const phones=dictionary[word];
  // Ambiguous pronunciations need context; don't guess (e.g. present, read).
  for(let i=1;i<=9;i++)if(Object.hasOwn(dictionary,`${word}(${i})`)&&dictionary[`${word}(${i})`]!==phones)return null;
  const value=respell(phones);if(!value)return null;result.push(value);
 }
 return result.join(' ');
}
