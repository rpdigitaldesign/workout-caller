# Workout Caller

A personal, iPhone/iPad-first workout timer, library, history, calendar, and AI-assisted planner. You paste (or type) a workout in plain English, review it, and the app calls out each exercise and rest period out loud while you exercise — hands-free, headphones-friendly, and fully offline-resilient once a workout has started.

## Requirements

- Node.js 20+ (developed against Node 25; anything reasonably current works)
- An [Anthropic](https://console.anthropic.com/) account and API key
- A [Supabase](https://supabase.com/) account (free tier is enough)

## 1. Setup

```bash
npm install
cp .env.example .env.local
```

Fill in `.env.local` (see the two provisioning sections below for where each value comes from):

```env
ANTHROPIC_API_KEY=
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
```

`ANTHROPIC_API_KEY` and `SUPABASE_SERVICE_ROLE_KEY` are server-only secrets — never prefix them with `NEXT_PUBLIC_`, and never reference them from a Client Component. `NEXT_PUBLIC_SUPABASE_URL`/`NEXT_PUBLIC_SUPABASE_ANON_KEY` are safe to expose to the browser; Row Level Security (RLS), not secrecy of the anon key, is what protects your data (see §3).

## 2. Get an Anthropic API key

1. Go to <https://console.anthropic.com/> and sign in (or create an account).
2. Open **Settings → API Keys** and create a new key.
3. Paste it into `.env.local` as `ANTHROPIC_API_KEY`.
4. Anthropic API usage bills per request — the model used here (see §7) is a small/fast one chosen specifically to keep this cheap for the parsing tasks this app does, but usage still isn't free. Check <https://console.anthropic.com/settings/billing> if you want to set a spending cap.

The key is read only in server-side code (`lib/anthropic/client.ts`, guarded by `import 'server-only'`, which makes it a **build error** if anything ever tries to import that module from client code) and is never sent to the browser.

## 3. Create and configure your Supabase project

1. Go to <https://supabase.com/dashboard> and create a new project (any region; the free tier is sufficient for one user).
2. Once it's provisioned, go to **Project Settings → API** and copy:
   - **Project URL** → `NEXT_PUBLIC_SUPABASE_URL`
   - **anon public** key → `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - **service_role** key → `SUPABASE_SERVICE_ROLE_KEY` (kept for admin/setup scripts; the app itself doesn't currently use it at runtime — never expose it to the browser if you do use it later)
3. **Apply the database migrations.** In the Supabase dashboard, open **SQL Editor**, and run the two files in `supabase/migrations/` **in order**:
   - `0001_init.sql` — creates the three tables and their indexes
   - `0002_rls.sql` — enables Row Level Security and the ownership policies

   (If you prefer the CLI: `npx supabase login`, `npx supabase link --project-ref <your-ref>`, `npx supabase db push` — the migrations are plain, CLI-compatible SQL either way.)
4. **Create your one user account.** This app has no public sign-up page by design (see §5) — go to **Authentication → Users → Add user** in the Supabase dashboard and create yourself an email + password. That's the email/password you'll use on the app's `/login` screen. It does not need to match any other account you have — this is a separate, personal project.

## 4. Run locally

```bash
npm run dev
```

Open <http://localhost:3000> — you'll land on `/login` first (see §5).

## 5. Authentication

This is a single-user app, so authentication is deliberately minimal: **Supabase Auth with email/password**, one account you create yourself in the Supabase dashboard (§3 step 4). There's no self-serve sign-up route. The actual security boundary is Row Level Security on every table (`user_id = auth.uid()`), not the login screen itself — so even if someone bypassed the `/login` redirect, they couldn't read or write another user's rows (there's only ever one user's rows here, but this is future-proofed for free).

## 6. Project structure

```
app/                    Next.js App Router pages + API routes
  api/parse-workout/    AI: text -> structured Workout
  api/modify-workout/   AI: workout + instruction -> modified Workout
  api/parse-command/    AI: natural language -> structured WorkoutCommand
  workout/[runId]/run/  The active workout run screen
  calendar/, workouts/, history/, settings/, login/
components/             UI components, grouped by feature area
hooks/                  useWorkoutTimer, useWakeLock, useSpeechSettings, ...
lib/
  workout/              schema.ts (Zod), engine.ts (timer state machine), duration.ts
  anthropic/            Claude client, prompts, the three AI call modules
  database/             Supabase queries for templates/scheduled/sessions/search
  calendar/             month/week grid math, copy-week mapping
  dates/                timezone-safe natural-language date resolution
  speech/, audio/       Web Speech / Web Audio wrappers
  offline/              IndexedDB active-workout recovery + sync queue
  commands/             executeCommand.ts — the ONLY place a natural-language
                         command becomes a database write
supabase/migrations/    SQL schema + RLS policies
tests/                  unit / ai test suites (Vitest)
```

## 7. Changing the Claude model

The model id lives in exactly one place: [`lib/anthropic/constants.ts`](lib/anthropic/constants.ts). It's currently set to `claude-haiku-4-5-20251001` — fast and inexpensive, which is appropriate since every AI call here is short-to-medium structured extraction (parsing a workout, applying one targeted edit, interpreting a short command), never open-ended reasoning. To upgrade later, change the one constant there.

## 8. Deploying to Vercel

1. Push this repository to GitHub (or GitLab/Bitbucket).
2. In Vercel, **Import Project** and select the repo.
3. Add the four environment variables from `.env.local` under **Settings → Environment Variables** (Production and Preview).
4. Build command / output: Vercel auto-detects Next.js — no changes needed.
5. Deploy. All the app's real-time browser APIs (Web Speech, Web Audio, Wake Lock, Service Worker) require **HTTPS**, which Vercel provides by default.
6. Re-run the SQL migrations against your Supabase project before (or right after) your first production deploy if you haven't already (§3).

## 9. Installing on iPad / iPhone

1. Deploy the app (§8), or run it locally and access it from your device on the same network.
2. Open the URL in **Safari** (not Chrome — Add to Home Screen with full PWA behavior needs Safari on iOS/iPadOS).
3. Tap the **Share** icon → **Add to Home Screen**.
4. Open **Workout Caller** from your Home Screen — it launches full-screen, without Safari's browser chrome.
5. The very first time you tap **Start Workout** in a session, that tap is what unlocks audio/speech (iOS requires a real user gesture for this) — you'll hear the "Get Ready" countdown start immediately after.
6. Keep Workout Caller open and the screen unlocked (it requests a screen wake lock automatically) during a workout for the most reliable timing — see the limitations below.

## 10. Known Safari / iPad limitations

- **Backgrounding**: if iPadOS fully suspends Safari (e.g., you switch apps for an extended period, or the OS reclaims memory), timing can't be guaranteed while suspended. The app is built to recover correctly the instant you return to it — it recomputes your exact position from real timestamps rather than resuming a stale countdown — but it can't run science while it isn't running at all. Keep the app in the foreground for the most reliable session.
- **Speech + music**: this app does not and cannot control Spotify/YouTube Music's volume or playback. It keeps its own spoken announcements short and offers transition tones and a fully speech-off mode so it stays usable no matter how your phone mixes audio.
- **Voice selection**: available voices come from `speechSynthesis.getVoices()`, which varies by device/OS version and can load asynchronously on first use.
- **Wake Lock**: supported on modern iOS/iPadOS Safari, but is feature-detected — if unsupported, the workout still runs correctly, your screen may just lock.
- **Add to Home Screen** must be done from Safari itself; other browsers on iOS use Safari's engine but don't expose the same install affordance.

## 11. First test to run (do this with real headphones)

This is the scenario the whole app is built around — test it for real before trusting it day-to-day:

1. Start playing music through Spotify or YouTube Music on your headphones.
2. Open Workout Caller and paste or create a short test workout (2-3 short intervals).
3. Tap **Start Workout**. Confirm your music keeps playing acceptably.
4. Listen for: the exercise announcement, the rest announcement (with "next" exercise), and the countdown beeps near the end of an interval.
5. Confirm each transition happens at the correct time (compare against the on-screen timer).
6. Test **Pause** then **Resume** — confirm the remaining time didn't jump.
7. Test **Skip** and **Previous**.
8. Rotate the iPad/iPhone mid-workout.
9. Lock the screen briefly (or switch apps) and come back — confirm the timer caught up correctly rather than showing a stale number.
10. Let the workout finish naturally.
11. Confirm it now appears in **History**.
12. Confirm it now appears on the **Calendar** (today's date).
13. Open it from History or Recent Workouts and tap **Repeat Now** — confirm it starts immediately with **no AI/network call needed**.

## 12. Testing, linting, building

```bash
npm run test        # Vitest — 100 tests: timer engine, duration math, dates, calendar, schema, AI layer (mocked)
npm run lint         # ESLint
npm run typecheck    # tsc --noEmit (strict mode)
npm run build        # production build
npm run verify       # all four, in order — this is what should be clean before you trust a change
```

The AI test suite (`tests/ai/`) **never calls the real Anthropic API** — `getAnthropicClient` is mocked at the module boundary, so these tests run offline and don't cost anything or need a key.

## 13. Privacy

Workout text is sent to Anthropic only when you actively use an AI feature (pasting a workout to parse, requesting a modification, or typing a natural-language command) — never routinely, and never your full history. Modification requests send only the one already-resolved workout plus your instruction, not your whole library. Natural-language commands send only the phrase you typed; the app resolves what it refers to against your own database afterward, deterministically — Claude never sees your history to do that itself.

## 14. Intentionally deferred from V1

Per the product spec, these were deliberately left out of this version (the schema is left room to add most of them later without a painful migration, but none are implemented now):

- Weights used / reps completed / sets tracking, progressive overload
- Apple Health, Apple Watch, wearable integration
- Push notifications/reminders
- Google Calendar sync, recurring training plans
- Workout statistics/analytics dashboards
- A native iOS/iPadOS wrapper
- Social features, leaderboards, gamification, payments, nutrition/calorie tracking, AI fitness coaching

## 15. Environment notes from this build

- The database-integration test suite described in the original spec (immutability, status transitions, query correctness against a real Postgres instance) needs a real Supabase/Postgres connection, which wasn't available in the sandbox this was built in (no Docker/Supabase CLI). Instead, that logic is covered by the schema/business-logic unit tests, and the actual Supabase query functions in `lib/database/*.ts` are thin, directly-typed wrappers you can exercise against your real project once it's configured. If you want real integration tests later, `supabase start` (Supabase CLI + Docker) gives you a local Postgres instance to point them at.
- Real iPad/Safari/Spotify hardware verification (§11) is something only you can do on your own device — it was verified in this build environment using a desktop browser walkthrough of the full timer/speech/completion/offline flow (all working), but the specific iOS Safari quirks around audio-session mixing and backgrounding need your own hardware.
