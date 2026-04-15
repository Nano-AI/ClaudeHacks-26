import { supabase } from '@/lib/supabase';

export type DemoUserKey = 'alex' | 'jordan';

export interface DemoUserInfo {
  key: DemoUserKey;
  id: string;
  email: string;
  fullName: string;
}

const STORAGE_KEY = 'demo_user_custom';
export const DEMO_PASSWORD = 'demo-password-123';

export function getDemoUser(): DemoUserInfo | null {
  if (typeof window === 'undefined') return null;
  const raw = window.localStorage.getItem(STORAGE_KEY);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as { id: string; email: string; fullName: string };
    if (parsed?.id) {
      return { key: 'alex', id: parsed.id, email: parsed.email, fullName: parsed.fullName };
    }
  } catch {
    // ignore
  }
  return null;
}

export function setDemoUserCustom(info: { id: string; email: string; fullName: string }): void {
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(info));
}

export function clearDemoUser(): void {
  window.localStorage.removeItem(STORAGE_KEY);
  window.localStorage.removeItem('demo_user');
}

export async function getDemoUserId(): Promise<string> {
  const { data } = await supabase.auth.getUser();
  if (data.user?.id) return data.user.id;
  const local = getDemoUser();
  if (local) return local.id;
  throw new Error('no demo user');
}

export async function signInByEmail(email: string, fullName: string): Promise<DemoUserInfo> {
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password: DEMO_PASSWORD,
  });
  if (error || !data.user) throw error ?? new Error('sign in failed');
  const info = { id: data.user.id, email, fullName };
  setDemoUserCustom(info);
  return { key: 'alex', ...info };
}

// Back-compat: the two hardcoded seeds still exist in the DB but we no longer rely on their IDs.
export async function signInDemoUser(which: DemoUserKey): Promise<DemoUserInfo> {
  const email = which === 'alex' ? 'alex@demo.witm' : 'jordan@demo.witm';
  const fullName = which === 'alex' ? 'Alex Park' : 'Jordan Lee';
  return signInByEmail(email, fullName);
}
