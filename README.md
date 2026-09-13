# law-firm-system

Next.js (App Router) + TypeScript + Tailwind CSS, with Supabase as the backend.

## Getting started

1. Install dependencies:

   ```bash
   npm install
   ```

2. Copy the env template and fill in your Supabase project values
   (Supabase Dashboard -> Project Settings -> API Keys):

   ```bash
   cp .env.local.example .env.local
   ```

3. Run the dev server:

   ```bash
   npm run dev
   ```

   Open [http://localhost:3000](http://localhost:3000).

## Supabase setup

| File | Purpose |
| --- | --- |
| `lib/supabase/client.ts` | `createClient()` for Client Components (`"use client"`). |
| `lib/supabase/server.ts` | `await createClient()` for Server Components, Server Actions and Route Handlers. |
| `lib/supabase/proxy.ts` | `updateSession()` - refreshes the auth session and rotates cookies. |
| `proxy.ts` | Root Proxy entry point that calls `updateSession()` on every matched request. |

Notes:

- `createClient()` in `server.ts` is **async** (`cookies()` is async as of Next.js 15).
  Always call it as `const supabase = await createClient()`.
- Create the server client per request. Never hoist it into a module-level or
  global variable.
- `proxy.ts` is the Next.js 16 replacement for `middleware.ts`, which is deprecated.
- The Proxy currently only refreshes the session. The redirect that sends
  unauthenticated users to `/login` is commented out in `lib/supabase/proxy.ts`
  and should be enabled once auth pages exist.
