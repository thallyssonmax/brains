// Bound network waits so a stalled request cannot leave saving/uploading stuck forever.
export async function boundedFetch(input:RequestInfo|URL,init?:RequestInit):Promise<Response>{
 const controller=new AbortController();
 const signal=init?.signal??(input instanceof Request?input.signal:undefined);
 const abort=()=>controller.abort();
 if(signal?.aborted)abort();else signal?.addEventListener('abort',abort,{once:true});
 const timer=setTimeout(abort,45000);
 try{return await fetch(input,{...init,signal:controller.signal})}
 finally{clearTimeout(timer);signal?.removeEventListener('abort',abort)}
}
