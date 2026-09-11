'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/Button';
import { createSupabaseBrowserClient } from '@/lib/database/supabaseClient';

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const client = createSupabaseBrowserClient();
    const { error: signInError } = await client.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (signInError) {
      setError('Sign-in failed. Check your email and password.');
      return;
    }
    router.push('/');
    router.refresh();
  };

  return (
    <div className="flex min-h-dvh items-center justify-center bg-bg px-4">
      <form onSubmit={handleSubmit} className="w-full max-w-sm rounded-2xl border border-border bg-surface p-6">
        <h1 className="mb-1 text-2xl font-bold">Workout Caller</h1>
        <p className="mb-6 text-sm text-text-muted">Sign in to continue.</p>
        <div className="flex flex-col gap-3">
          <input
            type="email"
            required
            autoComplete="email"
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="focus-ring rounded-lg border border-border bg-bg px-3 py-2.5"
          />
          <input
            type="password"
            required
            autoComplete="current-password"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="focus-ring rounded-lg border border-border bg-bg px-3 py-2.5"
          />
          {error && <p className="text-sm text-danger">{error}</p>}
          <Button type="submit" size="lg" disabled={loading}>
            {loading ? 'Signing in…' : 'Sign In'}
          </Button>
        </div>
      </form>
    </div>
  );
}
