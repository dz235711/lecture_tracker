# Changelog

These entries describe the work completed in this conversation. Commits contain the matching source snapshots. The original hosted project ID is removed.

## Unreleased

Add the `.codex` Markdown project handoff and `AGENTS.md` instructions requiring context updates after codebase changes. Record the active Desktop checkout and user-configured GitHub remote, and update README context/repository guidance. Runtime behaviour and personal data are unchanged.

Validation: documentation checked against source and Git history; `git diff --check`.

## 1.0.0 — 2026-10-13

Run the tracker entirely on the user's computer with a Vite/React frontend and a Node.js server. Replace hosted authentication and D1 with a local SQLite database; preserve course grouping, resource links, tags, recurrence, and completion behaviour. Bind the server to loopback, validate saves, and reject stale or cross-origin writes. Keep personal data and generated files out of Git.

Add a one-command startup script, automatic initial install/build and rebuild after source changes, JSON backup downloads, command-line import/export, configurable database location and port, and local setup/GitHub instructions. Accept older hosted backups without losing completion records. Preserve the earlier source milestones with descriptive commits and version tags.

Validation: production build and TypeScript check; recurrence, status boundary, timezone/DST, resource URL and migration tests; isolated SQLite/API tests for restart persistence, revision conflicts, origin/host checks, oversized/invalid saves, backup export, and private-file protection; local browser review.

## 0.2.0 — 2026-10-13

Courses share a colour, numeric Scientia course number, and Panopto folder. Generate materials URLs and recording queries for each occurrence date. Add session tags, replace location/course-code fields, and migrate legacy planners/backups while preserving completion keys.

Validation: exact supplied URLs, later-week/year filters, shared metadata and colours, legacy migration, API persistence/conflicts, tutorial editing, and mobile layouts.

## 0.1.0 — 2026-10-13

Initial tracker: weekly recurrence through the inclusive term end, independent completion and undo, Upcoming/Unfinished/Completed views, search, catch-up, timezone/DST handling, account-backed persistence, and JSON backup.

Validation: recurrence/status/timezone tests, persistence after refresh, database/API checks, and responsive UI review.
