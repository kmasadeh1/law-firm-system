# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

@AGENTS.md

## Project state

Law firm management system. Currently a fresh Next.js scaffold — no application
pages, components, or database schema exist yet beyond framework defaults and
the Supabase client setup described below.

## Commands

- `npm run dev` — start the dev server (Turbopack) at http://localhost:3000
- `npm run build` — production build
- `npm run start` — run the production build
- `npm run lint` — ESLint (flat config, `eslint-config-next`)
- `npx tsc --noEmit` — typecheck (no dedicated npm script for this yet)

No test framework is set up yet — there is no test script and no test runner
in `package.json`.

## Environment

Copy `.env.local.example` to `.env.local` and fill in values from the Supabase
dashboard (Project Settings -> API Keys):

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`

`.gitignore` has a `!.env*.example` exception so the template stays tracked
while real `.env*` files stay ignored.

## Architecture

Next.js 16 (App Router) + TypeScript + Tailwind CSS v4 + React 19. Backend is
Supabase via `@supabase/ssr`.

Three separate Supabase entry points exist for three different execution
contexts — using the wrong one breaks auth or throws at runtime:

- `lib/supabase/client.ts` — `createClient()`, for the browser / Client
  Components (`"use client"`).
- `lib/supabase/server.ts` — `createClient()` is **async** (`cookies()` is
  async as of Next.js 15). Always `await` it, and create a fresh instance per
  request in Server Components, Server Actions, and Route Handlers — never
  hoist it to module scope.
- `lib/supabase/proxy.ts` — `updateSession()`, invoked from the root
  `proxy.ts` on every matched request to refresh the auth session and rotate
  cookies.

`proxy.ts` at the repo root is the request-interception entry point, not
`middleware.ts` — Next.js 16 deprecated `middleware.ts`/`middleware()` in
favor of `proxy.ts`/`proxy()`. The unauthenticated-user redirect in
`lib/supabase/proxy.ts` is intentionally commented out until `/login` and
related auth routes exist.

## Non-negotiable rule: no business logic in the frontend

Validation, permission checks, and calculations happen in Supabase — Row
Level Security policies and Postgres functions/triggers. The frontend only
renders data and calls Supabase (including RPCs for anything that needs
server-side logic, like the conflict-check function).

If implementing a task seems to require real logic in a React component —
anything beyond simple display formatting — stop and flag it instead of
writing it into the component. That almost always means a Postgres function,
an RPC call, or an RLS policy is missing, not that the component needs a
`useEffect` full of rules.