import {defineConfig,type Plugin} from 'vite';
// Match production's multi-page fallback during local development and preview.
function productFallback():Plugin {
 const install=(server:any)=>{server.middlewares.use((req:any,_res:any,next:()=>void)=>{
  const path=(req.url??'').split('?')[0];
  if(req.headers.accept?.includes('text/html')&&!['/','/index.html'].includes(path)&&!path.includes('.'))req.url='/product.html'+(req.url.includes('?')?'?'+req.url.split('?').slice(1).join('?'):'');
  next();
 })};
 return {name:'product-fallback',configureServer:install,configurePreviewServer:install};
}
export default defineConfig({plugins:[productFallback()],build:{rollupOptions:{input:{landing:'index.html',product:'product.html'}}}});
