import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/lib/supabase';

const HOBBY_OPTIONS = [
  'trail running',
  'climbing',
  'jazz',
  'ramen',
  'board games',
  'design critique',
  'rust CLIs',
  'discord bots',
  'indie film',
  'yoga',
  'jazz bass',
  'specialty coffee',
  'lo-fi coding',
  'ceramics',
  'spanish language',
];

function parseList(s: string): string[] {
  return s
    .split(/[,;\n]/)
    .map((x) => x.trim())
    .filter((x) => x.length > 0)
    .slice(0, 5);
}

const STEPS = ['Identity', 'Vibes', 'Details'] as const;
type Step = (typeof STEPS)[number];

export default function Onboarding(): JSX.Element {
  const navigate = useNavigate();
  const [step, setStep] = useState<Step>('Identity');
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [hobbies, setHobbies] = useState<Set<string>>(new Set());
  const [customHobby, setCustomHobby] = useState('');
  const [artists, setArtists] = useState('');
  const [films, setFilms] = useState('');
  const [hometown, setHometown] = useState('');
  const [year, setYear] = useState('');
  const [major, setMajor] = useState('');
  const [lookingFor, setLookingFor] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  function toggleHobby(h: string): void {
    setHobbies((prev) => {
      const next = new Set(prev);
      if (next.has(h)) next.delete(h);
      else next.add(h);
      return next;
    });
  }

  function addCustomHobby(): void {
    const v = customHobby.trim();
    if (!v) return;
    setHobbies((prev) => new Set(prev).add(v));
    setCustomHobby('');
  }

  async function handleSubmit(e: FormEvent<HTMLFormElement>): Promise<void> {
    e.preventDefault();
    if (busy) return;
    const name = fullName.trim() || 'New User';
    const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '') || 'user';
    const derivedEmail = email.trim() || `${slug}-${Date.now().toString(36)}@demo.witm`;
    const pw = password.trim() || 'demo-password-123';

    const socials: Record<string, unknown> = {
      interests: Array.from(hobbies),
      spotify_top_artists: parseList(artists),
      letterboxd_favs: parseList(films),
      hometown: hometown.trim() || null,
      year: year.trim() || null,
      major: major.trim() || null,
      looking_for: lookingFor.trim() || null,
    };

    setBusy(true);
    setErr(null);
    try {
      const { data, error } = await supabase.functions.invoke('onboard', {
        body: { email: derivedEmail, password: pw, full_name: name, socials },
      });
      if (error) throw new Error(error.message);
      const resp = data as { user_id?: string; error?: string } | null;
      if (!resp || typeof resp.user_id !== 'string') {
        throw new Error(resp?.error ?? 'Onboarding failed');
      }
      const { error: signErr } = await supabase.auth.signInWithPassword({ email: derivedEmail, password: pw });
      if (signErr) throw signErr;
      window.localStorage.setItem('demo_user_custom', JSON.stringify({ id: resp.user_id, email: derivedEmail, fullName: name }));
      navigate('/map');
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : 'Something went wrong');
      setBusy(false);
    }
  }

  const labelCls = 'text-[11px] font-semibold uppercase tracking-[0.14em] text-indigo-300';
  const inputCls = 'mt-2 w-full rounded-xl border border-white/10 bg-white/5 px-3.5 py-2.5 text-sm text-slate-100 placeholder-slate-500 transition focus:border-indigo-400 focus:bg-white/10 focus:outline-none focus:ring-2 focus:ring-indigo-400/30';

  const stepIdx = STEPS.indexOf(step);

  return (
    <div className="relative min-h-screen overflow-hidden bg-slate-950 text-slate-100">
      <div className="pointer-events-none absolute -top-32 -right-32 h-96 w-96 rounded-full bg-fuchsia-500/20 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-40 -left-32 h-96 w-96 rounded-full bg-indigo-500/20 blur-3xl" />

      <div className="relative mx-auto w-full max-w-xl px-6 py-10">
        <button
          type="button"
          onClick={() => navigate('/')}
          className="mb-6 inline-flex items-center gap-1 text-xs font-medium text-slate-400 transition-colors hover:text-slate-100"
        >
          ← Back
        </button>

        <div className="mb-6">
          <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs font-medium text-indigo-300 backdrop-blur">
            Sign up · your vibes
          </div>
          <h1 className="mt-4 bg-gradient-to-r from-indigo-300 via-violet-300 to-pink-300 bg-clip-text text-4xl font-bold tracking-tight text-transparent">
            Tell us what you're into
          </h1>
          <p className="mt-2 text-sm text-slate-400">
            We'll match you with real people at activities happening right now.
          </p>
        </div>

        {/* Step progress */}
        <div className="mb-6 flex items-center gap-2">
          {STEPS.map((s, i) => (
            <div key={s} className="flex flex-1 items-center gap-2">
              <div
                className={[
                  'flex h-7 w-7 items-center justify-center rounded-full text-[11px] font-bold transition-all duration-300',
                  i <= stepIdx
                    ? 'bg-gradient-to-br from-indigo-500 to-fuchsia-500 text-white shadow-md shadow-fuchsia-500/20'
                    : 'border border-white/10 bg-white/5 text-slate-500',
                ].join(' ')}
              >
                {i + 1}
              </div>
              <span className={['text-xs font-medium', i === stepIdx ? 'text-slate-100' : 'text-slate-500'].join(' ')}>{s}</span>
              {i < STEPS.length - 1 && (
                <div className="flex-1">
                  <div className={['h-px', i < stepIdx ? 'bg-gradient-to-r from-indigo-400 to-fuchsia-400' : 'bg-white/10'].join(' ')} />
                </div>
              )}
            </div>
          ))}
        </div>

        <form
          onSubmit={handleSubmit}
          className="space-y-6 rounded-2xl border border-white/10 bg-white/5 p-6 shadow-xl shadow-indigo-500/10 backdrop-blur"
        >
          {step === 'Identity' && (
            <div key="identity" className="animate-fade-in space-y-5">
              <label className="block">
                <span className={labelCls}>Full name</span>
                <input type="text" value={fullName} onChange={(e) => setFullName(e.target.value)} className={inputCls} placeholder="Sam Rivera" autoFocus />
              </label>
              <label className="block">
                <span className={labelCls}>Email</span>
                <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className={inputCls} placeholder="optional — we'll derive one" />
              </label>
              <label className="block">
                <span className={labelCls}>Password</span>
                <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} className={inputCls} placeholder="leave blank for demo-password-123" />
              </label>
              <div className="flex justify-end pt-1">
                <button
                  type="button"
                  onClick={() => setStep('Vibes')}
                  className="rounded-xl bg-gradient-to-r from-indigo-500 to-fuchsia-500 px-5 py-2.5 text-sm font-semibold text-white shadow-md shadow-fuchsia-500/20 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-lg"
                >
                  Continue →
                </button>
              </div>
            </div>
          )}

          {step === 'Vibes' && (
            <div key="vibes" className="animate-fade-in space-y-5">
              <div>
                <span className={labelCls}>Hobbies & vibes</span>
                <div className="mt-3 flex flex-wrap gap-2">
                  {HOBBY_OPTIONS.map((h) => {
                    const on = hobbies.has(h);
                    return (
                      <button
                        type="button"
                        key={h}
                        onClick={() => toggleHobby(h)}
                        className={[
                          'rounded-full px-3 py-1.5 text-xs font-medium transition-all duration-200',
                          on
                            ? 'bg-gradient-to-r from-indigo-500 to-fuchsia-500 text-white shadow-md shadow-fuchsia-500/20'
                            : 'border border-white/10 bg-white/5 text-slate-300 hover:border-indigo-400/50 hover:bg-white/10 hover:text-slate-100',
                        ].join(' ')}
                      >
                        {h}
                      </button>
                    );
                  })}
                  {Array.from(hobbies)
                    .filter((h) => !HOBBY_OPTIONS.includes(h))
                    .map((h) => (
                      <button
                        type="button"
                        key={h}
                        onClick={() => toggleHobby(h)}
                        className="rounded-full bg-gradient-to-r from-indigo-500 to-fuchsia-500 px-3 py-1.5 text-xs font-medium text-white shadow-md shadow-fuchsia-500/20"
                      >
                        {h} ×
                      </button>
                    ))}
                </div>
                <div className="mt-3 flex gap-2">
                  <input
                    type="text"
                    value={customHobby}
                    onChange={(e) => setCustomHobby(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        addCustomHobby();
                      }
                    }}
                    placeholder="add your own…"
                    className="flex-1 rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-sm text-slate-100 placeholder-slate-500 focus:border-indigo-400 focus:bg-white/10 focus:outline-none"
                  />
                  <button
                    type="button"
                    onClick={addCustomHobby}
                    className="rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-semibold text-slate-300 transition hover:bg-white/10 hover:text-slate-100"
                  >
                    Add
                  </button>
                </div>
              </div>
              <label className="block">
                <span className={labelCls}>Top Spotify artists</span>
                <input type="text" value={artists} onChange={(e) => setArtists(e.target.value)} className={inputCls} placeholder="Phoebe Bridgers, MF DOOM, Alvvays" />
              </label>
              <label className="block">
                <span className={labelCls}>Favorite films</span>
                <input type="text" value={films} onChange={(e) => setFilms(e.target.value)} className={inputCls} placeholder="Past Lives, Whiplash, Paddington 2" />
              </label>
              <div className="flex justify-between pt-1">
                <button
                  type="button"
                  onClick={() => setStep('Identity')}
                  className="rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm font-medium text-slate-300 transition hover:bg-white/10 hover:text-slate-100"
                >
                  ← Back
                </button>
                <button
                  type="button"
                  onClick={() => setStep('Details')}
                  className="rounded-xl bg-gradient-to-r from-indigo-500 to-fuchsia-500 px-5 py-2.5 text-sm font-semibold text-white shadow-md shadow-fuchsia-500/20 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-lg"
                >
                  Continue →
                </button>
              </div>
            </div>
          )}

          {step === 'Details' && (
            <div key="details" className="animate-fade-in space-y-5">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <label className="block">
                  <span className={labelCls}>Hometown</span>
                  <input type="text" value={hometown} onChange={(e) => setHometown(e.target.value)} className={inputCls} placeholder="Minneapolis" />
                </label>
                <label className="block">
                  <span className={labelCls}>Year</span>
                  <input type="text" value={year} onChange={(e) => setYear(e.target.value)} className={inputCls} placeholder="Junior" />
                </label>
                <label className="block sm:col-span-2">
                  <span className={labelCls}>Major</span>
                  <input type="text" value={major} onChange={(e) => setMajor(e.target.value)} className={inputCls} placeholder="Computer Science" />
                </label>
                <label className="block sm:col-span-2">
                  <span className={labelCls}>What are you looking for?</span>
                  <textarea
                    value={lookingFor}
                    onChange={(e) => setLookingFor(e.target.value)}
                    rows={2}
                    className={inputCls}
                    placeholder="low-key hangs, someone to bike to the lake with…"
                  />
                </label>
              </div>

              {err && (
                <div className="rounded-lg border border-red-400/30 bg-red-500/10 px-3 py-2 text-sm text-red-200">
                  {err}
                </div>
              )}

              <div className="flex justify-between pt-1">
                <button
                  type="button"
                  onClick={() => setStep('Vibes')}
                  className="rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm font-medium text-slate-300 transition hover:bg-white/10 hover:text-slate-100"
                >
                  ← Back
                </button>
                <button
                  type="submit"
                  disabled={busy}
                  className="rounded-xl bg-gradient-to-r from-indigo-500 to-fuchsia-500 px-6 py-2.5 text-sm font-semibold text-white shadow-md shadow-fuchsia-500/20 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-lg disabled:opacity-60 disabled:hover:translate-y-0"
                >
                  {busy ? 'Setting things up…' : 'Find the move'}
                </button>
              </div>
            </div>
          )}
        </form>
      </div>
    </div>
  );
}
