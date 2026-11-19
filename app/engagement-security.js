import {createHmac,timingSafeEqual} from 'node:crypto';

export function equalSecret(a,b){if(!a||!b)return false;const x=Buffer.from(a),y=Buffer.from(b);return x.length===y.length&&timingSafeEqual(x,y)}
export function unsubscribeToken(userId,secret,expires){const body=`${userId}.${expires}`;const signature=createHmac('sha256',secret).update(body).digest('base64url');return `${body}.${signature}`}
export function verifyUnsubscribe(token,secret){if(!secret||typeof token!=='string'||token.length>300)return null;const parts=token.split('.');if(parts.length!==3||!/^[0-9a-f-]{36}$/i.test(parts[0])||!/^\d{10}$/.test(parts[1]))return null;const expected=unsubscribeToken(parts[0],secret,Number(parts[1]));return Number(parts[1])*1000>Date.now()&&equalSecret(token,expected)?parts[0]:null}
export function verifySvix(raw,headers,secret,now=Date.now()){
 const id=headers.get('svix-id'),stamp=headers.get('svix-timestamp'),signatures=headers.get('svix-signature');
 if(!secret?.startsWith('whsec_')||!id||!stamp||!signatures||!/^[0-9]+$/.test(stamp)||Math.abs(now-Number(stamp)*1000)>300000)return false;
 const key=Buffer.from(secret.slice(6),'base64');if(!key.length)return false;
 const expected=createHmac('sha256',key).update(`${id}.${stamp}.${raw}`,'utf8').digest('base64');
 return signatures.split(' ').some(part=>part.startsWith('v1,')&&equalSecret(part.slice(3),expected));
}
