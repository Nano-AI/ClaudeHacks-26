import { useEffect, useState } from 'react';
import {
  Navigate,
  Route,
  Routes,
  useLocation,
  useNavigate,
} from 'react-router-dom';
import { Nav } from '@/components/layout/Nav';
import { getDemoUser } from '@/lib/demoUser';
import MapPage from '@/pages/Map';
import PinDetailPage from '@/pages/PinDetail';
import EncounterPage from '@/pages/Encounter';
import ProfilePage from '@/pages/Profile';
import OnboardingPage from '@/pages/Onboarding';

function Landing() {
  const navigate = useNavigate();
  const [leaving, setLeaving] = useState(false);

  function goSignUp() {
    setLeaving(true);
    window.setTimeout(() => navigate('/onboarding'), 200);
  }

  return (
    <div
      className={[
        'relative min-h-screen overflow-hidden bg-slate-950 text-slate-100',
        leaving ? 'animate-fade-out' : 'animate-fade-in',
      ].join(' ')}
    >
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top,rgba(99,102,241,0.18),transparent_55%),radial-gradient(ellipse_at_bottom_right,rgba(236,72,153,0.14),transparent_50%),radial-gradient(ellipse_at_bottom_left,rgba(34,211,238,0.10),transparent_50%)]" />
      <div className="pointer-events-none absolute -top-40 left-1/2 h-[36rem] w-[36rem] -translate-x-1/2 rounded-full bg-violet-500/15 blur-[120px]" />
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_1px_1px,rgba(255,255,255,0.05)_1px,transparent_0)] [background-size:28px_28px] [mask-image:radial-gradient(ellipse_at_center,black_40%,transparent_75%)]" />

      <div className="relative mx-auto flex min-h-screen w-full max-w-3xl flex-col items-center justify-center px-6 py-16 text-center">
        <h1 className="bg-gradient-to-b from-white to-slate-400 bg-clip-text text-6xl font-bold tracking-tight text-transparent sm:text-7xl md:text-8xl">
          What is the move?
        </h1>

        <p className="mt-8 max-w-xl text-lg leading-relaxed text-slate-300 sm:text-xl">
          A live map of what's going on around you. Drop a pin, see who else is out, and go meet them.
        </p>

        <div className="mt-12 flex flex-col items-center gap-3">
          <button
            type="button"
            onClick={goSignUp}
            className="group inline-flex items-center gap-2 rounded-full bg-white px-8 py-3.5 text-base font-semibold text-slate-950 shadow-lg shadow-violet-500/20 transition hover:-translate-y-0.5 hover:shadow-xl hover:shadow-violet-500/30"
          >
            Sign up
            <span className="transition group-hover:translate-x-0.5">→</span>
          </button>
          <p className="text-xs text-slate-500">Free. Takes a minute.</p>
        </div>
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
    return <Landing />;
  }

  return <Shell />;
}

export default function App() {
  return <AppRouter />;
}
