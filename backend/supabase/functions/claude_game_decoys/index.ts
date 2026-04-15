import Anthropic from 'npm:@anthropic-ai/sdk@0.32.1';
import { createClient } from 'npm:@supabase/supabase-js@2';

const CORS={'Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'*','Access-Control-Allow-Methods':'POST, OPTIONS'};
const ANTHROPIC_API_KEY = Deno.env.get('ANTHROPIC_API_KEY') ?? '<insert anthropic api key here>';
const SYS=`You fabricate plausible GitHub repo 'decoys' in a developer's voice. Given 3 real repos, invent exactly 2 NEW repos that could believably be theirs — same stack, tone, naming style. STRICT JSON: {\"decoys\":[{\"name\":\"...\",\"description\":\"...\"},{\"name\":\"...\",\"description\":\"...\"}]}. Descriptions one sentence <140 chars. No name reuse.`;
function shuffle(a){const b=[...a];for(let i=b.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[b[i],b[j]]=[b[j],b[i]];}return b;}
function rid(){return Math.random().toString(36).slice(2,10);}
function wt(p,ms){return Promise.race([p,new Promise((_,r)=>setTimeout(()=>r(new Error('t')),ms))]);}
Deno.serve(async (req) => {
  if (req.method==='OPTIONS') return new Response('ok',{headers:CORS});
  const URL=Deno.env.get('SUPABASE_URL'),SRK=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!URL||!SRK) return new Response(JSON.stringify({error:'env'}),{status:500,headers:{...CORS,'content-type':'application/json'}});
  let body; try{body=await req.json();}catch{return new Response(JSON.stringify({error:'bad_json'}),{status:400,headers:{...CORS,'content-type':'application/json'}});}
  const tid=body?.target_user_id; if(!tid) return new Response(JSON.stringify({error:'target_user_id'}),{status:400,headers:{...CORS,'content-type':'application/json'}});
  const sb=createClient(URL,SRK);
  const key=`decoys:${tid}`;
  const {data:repos,error}=await sb.from('user_repos').select('id,name,description,readme_excerpt').eq('user_id',tid).limit(3);
  if (error||!repos?.length) return new Response(JSON.stringify({error:error?.message??'no_repos'}),{status:404,headers:{...CORS,'content-type':'application/json'}});
  const real=repos[Math.floor(Math.random()*repos.length)];
  const realCard={id:rid(),name:real.name,description:real.description??'',is_real:true};
  const anth=new Anthropic({apiKey:ANTHROPIC_API_KEY});
  try{
    const payload=JSON.stringify({repos:repos.map(r=>({name:r.name,description:r.description,readme_excerpt:r.readme_excerpt}))});
    const msg=await wt(anth.messages.create({model:'claude-sonnet-4-6',max_tokens:400,system:[{type:'text',text:SYS,cache_control:{type:'ephemeral'}}],messages:[{role:'user',content:`Real repos:\n${payload}\nJSON only.`}]}),3000);
    const text=msg.content.map(c=>c.type==='text'?c.text:'').join('').trim();
    const s=text.indexOf('{'),e=text.lastIndexOf('}');
    const parsed=JSON.parse(text.slice(s,e+1));
    if (!parsed?.decoys||parsed.decoys.length<2) throw new Error('bad');
    const decoys=parsed.decoys.slice(0,2).map(d=>({id:rid(),name:d.name,description:d.description,is_real:false}));
    const cards=shuffle([realCard,...decoys]);
    const response={cards};
    await sb.from('claude_cache').upsert({cache_key:key,response},{onConflict:'cache_key'});
    return new Response(JSON.stringify(response),{headers:{...CORS,'content-type':'application/json'}});
  }catch(e){console.error(e);
    const {data:c}=await sb.from('claude_cache').select('response').eq('cache_key',key).maybeSingle();
    if (c?.response) return new Response(JSON.stringify(c.response),{headers:{...CORS,'content-type':'application/json'}});
    const others=repos.filter(r=>r.id!==real.id).slice(0,2).map(r=>({id:rid(),name:r.name+'-v2',description:(r.description??'')+' (variant)',is_real:false}));
    return new Response(JSON.stringify({cards:shuffle([realCard,...others])}),{headers:{...CORS,'content-type':'application/json'}});
  }
});
