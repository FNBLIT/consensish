# Design mapping and open decisions

Source: `Consensish.zip`, especially the seven-page `Consensish Design doc_.pdf`. Original PDFs are preserved in `docs/source/Consensish/`. Extracted design text is alongside this document. The scanned consensus reference and the GUI sketches were not treated as runnable app code.

The archive provides a product brief and research, not an implementation. ARCHR was read only to understand its Nuxt 4 structure (`app/pages`, components, shared types, server API, and server-only infrastructure). No ARCHR credentials or services were copied.

## Product interpretation

The entry point is a persistent group. Within it, each proposal has a standalone capability URL, optionally protected by its own password, following the low-friction link-sharing pattern requested. A password on the group protects its aggregate history. Group members can see proposal titles and status in that history, even when a particular proposal requires its own password; its body, discussion, revisions, and detailed activity require proposal access. The organizer can access all proposals in their group.

Responses distinguish positions (approve, concern, stand aside, block) from discussion (question, comment, modification). This lets someone ask a question without losing their approval or block. There is no majority winner or automatic adoption: a facilitator records the final interpretation of the conversation after the window ends. Expressed concerns can coexist with agreement, but blocks cannot.

The design doc's exact dollar boundaries overlap at $1,000. The implemented interpretation is 0–1,000 inclusive for 7 days, above 1,000 through 5,000 inclusive for 14 days, and above 5,000 for 28 days. Policy changes always use 28 days.

Publication represents presentation at a meeting, so deadlines currently start at publication. The optional meeting field is a reference, not a scheduled meeting entity. Asynchronous questions and concerns remain visible; an organizer records any meeting resolution in the outcome rationale. Automatic meeting reconciliation is absent.

Accepting a modification requires the facilitator to attest to proposer consent. Because this first version has no separate proposer authentication, consent is not independently verified. Previous versions and their responses remain in history; they do not count toward the revised proposal. The browser displays the fresh review state on refresh. No outbound notifications are sent.

## Interface

Copy describes the available actions, review rules, and recorded outcomes directly. The general interface uses neutral grays and system fonts. Response accents follow the source PDF: approval green (#274e13), concerns yellow (#f1c232), clarifying questions purple (#351c75), comments blue (#0000ff), suggested modifications brown (#b45f06), and blocks dark red (#660000). Stand aside stays neutral. Yellow is used behind dark text for readability; labels and symbols identify every response independently of color.

## Next implementation stages

1. **Group membership and roles.** Decide whether to retain anonymous browser participation as a mode, introduce named invite links, or require accounts. Add a roster, proposer roles, multi-proposer consent, participant recovery, key rotation, and explicit revocation. The roster is a prerequisite for meaningful counts of default stand-asides and fair cohort allocation.
2. **Cohorts and scheduled work.** Persist group membership, activity metrics, and the previous five positions per member. Every three days, form groups of approximately seven that mix activity and prior disagreement while avoiding repeat groupings where possible. Define behavior for groups under seven, remainders, inactive members, and restricted proposals. Persist cohort assignments and add scoped cohort discussions. Use a durable scheduler with idempotent jobs rather than browser-triggered regrouping.
3. **Meetings and notifications.** Add meeting agendas, presentation times, pending asynchronous responses to resolve at the next meeting, and an explicit notification channel. Delivery should use a transactional outbox for reminders, revision notices, and deadline events. No integration sends messages today.
4. **Operational hardening.** Add normalized SQL tables/migrations, indexed group queries, pagination beyond the latest 200 activity entries, export/backup/restore tooling, verified audit actors, and tested public HTTPS hosting. Single-node SQLite is a starting point; multiple server instances need shared persistence and rate limiting.
5. **Supporting records.** Add structured programs, recurring costs and expense ledgers, resource attachments, organization roles, and any timebank/community-currency features after defining their relationship to proposals. The supporting research does not specify concrete timebank behavior for this decision platform.

## API outline

| Route | Purpose |
| --- | --- |
| `POST /api/groups` | Create group, issue organizer cookie and return one-time organizer key |
| `GET /api/groups/:id` | Authorized group summary and timeline, or password gate |
| `POST /api/groups/:id/unlock` | Unlock group using its password |
| `POST /api/groups/:id/claim` | Recover organizer access using its key |
| `POST /api/groups/:id/proposals` | Organizer creates a proposal |
| `GET /api/proposals/:id` | Authorized proposal, discussion, versions, and history |
| `POST /api/proposals/:id/unlock` | Unlock individual decision |
| `POST /api/proposals/:id/responses` | Save current position or append discussion |
| `POST /api/proposals/:id/amend` | Organizer accepts/declines a proposed modification |
| `POST /api/proposals/:id/close` | Organizer records final outcome and rationale |
