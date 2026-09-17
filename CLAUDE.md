# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

@AGENTS.md

## Project state

Law firm management system. Phase 1 and beyond are built and styled:

- Public bilingual site at `/en` and `/ar` (`app/[locale]/`) — next-intl,
  RTL/LTR via the `dir` attribute, locale-prefixed URLs (`ar` is default,
  both locales always prefixed).
- Login, logout, and route protection for the staff area (`app/(staff)/`,
  `lib/supabase/proxy.ts`).
- Owner-only roles and permissions admin (`dashboard/owner/roles`).
- Clients, including two-way conflict checks — the `check_conflict` RPC
  checks both the client list and recorded opposing parties.
- Cases, with co-counsel (`case_lawyers`), opposing parties, and
  lead-lawyer-only closing.
- Appointments and court dates.
- Fees and payments — engagements, instalments, payments
  (`dashboard/fees`).
- Deadlines, with an owner-only period-types admin screen
  (`dashboard/owner/deadline-period-types`).
- Dashboard shell with the visual identity pass and light/dark theming
  (`components/dashboard/`).
- A Supabase schema of 23 tables with RLS enabled on all of them, plus 4
  views.

Two conventions worth knowing, since both have caused real bugs when
violated:

- Permission-gated routes live outside `/dashboard/owner|staff` and check
  their permission explicitly server-side, e.g. `/dashboard/clients` calls
  `has_permission('clients_manage')`. Never use "the query came back empty"
  as a proxy for "no access."
- Case statuses and roles are firm-defined rows in the database, not
  hardcoded lists. Read them from `case_statuses` (ordered by
  `sort_order`) and `roles`.

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
`lib/supabase/proxy.ts` is active: any `/dashboard/*` request without a
signed-in user is redirected to `/login`. `/login` itself stays open, and
the public bilingual site is reachable without signing in at all.

## Armed diagnostic: signOut tracer in lib/supabase/server.ts

`lib/supabase/server.ts` wraps `supabase.auth.signOut` in a dev-only
(`NODE_ENV !== 'production'`) tracer that logs a timestamp and full stack
trace on every call, then forwards to the real implementation unchanged —
pure observation, no behavior change, no-op in production.

This is intentional instrumentation for an open bug, not stray debug code:
creating a case or appointment has been observed to silently sign the user
out (a genuine `POST /logout` reaches Supabase's Auth API a few seconds
after the create action, confirmed via Supabase auth logs). The original
refresh-token-race theory was disproven — there are no refresh-token
requests in the auth logs, successful or rejected. The `login()` action's
gated `signOut()` branches (`!staffRow`, `!staffRow.is_active`) were also
checked directly (temporary logging on the staff-row query) and ruled out:
across 12 reproduction attempts the query always returned a valid, active
row and neither branch fired. As of this writing the bug has stopped
reproducing on demand, so this tracer is left armed to catch the real call
site (with stack trace) whenever it next recurs, rather than continuing an
open-ended reproduction chase.

**Do not remove this as unrelated cleanup.** Remove it once the bug above
is diagnosed (via a captured trace) and fixed.

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