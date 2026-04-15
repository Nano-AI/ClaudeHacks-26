import Anthropic from 'npm:@anthropic-ai/sdk@0.32.1';
import { createClient } from 'npm:@supabase/supabase-js@2';

const CORS = {'Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'*','Access-Control-Allow-Methods':'POST, OPTIONS'};
const ANTHROPIC_API_KEY = Deno.env.get('ANTHROPIC_API_KEY') ?? '<insert anthropic api key here>';

const SYS = `You fabricate 2 plausible decoy interests for a specific person based on their socials.\nGiven one real interest and the person's profile (interests/artists/films/hobbies/hometown/major), invent 2 in-their-vibe decoys.\nReturn STRICT JSON only: {\"decoys\":[\"label one\",\"label two\"]}. Each label under 40 chars. No repeats of the real. Natural, specific, not generic.`;

const GENERIC_POOL = ['trail running','rust CLIs','phoebe bridgers','ramen','climbing gym','board games','indie film','pour over coffee','discord bots','specialty coffee','ceramics','design critique','jazz bass','yoga','spanish language','sunset bike rides','lo-fi coding','vinyl records','film photography','letterboxd hot takes','fred again..','mitski','past lives','before sunrise','everything everywhere all at once','4 miles easy','pizza night','disc golf','cheese curds','state street walks','board game cafes','terrace sunset'];

function shuffle<T>(a:T[]):T[]{const b=[...a];for(let i=b.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[b[i],b[j]]=[b[j],b[i]];}return b;}
function rid():string{return Math.random().toString(36).slice(2,10);}
function wt<T>(p:Promise<T>,ms:number):Promise<T>{return Promise.race([p,new Promise<T>((_,r)=>setTimeout(()=>r(new Error('t')),ms))]);}

function pickRealInterest(socials:Record<string,unknown>):string|null{
  if (!socials) return null;
  const candidates:string[] = [];
  const interests = socials.interests;
  if (Array.isArray(interests)) candidates.push(...interests.filter(x=>typeof x==='string'));
  const spotify = socials.spotify_top_artists;
  if (Array.isArray(spotify)) candidates.push(...spotify.filter(x=>typeof x==='string'));
  const films = socials.letterboxd_favs;
  if (Array.isArray(films)) candidates.push(...films.filter(x=>typeof x==='string'));
  if (candidates.length === 0) return null;
  return candidates[Math.floor(Math.random()*candidates.length)];
}

function poolDecoys(real:string, n:number):string[]{
  const avail = GENERIC_POOL.filter(x => x.toLowerCase() !== real.toLowerCase());
  return shuffle(avail).slice(0,n);
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  const URL = Deno.env.get('SUPABASE_URL'); const SRK = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!URL || !SRK) return new Response(JSON.stringify({ error: 'env' }), { status: 500, headers: { ...CORS, 'content-type': 'application/json' } });

  let body:{target_user_id?:string}={}; try { body = await req.json(); } catch { /* allow empty */ }
  const tid = body.target_user_id;

  const sb = createClient(URL, SRK);

  // Load target profile socials
  let realLabel:string|null = null;
  if (tid) {
    const { data: p } = await sb.from('profiles').select('socials').eq('id', tid).maybeSingle();
    const socials = (p as { socials?: Record<string,unknown> } | null)?.socials ?? null;
    if (socials) realLabel = pickRealInterest(socials);
  }
  if (!realLabel) {
    // Last resort — pick from generic pool so the game NEVER hard-fails
    realLabel = GENERIC_POOL[Math.floor(Math.random() * GENERIC_POOL.length)];
  }

  const cacheKey = `interest_decoys:${tid ?? 'anon'}:${realLabel}`;
  const { data: cached } = await sb.from('claude_cache').select('response').eq('cache_key', cacheKey).maybeSingle();
  if (cached?.response) {
    return new Response(JSON.stringify(cached.response), { headers: { ...CORS, 'content-type': 'application/json' } });
  }

  let decoys:string[] = [];
  try {
    const anth = new Anthropic({ apiKey: ANTHROPIC_API_KEY });
    const { data: p } = tid ? await sb.from('profiles').select('socials').eq('id', tid).maybeSingle() : { data: null };
    const socials = (p as { socials?: Record<string,unknown> } | null)?.socials ?? {};
    const msg = await wt(anth.messages.create({ model: 'claude-sonnet-4-6', max_tokens: 200, system: [{ type: 'text', text: SYS, cache_control: { type: 'ephemeral' } }], messages: [{ role: 'user', content: `Real interest: ${realLabel}\nTheir profile: ${JSON.stringify(socials)}\nReturn JSON only.` }] }), 3000);
    const text = msg.content.map((c)=>c.type==='text'?c.text:'').join('').trim();
    const s = text.indexOf('{'), e = text.lastIndexOf('}');
    const parsed = JSON.parse(text.slice(s, e+1)) as { decoys?: string[] };
    if (Array.isArray(parsed.decoys) && parsed.decoys.length >= 2) {
      decoys = parsed.decoys.slice(0,2).map(d => String(d).slice(0,60));
    }
  } catch (err) { console.error('decoy llm err', err); }

  if (decoys.length < 2) decoys = poolDecoys(realLabel, 2);

  const cards = shuffle([
    { id: rid(), name: realLabel, description: '', is_real: true },
    { id: rid(), name: decoys[0], description: '', is_real: false },
    { id: rid(), name: decoys[1], description: '', is_real: false },
  ]);
  const response = { cards };
  await sb.from('claude_cache').upsert({ cache_key: cacheKey, response }, { onConflict: 'cache_key' });
  return new Response(JSON.stringify(response), { headers: { ...CORS, 'content-type': 'application/json' } });
});
