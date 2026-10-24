const APP_ORIGIN='https://www.heybrains.app';

export default function handler(req,res){
 if(req.method!=='GET'&&req.method!=='HEAD'){res.statusCode=405;res.setHeader('Allow','GET, HEAD');return res.end()}
 const supabaseUrl=process.env.SUPABASE_URL||process.env.VITE_SUPABASE_URL;
 if(!supabaseUrl){res.statusCode=503;return res.end('OAuth metadata is not configured.')}
 res.setHeader('Content-Type','application/json; charset=utf-8');
 res.setHeader('Cache-Control','public, max-age=300, stale-while-revalidate=600');
 const metadata={
  resource:`${APP_ORIGIN}/api/brains-mcp-import`,
  authorization_servers:[`${supabaseUrl.replace(/\/$/,'')}/auth/v1`],
  bearer_methods_supported:['header'],
  resource_documentation:`${APP_ORIGIN}/` 
 };
 return res.end(req.method==='HEAD'?undefined:JSON.stringify(metadata));
}
