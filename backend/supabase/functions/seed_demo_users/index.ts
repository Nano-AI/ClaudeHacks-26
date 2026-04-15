import { createClient } from 'npm:@supabase/supabase-js@2';

const CORS = {'Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'*','Access-Control-Allow-Methods':'POST, GET, OPTIONS'};

const demos = [
  { email: 'alex@demo.witm', full_name: 'Alex Park',
    socials: { instagram:'@alexbuilds', twitter:'@alex_hacks', spotify_top_artists:['Vampire Weekend','Phoebe Bridgers','Jamie xx'], letterboxd_favs:['Everything Everywhere All At Once','Before Sunrise','Paprika'], interests:['discord bots','lo-fi coding playlists','climbing gym','ramen'], hometown:'Minneapolis, MN', year:'Junior', major:'CS + Philosophy', looking_for:'people to cowork with on weird side projects' },
    repos: [ {name:'sunbot', description:'A Go-powered Discord bot for small gaming communities.', readme_excerpt:'Sunbot is a lightweight Discord bot written in Go.'}, {name:'sidequest', description:'Next.js + TS side project tracker.', readme_excerpt:'Personal project tracker built with Next.js 14.'}, {name:'notebook-tidy', description:'Python CLI for Jupyter notebooks.', readme_excerpt:'Strips outputs, sorts imports, normalizes metadata.'} ],
    activities: ['Open Mic Night - High Noon Saloon','Phoebe Bridgers Listening Party','Climbing Meetup - Boulders Gym']
  },
  { email: 'jordan@demo.witm', full_name: 'Jordan Lee',
    socials: { instagram:'@jordan.builds', twitter:'@jordanships', spotify_top_artists:['Phoebe Bridgers','Fred again..','Mitski'], letterboxd_favs:['Past Lives','Before Sunrise','In the Mood for Love'], interests:['rust CLIs','trail running','specialty coffee','ramen'], hometown:'Seattle, WA', year:'Senior', major:'CS + Design', looking_for:'a running partner who also ships stuff' },
    repos: [ {name:'ripgrok', description:'Rust CLI for structured log search.', readme_excerpt:'Ripgrep-style UX for JSON logs.'}, {name:'paceline', description:'React Native fitness app for group runs.', readme_excerpt:'Syncs routes and live map for running clubs.'}, {name:'quorum', description:'TS Discord bot for polls.', readme_excerpt:'Structured polls and decision logs.'} ],
    activities: ['Run Club - Library Mall','Phoebe Bridgers Listening Party','Indie Film: Past Lives - Chazen']
  },
  { email: 'sam@demo.witm', full_name: 'Sam Okafor',
    socials: { instagram:'@samruns', spotify_top_artists:['Fred again..','Four Tet','Mitski'], letterboxd_favs:['Past Lives','Portrait of a Lady on Fire'], interests:['trail running','indie film','pour over','rust CLIs'], hometown:'Chicago, IL', year:'Senior', major:'Journalism', looking_for:'running buddies + film club' },
    repos: [],
    activities: ['Run Club - Library Mall','Indie Film: Past Lives - Chazen','Sunset Bike Loop - Picnic Point']
  },
  { email: 'maya@demo.witm', full_name: 'Maya Chen',
    socials: { instagram:'@mayabuilds', spotify_top_artists:['Phoebe Bridgers','Mitski','Big Thief'], letterboxd_favs:['Everything Everywhere All At Once','Past Lives'], interests:['design critique','type nerd','ceramics','ramen'], hometown:'San Jose, CA', year:'Junior', major:'Design', looking_for:'design friends to crit with' },
    repos: [],
    activities: ['Design Critique - Memorial Library','Phoebe Bridgers Listening Party','Ramen Crawl Kickoff - State Street']
  },
  { email: 'diego@demo.witm', full_name: 'Diego Alvarez',
    socials: { instagram:'@d_plays_bass', spotify_top_artists:['Vulfpeck','Thundercat','Robert Glasper'], letterboxd_favs:['Whiplash','La La Land'], interests:['jazz bass','open mic','spanish','coffee'], hometown:'Austin, TX', year:'Sophomore', major:'Music + CS', looking_for:'jam buddies' },
    repos: [],
    activities: ['Open Mic Night - High Noon Saloon','Jazz Jam - Cafe Coda','Spanish Language Table - Colectivo']
  },
  { email: 'priya@demo.witm', full_name: 'Priya Rao',
    socials: { instagram:'@priya.climbs', spotify_top_artists:['Jamie xx','Caribou','Fred again..'], letterboxd_favs:['Paprika','In the Mood for Love'], interests:['climbing gym','electronic music','rust CLIs','trail running'], hometown:'Madison, WI', year:'Senior', major:'CS', looking_for:'climbing + coding friends' },
    repos: [],
    activities: ['Climbing Meetup - Boulders Gym','Silent Disco on the Terrace','Rust Meetup - Sector67']
  },
  { email: 'noah@demo.witm', full_name: 'Noah Ellis',
    socials: { instagram:'@noahmakesgames', spotify_top_artists:['Jamie xx','Toro y Moi','Vampire Weekend'], letterboxd_favs:['Paprika','Scott Pilgrim vs. the World'], interests:['board games','game dev','discord bots','pizza'], hometown:'Milwaukee, WI', year:'Freshman', major:'CS', looking_for:'game nights + collab on a side project' },
    repos: [],
    activities: ['Board Game Night - Ian\'s Pizza','Open Mic Night - High Noon Saloon','CS Study Jam - Union South']
  },
  { email: 'riley@demo.witm', full_name: 'Riley Santos',
    socials: { instagram:'@riley_yoga', spotify_top_artists:['Mitski','Phoebe Bridgers','Japanese Breakfast'], letterboxd_favs:['Past Lives','Before Sunrise'], interests:['yoga','slow coffee','letterboxd','trail running'], hometown:'Denver, CO', year:'Junior', major:'Psych', looking_for:'quiet mornings, long runs' },
    repos: [],
    activities: ['Rooftop Yoga - Edgewater','Run Club - Library Mall','Indie Film: Past Lives - Chazen']
  },
  { email: 'kai@demo.witm', full_name: 'Kai Nakamura',
    socials: { instagram:'@kaieats', spotify_top_artists:['Toro y Moi','Thundercat','Fred again..'], letterboxd_favs:['In the Mood for Love','Perfect Days'], interests:['ramen','board games','ceramics','specialty coffee'], hometown:'Honolulu, HI', year:'Senior', major:'Anthropology', looking_for:'food adventures + slow evenings' },
    repos: [],
    activities: ['Ramen Crawl Kickoff - State Street','Board Game Night - Ian\'s Pizza','Farmers Market Coffee Walk - Capitol Square']
  },
  { email: 'theo@demo.witm', full_name: 'Theo Wright',
    socials: { instagram:'@theocodes', spotify_top_artists:['Vampire Weekend','Big Thief','Fleet Foxes'], letterboxd_favs:['Everything Everywhere All At Once','Perfect Days'], interests:['discord bots','climbing gym','lo-fi coding playlists','board games'], hometown:'Portland, OR', year:'Sophomore', major:'CS', looking_for:'people to hack on weird things with' },
    repos: [],
    activities: ['Open Mic Night - High Noon Saloon','CS Study Jam - Union South','Climbing Meetup - Boulders Gym']
  }
];

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  const URL = Deno.env.get('SUPABASE_URL'); const SRK = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!URL || !SRK) return new Response('missing env', { status: 500, headers: CORS });
  const sb = createClient(URL, SRK);

  const out = [];
  const { data: existing } = await sb.auth.admin.listUsers();
  const existingMap = new Map((existing?.users ?? []).map(u => [u.email, u.id]));

  for (const d of demos) {
    let userId = existingMap.get(d.email) ?? null;
    if (!userId) {
      const { data, error } = await sb.auth.admin.createUser({ email: d.email, password: 'demo-password-123', email_confirm: true, user_metadata: { full_name: d.full_name } });
      if (error) { out.push({ email: d.email, error: error.message }); continue; }
      userId = data.user.id;
    }
    await sb.from('profiles').upsert({ id: userId, email: d.email, full_name: d.full_name, socials: d.socials, xp: 0, level: 1 });
    await sb.from('user_repos').delete().eq('user_id', userId);
    if (d.repos.length) await sb.from('user_repos').insert(d.repos.map(r => ({ ...r, user_id: userId })));

    // Pre-check-in to the named activities
    await sb.from('checkins').delete().eq('user_id', userId);
    for (const aTitle of d.activities) {
      const { data: h } = await sb.from('hotspots').select('id').eq('title', aTitle).maybeSingle();
      if (h?.id) {
        await sb.from('checkins').insert({ user_id: userId, hotspot_id: h.id, xp_awarded: 10, was_first_visit: false, was_daily_discovery: false });
      }
    }
    out.push({ email: d.email, user_id: userId, activities: d.activities.length });
  }
  return new Response(JSON.stringify({ results: out }, null, 2), { headers: { ...CORS, 'content-type': 'application/json' } });
});
