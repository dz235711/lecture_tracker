# Lecture Ledger

A private, account-backed lecture tracker. Enter term dates and a single weekly timetable; every occurrence is generated through the inclusive term end date.

- Upcoming until the scheduled end time, then unfinished unless marked complete.
- Each occurrence has independent completion and undo.
- Weekly and full-term views, status filters, course search, and a catch-up view.
- Weekly schedule editing, timezone-aware recurrence, and daylight-saving support.
- Persistent D1 storage scoped to the signed-in ChatGPT user, with optimistic revision checks to prevent stale overwrites.
- JSON backup export and validated restore.
- Responsive layout, keyboard-accessible dialogs, and status announcements.

## Development

Requires Node 22.13 or newer. Use the Sites dependency installer, then generate the Drizzle migration and apply it to the local D1 database as described in the Sites starter documentation. The existing migration is `drizzle/0000_exotic_hobgoblin.sql`.

Run `npm run dev`, then visit `/signin-with-chatgpt?return_to=/` for the starter's loopback-only test identity. Production authentication is provided by Sites. Local preview data is separate from production data; example mode is held only in memory.

## Verification

`node scripts/test-model.mjs` checks weekly recurrence, term bounds, individual completion, the clock boundary, timezones, DST, all weekdays, and validation. This requires a Node version that supports TypeScript stripping (the supplied Node 24 runtime works).

`node node_modules/typescript/bin/tsc --noEmit` checks types. Build with the Sites build helper.

`scripts/test-api.mjs` is an integration check against the loopback preview. It expects the named local test timetable created during UI verification, tests authentication, origin and input validation, persistence, and revision conflicts, and does not contact production.

Schedule edits update the repeating lecture; removing a lecture removes its occurrences and history. Term date edits retain completion records. The clock and term timezone determine status, including after reopening the app. Overnight lectures should be entered as separate same-day sessions.
