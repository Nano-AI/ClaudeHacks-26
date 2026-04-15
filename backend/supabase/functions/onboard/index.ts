// Edge function: onboard
// Body: { email: string, password: string, full_name: string, socials: Record<string, unknown> }
// Returns: { user_id: string }

import { createClient } from 'npm:@supabase/supabase-js@2';

const CORS_HEADERS: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS_HEADERS, 'content-type': 'application/json' },
  });
}

Deno.serve(async (req: Request): Promise<Response> => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: CORS_HEADERS });
  }

  const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
  const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    return json({ error: 'missing env' }, 500);
  }

  let body: {
    email?: string;
    password?: string;
    full_name?: string;
    socials?: Record<string, unknown>;
  };
  try {
    body = await req.json();
  } catch {
    return json({ error: 'invalid json' }, 400);
  }

  const email = (body.email ?? '').trim();
  const password = (body.password ?? '').trim() || 'demo-password-123';
  const fullName = (body.full_name ?? '').trim() || 'New User';
  const socials = body.socials ?? {};

  if (!email) return json({ error: 'email required' }, 400);

  const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  // Try create user; if already exists, look them up.
  let userId: string | null = null;
  const { data: created, error: createErr } = await sb.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { full_name: fullName },
  });

  if (created?.user?.id) {
    userId = created.user.id;
  } else if (createErr) {
    // Try to find existing user by listing
    const { data: list } = await sb.auth.admin.listUsers({ page: 1, perPage: 200 });
    const found = list?.users?.find((u) => u.email?.toLowerCase() === email.toLowerCase());
    if (found) {
      userId = found.id;
      // Reset their password so client can sign in
      await sb.auth.admin.updateUserById(found.id, { password });
    } else {
      return json({ error: createErr.message }, 400);
    }
  }

  if (!userId) return json({ error: 'could not create user' }, 500);

  const profileRow = {
    id: userId,
    email,
    full_name: fullName,
    socials,
  };
  const { error: upErr } = await sb
    .from('profiles')
    .upsert(profileRow, { onConflict: 'id' });
  if (upErr) {
    return json({ error: upErr.message }, 500);
  }

  return json({ user_id: userId });
});
