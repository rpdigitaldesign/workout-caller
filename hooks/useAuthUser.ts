'use client';

import { useEffect, useState } from 'react';
import type { User } from '@supabase/supabase-js';
import { createSupabaseBrowserClient } from '@/lib/database/supabaseClient';

export function useAuthUser() {
  const [user, setUser] = useState<User | null | undefined>(undefined); // undefined = loading

  useEffect(() => {
    const supabase = createSupabaseBrowserClient();
    let cancelled = false;

    void supabase.auth.getUser().then(({ data }) => {
      if (!cancelled) setUser(data.user);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });

    return () => {
      cancelled = true;
      subscription.unsubscribe();
    };
  }, []);

  return user;
}
