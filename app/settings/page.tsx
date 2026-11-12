'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Card } from '@/components/ui/Card';
import { useSpeechSettings } from '@/hooks/useSpeechSettings';
import { listPendingSessions, flushPendingSessions } from '@/lib/offline/syncQueue';
import { createSupabaseBrowserClient } from '@/lib/database/supabaseClient';
import { useAuthUser } from '@/hooks/useAuthUser';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { signOutThisDevice, unsyncedWorkoutsWarning } from '@/lib/auth/signOut';

function Toggle({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="flex items-center justify-between gap-4 py-2">
      <span>{label}</span>
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="h-6 w-11 cursor-pointer appearance-none rounded-full bg-surface-raised transition-colors checked:bg-accent relative before:absolute before:left-0.5 before:top-0.5 before:h-5 before:w-5 before:rounded-full before:bg-text before:transition-transform checked:before:translate-x-5"
      />
    </label>
  );
}

function SegmentedControl<T extends string>({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: T;
  options: { value: T; label: string }[];
  onChange: (v: T) => void;
}) {
  return (
    <div className="py-2">
      <p className="mb-2">{label}</p>
      <div className="flex flex-wrap gap-2">
        {options.map((opt) => (
          <button
            key={opt.value}
            onClick={() => onChange(opt.value)}
            className={`focus-ring rounded-lg px-3 py-1.5 text-sm ${
              value === opt.value ? 'bg-accent text-black' : 'bg-surface-raised text-text-muted'
            }`}
          >
            {opt.label}
          </button>
        ))}
      </div>
    </div>
  );
}

export default function SettingsPage() {
  const user = useAuthUser();
  const { settings, updateSettings, tonesEnabled, setTonesEnabled, getReadySeconds, setGetReadySeconds } = useSpeechSettings();
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [pendingCount, setPendingCount] = useState<number | null>(null);
  const [flushing, setFlushing] = useState(false);
  const router = useRouter();
  const [confirmSignOut, setConfirmSignOut] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const [signOutError, setSignOutError] = useState<string | null>(null);

  useEffect(() => {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) return;
    const load = () => setVoices(window.speechSynthesis.getVoices());
    load();
    window.speechSynthesis.addEventListener('voiceschanged', load);
    return () => window.speechSynthesis.removeEventListener('voiceschanged', load);
  }, []);

  useEffect(() => {
    void listPendingSessions().then((q) => setPendingCount(q.length));
  }, []);

  const handleFlush = async () => {
    if (!user) return;
    setFlushing(true);
    try {
      const client = createSupabaseBrowserClient();
      const result = await flushPendingSessions(client);
      setPendingCount(result.remaining);
    } finally {
      setFlushing(false);
    }
  };

  const finishSignOut = async () => {
    setSigningOut(true);
    setSignOutError(null);
    const message = await signOutThisDevice(createSupabaseBrowserClient());
    setSigningOut(false);
    setConfirmSignOut(false);
    if (message) {
      setSignOutError(`Couldn't sign out: ${message}`);
      return;
    }
    router.push('/login');
    router.refresh();
  };

  const handleSignOutClick = async () => {
    setSignOutError(null);
    const queue = await listPendingSessions(); // re-read: the count shown above may be stale
    setPendingCount(queue.length);
    if (queue.length > 0) {
      setConfirmSignOut(true);
      return;
    }
    await finishSignOut();
  };

  const handleSyncThenSignOut = async () => {
    setSigningOut(true);
    try {
      const result = await flushPendingSessions(createSupabaseBrowserClient());
      setPendingCount(result.remaining);
      if (result.remaining === 0) {
        await finishSignOut();
        return;
      }
      setSignOutError("Some workouts couldn't sync (are you offline?). They are still saved on this device.");
    } finally {
      setSigningOut(false);
    }
  };

  return (
    <div className="mx-auto max-w-2xl px-4 py-8">
      <h1 className="mb-6 text-2xl font-bold">Settings</h1>

      <Card className="mb-4">
        <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-text-muted">Audio</h2>
        <Toggle
          label="Voice Announcements"
          checked={settings.voiceAnnouncementsEnabled}
          onChange={(v) => updateSettings({ voiceAnnouncementsEnabled: v })}
        />
        <SegmentedControl
          label="Countdown Announcements"
          value={settings.countdownAnnouncements}
          onChange={(v) => updateSettings({ countdownAnnouncements: v })}
          options={[
            { value: 'off', label: 'Off' },
            { value: 'last3', label: 'Last 3' },
            { value: 'last5', label: 'Last 5' },
          ]}
        />
        <Toggle
          label="Announce Duration"
          checked={settings.announceDuration}
          onChange={(v) => updateSettings({ announceDuration: v })}
        />
        <SegmentedControl
          label="Rest Announcement"
          value={settings.restAnnouncementStyle}
          onChange={(v) => updateSettings({ restAnnouncementStyle: v })}
          options={[
            { value: 'restOnly', label: 'Rest' },
            { value: 'restAndNext', label: 'Rest + Next' },
          ]}
        />
        {voices.length > 0 && (
          <div className="py-2">
            <label className="mb-1 block">Voice</label>
            <select
              value={settings.voiceURI ?? ''}
              onChange={(e) => updateSettings({ voiceURI: e.target.value || null })}
              className="focus-ring w-full rounded-lg border border-border bg-bg px-3 py-2.5"
            >
              <option value="">Default</option>
              {voices.map((v) => (
                <option key={v.voiceURI} value={v.voiceURI}>
                  {v.name} ({v.lang})
                </option>
              ))}
            </select>
          </div>
        )}
        <div className="py-2">
          <label className="mb-1 block">Speech Rate ({settings.rate.toFixed(1)}x)</label>
          <input
            type="range"
            min={0.8}
            max={1.4}
            step={0.1}
            value={settings.rate}
            onChange={(e) => updateSettings({ rate: Number(e.target.value) })}
            className="w-full"
          />
        </div>
        <div className="py-2">
          <label className="mb-1 block">Speech Volume ({Math.round(settings.volume * 100)}%)</label>
          <input
            type="range"
            min={0}
            max={1}
            step={0.05}
            value={settings.volume}
            onChange={(e) => updateSettings({ volume: Number(e.target.value) })}
            className="w-full"
          />
        </div>
        <Toggle label="Transition Sounds" checked={tonesEnabled} onChange={setTonesEnabled} />
      </Card>

      <Card className="mb-4">
        <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-text-muted">Workout</h2>
        <SegmentedControl
          label="Pre-Workout Countdown"
          value={String(getReadySeconds) as '0' | '3' | '5' | '10'}
          onChange={(v) => setGetReadySeconds(Number(v))}
          options={[
            { value: '0', label: 'Off' },
            { value: '3', label: '3s' },
            { value: '5', label: '5s' },
            { value: '10', label: '10s' },
          ]}
        />
      </Card>

      <Card>
        <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-text-muted">Data</h2>
        <p className="text-sm text-text-muted">
          {pendingCount === null ? 'Checking…' : pendingCount === 0 ? 'All workouts are synced.' : `${pendingCount} workout${pendingCount === 1 ? '' : 's'} saved locally, waiting to sync.`}
        </p>
        {pendingCount !== null && pendingCount > 0 && (
          <button onClick={handleFlush} disabled={flushing} className="focus-ring mt-2 text-sm text-accent underline">
            {flushing ? 'Syncing…' : 'Sync now'}
          </button>
        )}
      </Card>

      <Card className="mt-4">
        <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-text-muted">Account</h2>
        {user?.email && <p className="text-sm text-text-muted">Signed in as {user.email}</p>}
        <p className="mt-1 text-sm text-text-muted">Signing out only affects this device. Your other devices stay signed in.</p>
        <button
          onClick={() => void handleSignOutClick()}
          disabled={signingOut}
          className="focus-ring mt-3 min-h-11 rounded-lg border border-border px-4 text-sm text-text"
        >
          {signingOut ? 'Signing out…' : 'Sign out'}
        </button>
        {signOutError && <p className="mt-2 text-sm text-danger">{signOutError}</p>}
      </Card>

      <ConfirmDialog
        open={confirmSignOut}
        title="Sign out with unsynced workouts?"
        description={unsyncedWorkoutsWarning(pendingCount ?? 0)}
        confirmLabel="Sign out anyway"
        initialFocus="cancel"
        danger
        extraAction={{ label: 'Sync, then sign out', onClick: () => void handleSyncThenSignOut() }}
        onConfirm={() => void finishSignOut()}
        onCancel={() => setConfirmSignOut(false)}
      />

      <p className="mt-6 text-xs text-text-muted">
        Workout text is sent to Anthropic only when you use AI parsing, modification, or command features.
      </p>
    </div>
  );
}
