import Anthropic from 'npm:@anthropic-ai/sdk@0.32.1';
import { createClient } from 'npm:@supabase/supabase-js@2';

const CORS={'Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'*','Access-Control-Allow-Methods':'POST, OPTIONS'};
const ANTHROPIC_API_KEY = Deno.env.get('ANTHROPIC_API_KEY') ?? '<insert anthropic api key here>';
const SYS=`You write ONE-sentence in-person icebreakers for two strangers who matched on a campus app.\nYou get both users' full profiles: socials (instagram/twitter/linkedin handles, spotify top artists, letterboxd faves, interests, hometown, major, year, what-they're-looking-for) AND their GitHub repos.\nRules:\n- One sentence, <180 chars.\n- Ground in a SPECIFIC, concrete overlap. Prefer the shared signal (same artist, same film, same interest, same hometown) over generic code stuff.\n- If multiple overlaps exist, pick the most surprising one.\n- No greetings, no emojis, no names. Don't mention 'the app' or 'your match'.\n- Sound like a warm, observant friend. Specific, not generic.\n- Output ONLY the sentence.`;
function wt(p,ms){return Promise.race([p,new Promise((_,r)=>setTimeout(()=>r(new Error('t')),ms))]);}
Deno.serve(async (req) => {
  if (req.method==='OPTIONS') return new Response('ok',{headers:CORS});
  const URL=Deno.env.get('SUPABASE_URL'),SRK=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!URL||!SRK) return new Response(JSON.stringify({error:'env'}),{status:500,headers:{...CORS,'content-type':'application/json'}});
  let body; try{body=await req.json();}catch{return new Response(JSON.stringify({error:'bad_json'}),{status:400,headers:{...CORS,'content-type':'application/json'}});}
  const aId=body?.user_a_id,bId=body?.user_b_id;
  if (!aId||!bId) return new Response(JSON.stringify({error:'ids'}),{status:400,headers:{...CORS,'content-type':'application/json'}});
  const [lo,hi]=aId<bId?[aId,bId]:[bId,aId]; const key=`ice:${lo}:${hi}`;
  const sb=createClient(URL,SRK);
  const [rA,rB,pA,pB]=await Promise.all([
    sb.from('user_repos').select('name,description,readme_excerpt').eq('user_id',aId),
    sb.from('user_repos').select('name,description,readme_excerpt').eq('user_id',bId),
    sb.from('profiles').select('full_name,socials').eq('id',aId).maybeSingle(),
    sb.from('profiles').select('full_name,socials').eq('id',bId).maybeSingle(),
  ]);
  const payload=JSON.stringify({
    user_a:{profile:pA.data??{},repos:rA.data??[]},
    user_b:{profile:pB.data??{},repos:rB.data??[]},
    winning_thread:body.winning_thread??null,
  });
  const anth=new Anthropic({apiKey:ANTHROPIC_API_KEY});
  try{
    const msg=await wt(anth.messages.create({model:'claude-sonnet-4-6',max_tokens:200,system:[{type:'text',text:SYS,cache_control:{type:'ephemeral'}}],messages:[{role:'user',content:`Both users full profiles:\n${payload}\nReturn ONLY the sentence.`}]}),4000);
    const text=msg.content.map(c=>c.type==='text'?c.text:'').join('').trim().replace(/^[\"']|[\"']$/g,'');
    if (!text) throw new Error('empty');
    const response={icebreaker:text};
    await sb.from('claude_cache').upsert({cache_key:key,response},{onConflict:'cache_key'});
    return new Response(JSON.stringify(response),{headers:{...CORS,'content-type':'application/json'}});
  }catch(e){console.error(e);
    const {data:c}=await sb.from('claude_cache').select('response').eq('cache_key',key).maybeSingle();
    if (c?.response) return new Response(JSON.stringify(c.response),{headers:{...CORS,'content-type':'application/json'}});
    return new Response(JSON.stringify({icebreaker:"You've both had Phoebe Bridgers on repeat this year — ask what track they played the most."}),{headers:{...CORS,'content-type':'application/json'}});
  }
});
