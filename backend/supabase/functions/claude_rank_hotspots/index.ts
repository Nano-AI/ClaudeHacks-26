import Anthropic from 'npm:@anthropic-ai/sdk@0.32.1';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.4';

const CORS = {'Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'authorization, x-client-info, apikey, content-type','Access-Control-Allow-Methods':'POST, OPTIONS'};
const ANTHROPIC_API_KEY = Deno.env.get('ANTHROPIC_API_KEY') ?? '<insert anthropic api key here>';

const SYS = `You rank campus hotspots by mood fit. Given a mood string and list of hotspots (id,title,description), return TOP 3. STRICT JSON ONLY: {\"ranked\":[{\"hotspot_id\":\"<id>\",\"score\":<0-1>,\"reason\":\"<<=18 words specific>\"}]}. Exactly 3 items desc by score.`;

async function sha256(s){const h=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(s));return Array.from(new Uint8Array(h)).map(b=>b.toString(16).padStart(2,'0')).join('');}
function wt(p,ms){return Promise.race([p,new Promise((_,r)=>setTimeout(()=>r(new Error('t')),ms))]);}
function parse(t){const s=t.indexOf('{'),e=t.lastIndexOf('}');if(s<0||e<0)return null;try{const p=JSON.parse(t.slice(s,e+1));if(!p?.ranked)return null;return{ranked:p.ranked.slice(0,3).map(r=>({hotspot_id:r.hotspot_id,score:typeof r.score==='number'?r.score:0,reason:r.reason||''}))};}catch{return null;}}
function fb(body){const toks=body.mood.toLowerCase().split(/\s+/).filter(t=>t.length>2);const scored=body.hotspots.map(h=>{const hay=(h.title+' '+h.description).toLowerCase();let s=0;for(const t of toks)if(hay.includes(t))s++;return{hotspot_id:h.id,score:s/Math.max(toks.length,1),reason:`Matches ${h.title}.`};});scored.sort((a,b)=>b.score-a.score);return{ranked:scored.slice(0,3)};}

Deno.serve(async (req) => {
  if (req.method==='OPTIONS') return new Response('ok',{headers:CORS});
  const URL=Deno.env.get('SUPABASE_URL'),SRK=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!URL||!SRK) return new Response(JSON.stringify({error:'env'}),{status:500,headers:{...CORS,'Content-Type':'application/json'}});
  let body; try{body=await req.json();}catch{return new Response(JSON.stringify({error:'bad_json'}),{status:400,headers:{...CORS,'Content-Type':'application/json'}});}
  if (!body?.mood||!Array.isArray(body?.hotspots)) return new Response(JSON.stringify({error:'bad_body'}),{status:400,headers:{...CORS,'Content-Type':'application/json'}});
  const sb=createClient(URL,SRK);
  const key=await sha256(`rank:${body.mood}:${body.user_id??'anon'}`);
  const {data:c}=await sb.from('claude_cache').select('response').eq('cache_key',key).maybeSingle();
  if (c?.response) return new Response(JSON.stringify(c.response),{headers:{...CORS,'Content-Type':'application/json'}});
  const anth=new Anthropic({apiKey:ANTHROPIC_API_KEY});
  let result=null;
  try{
    const msg=await wt(anth.messages.create({model:'claude-sonnet-4-6',max_tokens:600,system:[{type:'text',text:SYS,cache_control:{type:'ephemeral'}}],messages:[{role:'user',content:JSON.stringify({mood:body.mood,hotspots:body.hotspots})}]}),3000);
    const tb=msg.content.find(b=>b.type==='text');
    result=parse(tb&&'text' in tb?tb.text:'');
  }catch(e){console.error(e);result=null;}
  if (!result) result=fb(body);
  else await sb.from('claude_cache').upsert({cache_key:key,response:result});
  return new Response(JSON.stringify(result),{headers:{...CORS,'Content-Type':'application/json'}});
});
