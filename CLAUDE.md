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
- `npm run check:messages` — verifies the Arabic message fallback: every
  `en.json` key resolves after the deep merge, every `ar.json` key has an
  `en.json` counterpart (no orphans), and reports the untranslated-key count
  as a progress metric. Run this after every string-extraction batch,
  alongside `tsc` and `build` — it catches a key that renders as a raw path
  or blank string under Arabic, which neither of those two checks does.

No test framework is set up yet — there is no test script and no test runner
in `package.json`.

**Never start, restart, or stop the dev server, and never kill a node
process or anything by port.** The user runs `npm run dev` themselves in
their own terminal on port 3000. On Windows, killing "the process on port
3000" kills that terminal's server too — there's no way to distinguish it
from one Claude Code started. For any task that needs a running app to test
against, assume port 3000 is already up; if it isn't, say so and let the
user start it rather than starting one yourself.

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
  `proxy.ts` for `/login` and `/dashboard/*` requests only, to refresh the
  auth session and rotate cookies.

`proxy.ts` at the repo root is the request-interception entry point, not
`middleware.ts` — Next.js 16 deprecated `middleware.ts`/`middleware()` in
favor of `proxy.ts`/`proxy()`. The unauthenticated-user redirect in
`lib/supabase/proxy.ts` is active: any `/dashboard/*` request without a
signed-in user is redirected to `/login`. `/login` itself stays open, and
the public bilingual site is reachable without signing in at all.

## Investigation history: the "session lost on create" bug (resolved)

Creating a case or appointment was once observed to silently sign the user
out (a genuine `POST /logout` reaching Supabase's Auth API a few seconds
after the create action, confirmed via Supabase auth logs). Two theories
were disproven early: a refresh-token race (no refresh-token requests in the
auth logs, successful or rejected) and the `login()` action's gated
`signOut()` branches (`!staffRow`, `!staffRow.is_active`) — checked directly
via temporary logging on the staff-row query, ruled out across 12
reproduction attempts where the query always returned a valid, active row.

It was finally caught with a stack-trace tracer temporarily attached to
`supabase.auth.signOut` in `lib/supabase/server.ts` (since removed),
reproducing 4/4 via Playwright on client creation under `npm run dev`. The
trace named the caller precisely: the app's own `logout` Server Action
(`app/(staff)/dashboard/actions.ts`), invoked directly — not anything inside
`@supabase/auth-js`. Next's own request log confirmed it: `POST
/dashboard/clients/new` was answered by `└─ ƒ logout()`, not by the create
action.

That pointed at a real bug at first, but it wasn't one. Every dashboard page
renders **two** `<button type="submit">` elements: the page's own submit
button, and the dashboard shell's persistent "Log out" button
(`components/dashboard/shell.tsx`), which sits in the `<aside>` sidebar
*before* `<main>{children}</main>` in DOM order. **`page.click('button[type="submit"]')`
is ambiguous on every single dashboard page** and resolves to the first
match — the sidebar's Log out button, not the page's own submit button. It
does not throw the way a strict `locator().click()` would.

Proof this was the whole story: the compiled Turbopack client bundle wired
`createClientRecord`/`createCase`/`createAppointment` each to their own
correct, distinct Server Action ID (verified against
`.next/dev/server/app/.../server-reference-manifest.json` for each route —
none of them collided with `logout`'s ID). Re-running all three creation
flows with a properly scoped selector (`page.locator('main button[type="submit"]').click()`)
sent the correct action ID every time and completed cleanly — new record
created, still signed in, no `/logout` call. The historical diagnostic
script that first isolated this bug's timing (`test-f-timing.js` in the
investigation's scratchpad) contains the exact same
`page.click('button[type="submit"]')` pattern on `/dashboard/cases/new`, so
the original discovery and later reproduction attempts are consistent with
the same artifact throughout. A manual click-through in the browser
afterward confirmed client creation is clean, closing this out.

**Not explained:** an earlier session ran 12 reproduction attempts that came
back clean (no sign-out) while testing the `login()` branches — if that
script used the same ambiguous selector, all 12 should have failed the same
way. It apparently didn't, for reasons not established (probably a
differently-written script). Recorded here rather than smoothed over.

**Takeaway for future Playwright work against this app's dashboard:** always
scope submit-button selectors to the page content (e.g. `main button[type="submit"]`,
or a `data-testid`) rather than a bare `button[type="submit"]` selector —
every dashboard page has the shell's Log out button as a second match.

**This happened again.** During the notes/documents soft-delete work, a
verification script used `getByRole('button', { name: 'Remove', exact: true })`
scoped only to `main` on the case detail page - "Remove" is also the label on
the Team section's remove-member button, which sits earlier in the DOM than
Documents. The click landed on Team instead and deleted a real case-lawyer
assignment (caught via the timeline, recovered from the activity log's
`old_data`, since it's an append-only audit table - see the case-timeline
section above). Writing "remember to scope selectors" a second time into
this file wouldn't fix anything; a rule that has to be recalled at the
moment of writing every selector isn't a control. Instead: every section
Panel on the case detail page (`app/(staff)/dashboard/cases/[id]/*.tsx`) now
carries a `data-testid` (`case-status-section`, `case-team-section`,
`case-opposing-parties-section`, `case-deadlines-section`,
`case-share-links-section`, `case-documents-section`, `case-notes-section`,
`case-timeline-section`). Scope future Playwright work on this page to one
of these first, e.g. `page.getByTestId('case-documents-section').getByRole('button', { name: 'Remove' })`,
rather than `main` plus a label that isn't guaranteed unique across sections.

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