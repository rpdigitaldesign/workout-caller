import { NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/lib/database/supabaseServer';
import { checkRateLimit } from './rateLimit';

/** Shared guard for every AI route: require an authenticated user and enforce the rate limit, keyed by user id. */
export async function requireUserAndRateLimit(): Promise<
  { ok: true; userId: string } | { ok: false; response: NextResponse }
> {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { ok: false, response: NextResponse.json({ ok: false, error: 'unauthenticated' }, { status: 401 }) };
  }

  if (!checkRateLimit(user.id)) {
    return {
      ok: false,
      response: NextResponse.json(
        { ok: false, error: 'rate_limited', message: 'Too many AI requests right now — try again in a minute.' },
        { status: 429 },
      ),
    };
  }

  return { ok: true, userId: user.id };
}
