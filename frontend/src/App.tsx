import { useEffect, useState } from 'react';
import {
  Navigate,
  Route,
  Routes,
  useLocation,
  useNavigate,
} from 'react-router-dom';
import { Nav } from '@/components/layout/Nav';
import { getDemoUser, signInByEmail } from '@/lib/demoUser';
import { supabase } from '@/lib/supabase';
import MapPage from '@/pages/Map';
import PinDetailPage from '@/pages/PinDetail';
import EncounterPage from '@/pages/Encounter';
import ProfilePage from '@/pages/Profile';
import OnboardingPage from '@/pages/Onboarding';

interface DemoProfile {
  id: string;
  email: string;
  full_name: string;
  socials: { year?: string; major?: string; interests?: string[]; looking_for?: string } | null;
}

const GRADIENTS: [string, string][] = [
  ['from-indigo-500', 'to-violet-600'],
  ['from-pink-500', 'to-fuchsia-600'],
  ['from-emerald-500', 'to-teal-600'],
  ['from-amber-500', 'to-orange-600'],
  ['from-sky-500', 'to-blue-600'],
  ['from-rose-500', 'to-red-600'],
  ['from-lime-500', 'to-green-600'],
  ['from-violet-500', 'to-purple-600'],
  ['from-cyan-500', 'to-sky-600'],
  ['from-fuchsia-500', 'to-pink-600'],
];

function Landing({ onPicked }: { onPicked: () => void }) {
  const navigate = useNavigate();
  const [busyEmail, setBusyEmail] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [profiles, setProfiles] = useState<DemoProfile[]>([]);
  const [leaving, setLeaving] = useState(false);

  useEffect(() => {
    void (async () => {
      const { data } = await supabase
        .from('profiles')
        .select('id, email, full_name, socials')
        .like('email', '%@demo.witm');
      setProfiles(((data ?? []) as DemoProfile[]).sort((a, b) => a.full_name.localeCompare(b.full_name)));
    })();
  }, []);

  async function pick(p: DemoProfile) {
    setBusyEmail(p.email);
    setErr(null);
    try {
      await signInByEmail(p.email, p.full_name);
      setLeaving(true);
      window.setTimeout(() => {
        onPicked();
      }, 220);
    } catch (e) {
      setErr((e as Error).message);
      setBusyEmail(null);
    }
  }

  return (
    <div
      className={[
        'relative min-h-screen overflow-hidden bg-slate-950 text-slate-100',
        leaving ? 'animate-fade-out' : 'animate-fade-in',
      ].join(' ')}
    >
      <div className="pointer-events-none absolute -top-32 -right-32 h-96 w-96 rounded-full bg-fuchsia-500/20 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-40 -left-32 h-96 w-96 rounded-full bg-indigo-500/20 blur-3xl" />

      <div className="relative mx-auto flex min-h-screen w-full max-w-5xl flex-col items-center justify-center px-6 py-12">
        <div className="text-center">
          <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs font-medium text-indigo-300 backdrop-blur">
            WhatIsTheMove · live in Madison
          </div>
          <h1 className="mt-5 bg-gradient-to-r from-indigo-300 via-violet-300 to-pink-300 bg-clip-text text-5xl font-bold tracking-tight text-transparent sm:text-6xl">
            What's the move?
            <br className="hidden sm:block" />
            <span className="text-4xl sm:text-5xl text-slate-200">Find people worth meeting — at what's actually happening right now.</span>
          </h1>
          <p className="mx-auto mt-5 max-w-xl text-base text-slate-400">
            Pick a mood, match to live activities nearby, and meet via a quick mini-game.
          </p>
        </div>

        {(() => {
          const CANONICAL = new Set([
            'alex@demo.witm','jordan@demo.witm','sam@demo.witm','maya@demo.witm',
            'diego@demo.witm','priya@demo.witm','noah@demo.witm','riley@demo.witm','theo@demo.witm',
          ]);
          const canonical = profiles.filter((p) => CANONICAL.has(p.email));
          const onboarded = profiles.filter((p) => !CANONICAL.has(p.email));

          const renderCard = (p: DemoProfile, gi: number): JSX.Element => {
            const [from, to] = GRADIENTS[gi % GRADIENTS.length];
            const first = (p.full_name || p.email).slice(0, 1).toUpperCase();
            const year = p.socials?.year ?? '';
            const major = p.socials?.major ?? '';
            const chip = p.socials?.interests?.[0] ?? p.socials?.looking_for ?? '';
            const bio = p.socials?.looking_for ?? '';
            return (
              <button
                key={p.id}
                disabled={busyEmail !== null}
                onClick={() => pick(p)}
                className="group relative overflow-hidden rounded-2xl border border-white/10 bg-white/5 p-5 text-left shadow-xl shadow-indigo-500/10 backdrop-blur transition hover:-translate-y-0.5 hover:border-white/20 hover:shadow-2xl hover:shadow-indigo-500/20 disabled:opacity-50"
              >
                <div className="flex items-center gap-3">
                  <div className={`flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br ${from} ${to} text-xl font-bold text-white shadow-md`}>
                    {first}
                  </div>
                  <div className="min-w-0">
                    <div className="truncate text-base font-semibold text-slate-100">{p.full_name}</div>
                    <div className="truncate text-xs text-slate-400">{[year, major].filter(Boolean).join(' · ')}</div>
                  </div>
                </div>
                {bio && (
                  <p className="mt-3 line-clamp-2 text-sm leading-relaxed text-slate-300">looking for: {bio}</p>
                )}
                <div className="mt-3 flex items-center justify-between">
                  {chip ? (
                    <span className="rounded-full bg-white/10 px-2.5 py-1 text-xs font-medium text-slate-300">{chip}</span>
                  ) : <span />}
                  <span className="text-xs font-medium text-indigo-300 opacity-0 transition group-hover:opacity-100">
                    {busyEmail === p.email ? 'Signing in…' : 'Continue →'}
                  </span>
                </div>
              </button>
            );
          };

          return (
            <div className="mt-10 w-full space-y-8">
              <div>
                <div className="mb-3 flex items-baseline justify-between">
                  <div className="text-xs font-semibold uppercase tracking-[0.14em] text-indigo-300">
                    Pick a demo identity
                  </div>
                  <div className="text-[11px] text-slate-500">{canonical.length} curated</div>
                </div>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {canonical.map((p, i) => renderCard(p, i))}
                </div>
              </div>

              {onboarded.length > 0 && (
                <div>
                  <div className="mb-3 flex items-baseline justify-between">
                    <div className="text-xs font-semibold uppercase tracking-[0.14em] text-emerald-300">
                      New users
                    </div>
                    <div className="text-[11px] text-slate-500">{onboarded.length} signed up</div>
                  </div>
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                    {onboarded.map((p, i) => renderCard(p, i + canonical.length))}
                  </div>
                </div>
              )}
            </div>
          );
        })()}

        {err && (
          <p className="mt-6 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
            {err}
          </p>
        )}

        <button
          type="button"
          onClick={() => navigate('/onboarding')}
          className="mt-8 text-sm font-medium text-indigo-700 underline-offset-4 transition hover:text-indigo-900 hover:underline"
        >
          Or sign up with your own vibes →
        </button>
      </div>
    </div>
  );
}

function Shell() {
  const location = useLocation();
  return (
    <div className="flex h-screen flex-col bg-slate-950 text-slate-100 animate-fade-in">
      <Nav />
      <main key={location.pathname} className="relative flex-1 min-h-0 animate-fade-in">
        <Routes location={location}>
          <Route path="/" element={<Navigate to="/map" replace />} />
          <Route path="/map" element={<MapPage />} />
          <Route path="/pin/:id" element={<PinDetailPage />} />
          <Route path="/encounter/:id" element={<EncounterPage />} />
          <Route path="/profile" element={<ProfilePage />} />
          <Route path="*" element={<Navigate to="/map" replace />} />
        </Routes>
      </main>
    </div>
  );
}

function AppRouter() {
  const [hasUser, setHasUser] = useState<boolean>(() => getDemoUser() !== null);
  const location = useLocation();

  useEffect(() => {
    setHasUser(getDemoUser() !== null);
  }, [location.pathname]);

  if (location.pathname === '/onboarding') {
    return (
      <Routes>
        <Route path="/onboarding" element={<OnboardingPage />} />
      </Routes>
    );
  }

  if (!hasUser) {
    return <Landing onPicked={() => setHasUser(true)} />;
  }

  return <Shell />;
}

export default function App() {
  return <AppRouter />;
}
