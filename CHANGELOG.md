# Changelog

These entries describe the work completed in this conversation. Commits contain the matching source snapshots. The original hosted project ID is removed.

## Unreleased

Make Electron 44.7.1 the default app experience. Open a dedicated window with native menus, keyboard shortcuts, a compact desktop layout and Quit control. Preserve the existing SQLite timetable; choose an available internal port automatically. Closing or quitting respects the renderer's pending-save guard, then closes SQLite and releases the port. Reopening focuses the existing instance; settings can be requested from a second launch. Course resources open in the usual browser; backup export uses a native save dialog.

Bundle the Node backend for Electron, add an isolated preload bridge and renderer restrictions, and refresh desktop/applications shortcuts to launch the app. Correct the earlier right-click guidance: this user's desktop file menu does not expose application actions. Keep browser hosting and its port preferences available through explicit browser commands. Add a native PNG icon from the existing artwork and document source-based startup; distributable installers and auto-updates are outside this change.

Validation: model checks and all nine browser/API/launcher tests passed. The actual Electron renderer passed menu and single-instance navigation, completion/backup export, restart persistence, blocked remote navigation, sandbox/isolation checks, pending-close guard, window/IPC quit and port release with temporary databases/profiles. TypeScript and both builds passed; desktop shortcut validation, shell syntax and Git whitespace checks passed. Desktop content was captured and visually reviewed. Native save/restore dialogs were not visually reviewed; tests directed backup downloads to temporary files.

Add desktop and applications-menu shortcuts that open the app in the background, with Shut down, Configure port and App controls actions. Add `open.sh`, `stop.sh`, graphical controls, status reporting and npm equivalents. Reuse an existing server, serialize simultaneous starts, recover abandoned launch locks, and authenticate shutdown against the current app instance without killing saved PIDs. Keep runtime state private and ignored by Git.

Save a preferred port in local `ledger.config.json`; automatically try the next 20 ports when it is busy. Preserve the one-run `PORT` override with exact-port behaviour. Apply configuration to foreground, background and development startup. Share runtime selection and build preparation, and bound graceful shutdown when a client leaves a request unfinished. Port changes preserve the database location.

Validation: `npm test` passed the model checks and all nine server/launcher tests, including persisted data across restart, port conflict fallback, repeated/concurrent opens, stale state and unrelated-server protection, foreground shutdown/Ctrl+C, invalid configuration, shortcut validation and mocked dialog save/cancel flows. `npm run build` passed TypeScript and the production build. Shell syntax checks and `git diff --check` passed. Installed desktop/applications shortcuts on this computer; native dialogs were not visually reviewed.

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
