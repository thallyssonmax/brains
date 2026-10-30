import {defineConfig,type Plugin} from 'vite';
// Match production's multi-page fallback during local development and preview.
function productFallback():Plugin {
 const install=(server:any)=>{server.middlewares.use((req:any,_res:any,next:()=>void)=>{
  const path=(req.url??'').split('?')[0];
  const publicPages=new Set(['plugin-chatgpt','privacy','support','termos-de-uso','terms']);
  const page=path.replace(/^\//,'').replace(/\/$/,'');
  if(req.headers.accept?.includes('text/html')&&!path.includes('.')){
   const suffix=req.url.includes('?')?'?'+req.url.split('?').slice(1).join('?'):'';
   if(publicPages.has(page))req.url=`/${page}/index.html${suffix}`;
   else if(!['/','/style-guide','/style-guide/'].includes(path))req.url=`/product.html${suffix}`;
  }
  next();
 })};
 return {name:'product-fallback',configureServer:install,configurePreviewServer:install};
}
export default defineConfig({plugins:[productFallback()],build:{rollupOptions:{input:{landing:'index.html',product:'product.html',styleGuide:'style-guide/index.html'}}}});
