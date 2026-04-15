import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { clearDemoUser, getDemoUser } from '@/lib/demoUser';
import { progressToNextLevel } from '@/lib/leveling';

interface ProfileRow {
  id: string;
  xp: number;
  level: number;
}

export function Nav() {
  const navigate = useNavigate();
  const location = useLocation();
  const demo = getDemoUser();
  const [profile, setProfile] = useState<ProfileRow | null>(null);

  useEffect(() => {
    if (!demo) return;
    let cancelled = false;
    const load = async (): Promise<void> => {
      const { data } = await supabase
        .from('profiles')
        .select('id, xp, level')
        .eq('id', demo.id)
        .maybeSingle();
      if (!cancelled && data) setProfile(data as ProfileRow);
    };
    void load();
    const t = setInterval(load, 4000);
    return () => {
      cancelled = true;
      clearInterval(t);
    };
  }, [demo?.id, location.pathname]);

  async function handleSwitch(): Promise<void> {
    await supabase.auth.signOut();
    clearDemoUser();
    navigate('/');
    window.location.reload();
  }

  const initial = (demo?.fullName ?? '?').trim().slice(0, 1).toUpperCase();
  const prog = profile ? progressToNextLevel(profile.xp) : null;

  const navLink = (to: string, label: string): JSX.Element => {
    const active = location.pathname.startsWith(to);
    return (
      <Link
        to={to}
        className={[
          'rounded-full px-3 py-1 text-sm font-medium transition-colors duration-200 ease-out',
          active ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-400 hover:bg-white/5 hover:text-slate-100',
        ].join(' ')}
      >
        {label}
      </Link>
    );
  };

  return (
    <nav className="flex items-center justify-between border-b border-white/10 bg-slate-950/80 px-4 py-2.5 backdrop-blur">
      <div className="flex items-center gap-5">
        <Link to="/map" className="flex items-center gap-2">
          <span className="text-base font-bold tracking-tight text-slate-100">
            What
            <span className="bg-gradient-to-r from-indigo-400 to-fuchsia-400 bg-clip-text text-transparent">IsThe</span>
            Move
          </span>
        </Link>
        <div className="flex items-center gap-1">
          {navLink('/map', 'Map')}
          {navLink('/profile', 'Profile')}
        </div>
      </div>
      <div className="flex items-center gap-3">
        {demo && profile && prog && (
          <div className="hidden items-center gap-3 rounded-full border border-white/10 bg-white/5 px-3 py-1 sm:flex">
            <span className="text-[11px] font-semibold uppercase tracking-[0.14em] text-indigo-300">
              Lv {profile.level}
            </span>
            <div className="h-1.5 w-24 overflow-hidden rounded-full bg-white/10">
              <div
                className="h-full rounded-full bg-gradient-to-r from-indigo-400 to-fuchsia-400 transition-all duration-500"
                style={{ width: `${Math.round(prog.progress * 100)}%` }}
              />
            </div>
            <span className="text-[11px] font-medium text-slate-300">{profile.xp} XP</span>
          </div>
        )}
        {demo && (
          <div className="flex items-center gap-2">
            <span className="hidden text-sm font-medium text-slate-200 sm:inline">{demo.fullName}</span>
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-indigo-500 to-fuchsia-500 text-xs font-bold text-white shadow-sm">
              {initial}
            </div>
          </div>
        )}
        <button
          onClick={handleSwitch}
          className="rounded-full border border-white/10 px-2.5 py-1 text-[11px] font-medium text-slate-300 transition-colors duration-200 hover:bg-white/5 hover:text-slate-100"
        >
          Switch
        </button>
      </div>
    </nav>
  );
}

export default Nav;
