# Consensish

A Vue 3 / Nuxt 4 application for asynchronous consensus in groups, collectives, and organizations. Share a decision by URL, optionally protect it with a password, and keep a timeline of what your group decided and why.

Consensish runs independently of ARCHR, with a Node server and local SQLite storage. The current checkout lives at `/Users/archrmac/consensish`.

## Run locally

Use Node 22.13+ with built-in `node:sqlite` (tested with Node 26.13).

```sh
cd consensish
npm ci
npm run dev
```

Open **http://127.0.0.1:9001**. Create a group, save its organizer key, publish a proposal, and share its decision URL. Share any password separately. Participants enter a display name; no account is needed. The group URL opens its decision list and timeline. Keep both the group URL and organizer key somewhere safe: there is no central account directory or email recovery.

Port **9001** is also configured for the local Penpot frontend. Stop whichever app is using the port before starting the other. To run development on another port, use `npm run dev -- --port 9002`.

In an executor that prevents npm from spawning its default shell, use `npm install --ignore-scripts`, then `node node_modules/nuxt/bin/nuxt.mjs dev --host 127.0.0.1 --port 9001`. The same direct command accepts `build`.

## Implemented

- Groups with optional passwords, a searchable decision list, review/past-decision filters, and a chronological activity log.
- Unguessable decision URLs and optional independent decision passwords. A group password protects the group history; a proposal password protects that proposal. A direct unprotected proposal link permits participation independently of group access.
- Organizer key recovery across browsers, separate from participant access. Passwords use salted scrypt; the organizer key is stored as a SHA-256 digest. Cookies are HttpOnly and SameSite=Lax, with Secure on HTTPS.
- Proposal title, description, program, type, setup budget, recurring cost notes, proposer/facilitator, evidence/resources, implementation timeline, and meeting reference.
- Review windows: 7 days through $1,000; 14 days above $1,000 through $5,000; 28 days above $5,000 and for every policy change. Currency is USD in this first version. The window starts at publication, which represents proposal presentation.
- All seven response types: approve, express concern, ask a clarifying question, comment, suggest modification, stand aside, and block. Concerns, blocks, and modifications require a reason; questions and comments require text.
- One current explicit position per browser participant per revision. Updating that position replaces it; comments, questions, and suggestions are separate discussion contributions and preserve the position.
- Suggested modifications retain the proposed replacement title/description and optional deadline extension. The facilitator must confirm proposer consent to accept. Acceptance archives the previous proposal, opens a new revision, and excludes all old responses from current counts. Without an explicit later extension, a full review window begins again. Declining leaves the existing proposal and deadline in place.
- Manual facilitator outcomes after the review deadline: agreed or not agreed, with rationale. Withdrawal is available sooner. Agreement needs at least one explicit approval and no current blocks; there is no majority-vote algorithm or automatic acceptance. Nonresponse is conceptually stand aside, but there is no roster to count silent members.
- Durable SQLite records, revision snapshots, per-decision history, and group activity entries. Group summaries omit proposal bodies and hide protected decision activity details unless the browser has access.
- Basic same-origin mutation checks, bounded inputs, and an IP-based write limit (100 requests per 15 minutes).

## Architecture

The structure follows ARCHR's Nuxt 4 conventions while keeping this app independent:

```text
app/                       Vue application
  pages/                   Landing, /g/:id group, /d/:id decision
  components/              Proposal form and password gate
  assets/css/              Shared visual system and responsive layout
shared/domain.ts           Shared proposal, response, activity types and labels
server/api/[...path].ts    JSON API, cookie access checks, orchestration
server/domain/             Framework-independent consensus rules
server/repositories/       SQLite persistence and transactional activity logging
tests/                     Domain tests and production HTTP integration test
docs/                      Design source and implementation notes
```

SQLite is intentionally isolated behind the repository layer for later replacement with PostgreSQL. There are no Airtable, Make, Softr, or ARCHR dependencies. Schema creation is idempotent at startup. A generic record table stores versioned domain objects as JSON; the activity log is append-only through the application. This is an initial schema, not a full relational model or tamper-proof audit ledger.

## Data and hosting

The default database is `.data/consensish.sqlite`, relative to the process working directory. Override it with `CONSENSISH_DB=/absolute/path/consensish.sqlite`. Keep the database on a persistent local volume and run one Node application instance. Use SQLite's online backup API or a coordinated backup that accounts for WAL files; do not copy only the database file during writes.

```sh
npm run build
npm start
```

`npm start` binds the production server to `127.0.0.1:9001` using macOS/Linux shell syntax. To choose another host or port, launch the build directly: `PORT=9002 HOST=127.0.0.1 node .output/server/index.mjs`.

This is a Node server with a local SQLite file. It is not configured for Cloudflare Workers or ephemeral/serverless filesystem hosting. For public shareable URLs, place the server behind an HTTPS reverse proxy and retain its data volume. Public hosting and DNS have not been configured. The development server binds to loopback by default. The interface uses optional Google Fonts with local sans-serif fallbacks.

## Verification

```sh
npm test
node node_modules/vue-tsc/bin/vue-tsc.js --noEmit -p .nuxt/tsconfig.app.json
node node_modules/typescript/bin/tsc --noEmit -p .nuxt/tsconfig.server.json
npm run build
```

Integration checks use an isolated database and the built production server. In one terminal:

```sh
CONSENSISH_DB=/tmp/consensish-qa.sqlite PORT=9002 HOST=127.0.0.1 node .output/server/index.mjs
```

In another:

```sh
CONSENSISH_TEST_DB=/tmp/consensish-qa.sqlite TEST_BASE_URL=http://127.0.0.1:9002 node tests/integration.mjs
```

`CONSENSISH_TEST_DB` must point to that isolated test database: the test deliberately expires its own test proposal to exercise deadlines and final agreement. Omit it to exercise withdrawal without a database fixture. `TEST_BASE_URL` overrides the server address. Tests cover budget boundaries, cross-year deadlines, required reasons, block semantics, password gates, organizer permissions, key recovery, protected group summaries, response updates, revisions, closure, CSRF, and server-rendered routes. Browser interactions and visual layout have not been tested in an automated browser.

## Boundaries of this first version

Names are self-declared and identity is tied to a browser cookie, not a verified person. A new browser or cleared cookie creates another participant. Organizer keys have full group authority; save them privately. Cookies last 30 days, and there is no revocation/key rotation screen yet. Do not use this identity model for elections or decisions requiring verified membership.

The design doc's automatic three-day cohorts, seven-person matching heuristics, cohort chat, delivery of response reminders, structured meeting agendas, multiple-proposer roles/consent, a member directory, uploaded attachments, budget/expense ledgers, and timebank/community-currency features are not implemented. Current modification requests are linked response records, not separate independently votable proposals. See the [implementation notes](docs/implementation.md) for the design mapping and next decisions.

## Repository hygiene

The `.gitignore` excludes dependencies, Nuxt build output, local environment files, SQLite databases and journals, logs, and editor/OS artifacts. Environment templates such as `.env.example` remain trackable. Commit `package-lock.json` for reproducible installs; runtime records and organizer credentials belong outside Git.

Dependency audit at implementation reported 6 low and 4 moderate transitive advisories, with no high or critical findings. The suggested automatic remedy downgraded Nuxt; it was not applied. Review compatible upstream fixes before public deployment.
