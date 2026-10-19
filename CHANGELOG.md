# Changelog

These entries describe the work completed in this conversation. Commits contain the matching source snapshots. The original hosted project ID is removed.

## Unreleased

**19 October 2026 — simplify navigation:** remove the redundant Catch up sidebar tab and native menu/keyboard action, along with its unused navigation bridge route. Overview continues to open on full-term unfinished sessions. Update existing native navigation checks and setup documentation.

Validation: TypeScript/frontend/backend build and the full real-Electron suite passed using temporary databases/profiles, including absent sidebar/native menu items, seven-session startup/reload/reopen, native/sidebar Overview navigation, completion/backup, normal desktop-service launch and shutdown. Git whitespace checks passed; the personal timetable/profile were not used or changed.

**19 October 2026 — due sessions on Overview:** open on Unfinished across the full term, matching Catch up immediately instead of showing the current week's upcoming timetable. Use the same view for sidebar/native Overview navigation and example entry/exit; retain explicit Week, Upcoming, To do, All sessions and Completed browsing. Add a deterministic first-render/reopen/reload regression with seven past unfinished sessions, four information-theory entries, one remaining Quantum tutorial and five saved completions, alongside six upcoming slots in the current week. Saved completion records remain unchanged when browsing.

Validation: model checks and all eleven API/browser/launcher tests passed; TypeScript/frontend/backend build passed. The full real-Electron suite passed save/reopen, taskbar launching through the normal desktop-service context, and the new seven-session case on first render, reload and reopen. Checked exact course counts/dates, saved Quantum completion, native/sidebar navigation, Catch up parity, separate week browsing, unchanged saved data and shutdown/port release. Visually reviewed the captured synthetic overview and checked Git whitespace. Early test-harness initialization failures were repaired and are not counted as passes. The real timetable/profile were not used for QA or changed.

**Earlier filtering work (14 October):** added To do, combining unfinished and upcoming sessions and excluding completed ones immediately, plus explicit All sessions and Completed views. Its initial To do/week default is superseded by the due-session overview above. Added real renderer checks for fresh/reopened startup, completion disappearing, undo, counts and Catch up.

Fix Ubuntu taskbar launch setup with an exact-executable AppArmor user-namespace permission installed through a one-time administrator prompt. Keep Chromium's sandbox enabled and leave global security settings intact. Align the desktop entry's StartupWMClass with the app identity, launch Electron using the project manifest, and wait for native startup acknowledgement so fatal launch errors are reported. Test the desktop ID from a temporary applications directory and provide a normal desktop-service test mode to expose AppArmor differences hidden by development-tool profiles.

Validation: model checks, all eleven API/browser/launcher/profile tests, TypeScript/frontend/backend build and actual Electron fresh/reopen/desktop-ID checks passed with temporary databases/profiles. Checks cover default filtering, completion/undo, counts, exact profile paths, policy-character rejection and startup failure reporting, including existing Unicode log content. Installed shortcut files pass desktop-file validation; shell syntax and Git whitespace checks pass. After administrator authentication, installed and verified the root-owned exact-executable AppArmor permission. The normal desktop-service launch test passed using that permission, including renderer OS sandbox enforcement and clean shutdown; the system-wide user-namespace restriction remains enabled and the Electron sandbox helper remains unprivileged. The personal timetable/profile were not used for QA or changed.

Rename the product to Lecture Tracker across the interface, document/window titles, native menus/dialogs, startup messages, package metadata and new backup filenames. Install renamed desktop/applications shortcuts and remove old Lecture Ledger shortcuts only when they belong to this checkout. Preserve the database/profile/settings paths, private control identities and backup format so existing data, preferences and backups continue to work. Ignore both old and new conventional backup filenames in Git.

Validation: model checks and all nine API/browser-launcher tests passed, including replacement of an owned old shortcut and preservation of another checkout's shortcut. Actual Electron save/reopen/source-launcher checks and build preparation passed using temporary data. Installed and validated the renamed executable shortcuts; checked Git whitespace. The real database and profile were not used for QA or migrated.

Remove the session-name field and identify sessions by their course and tags throughout the overview, course editor, next-session card, search and accessible controls. Show Lecture for untagged sessions and add it as a tag suggestion. New sessions omit titles; retain older titles as hidden compatibility metadata without changing IDs, schedules or completion history. Sort simultaneous occurrences by course/tags/ID instead of requiring a title.

Validation: model checks and all nine API/browser-launcher tests passed with temporary data, including sessions without titles, old-name compatibility, tag edits preserving completion keys and simultaneous sessions. TypeScript/frontend/backend build passed. Actual Electron checks passed editing an older session without a name field, creating a title-free session, completion/backup export, restart persistence and shutdown. Reviewed the captured tag-based layout and checked Git whitespace. The real database was not modified for QA.

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
