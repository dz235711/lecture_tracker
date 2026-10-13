# Lecture Ledger

A lecture and tutorial tracker that runs on your computer. Enter a term and one week's schedule; sessions repeat through the inclusive term end date. Your timetable and completion history live in a local SQLite file.

## Start the app

On this Linux computer, open a terminal in this folder and run:

```sh
./start.sh
```

Then open **http://127.0.0.1:3000/**. Keep the terminal running while using the app; press Ctrl+C to stop it. Run the same command whenever you want to open it again. The script installs dependencies and builds the app on the first run, and rebuilds after source changes. The first installation needs an internet connection. Later starts work offline with the installed dependencies.

The script uses Node.js 24.15 or newer from your PATH, or the Node runtime already bundled on this computer. On another computer, install Node.js 24.15 or newer, clone the repository, and run:

```sh
npm ci
npm start
```

Both commands work on Windows, macOS, and Linux with a suitable Node installation. On Linux/macOS, `./start.sh` is also available. If port 3000 is already occupied, use `PORT=3001 ./start.sh` in a Linux/macOS terminal. `LEDGER_NODE_BIN` can point the startup script to a particular Node executable.

## Your data

The default file is `data/lecture-ledger.sqlite`, relative to this repository. SQLite may also create `-wal` and `-shm` files beside it while the app runs. Closing the browser or stopping and restarting the app keeps your data. All browsers on this computer that use the same running app see the same timetable.

The app listens only on `127.0.0.1`. It uses no account login or cloud database. Once installed, the tracker runs entirely on your computer. Opening course materials or recordings still connects to the university websites and may require university sign-in.

The data directory, backups, installed dependencies, and generated build are excluded from Git. Git stores the source and its history; it does not back up your timetable. Export a JSON backup from **Term & settings → Export backup** and keep a copy somewhere safe. Restore it with **Restore backup**. Backups from the earlier hosted tracker are accepted, including its older format; completion records are preserved.

For a database outside the repository, set `LEDGER_DB_PATH` to an absolute filename before starting. For example, on Linux/macOS:

```sh
LEDGER_DB_PATH=/path/to/private-folder/lecture-ledger.sqlite ./start.sh
```

To transfer backups without opening the browser, with Node.js 24.15 or newer:

```sh
npm run export -- /path/to/lecture-ledger-backup.json
npm run import -- /path/to/lecture-ledger-backup.json
```

Export refuses to overwrite an existing file. Import refuses to replace an existing timetable unless you add `--replace`. Export a backup before replacing your timetable. To move the raw database instead, stop the app first and copy the database together with any remaining SQLite sidecar files.

## Courses and resources

Each course stores a name, numeric Scientia course number, Imperial Panopto folder ID, and colour. Sessions reference their course rather than duplicating resource metadata. Course colours and resource edits apply to all of that course's occurrences.

Course materials use `https://scientia.doc.ic.ac.uk/2627/modules/<course-number>/materials` as requested. Recording links use the shared Panopto folder and the occurrence's date for both `startDate` and `endDate`, formatted as `MM/DD/YYYY` and encoded with quoted values in the URL fragment. The folder field accepts either a raw folder ID or an Imperial Panopto URL.

Weekly sessions have their own titles, weekdays, times, and comma-separated tags such as Tutorial, Lab, or Revision. The overview groups occurrences by course; the course page edits shared links and weekly sessions. Course numbers and location details are not repeated in the lecture view.

## Progress and persistence

A lecture stays Upcoming until its scheduled end time, then becomes Unfinished unless that occurrence is marked Completed. Each occurrence has independent completion and undo. The device clock is read every second and on focus/visibility changes. Timezone-aware recurrence follows daylight-saving changes.

SQLite stores the planner, with revision checks to prevent stale overwrites from another browser tab. Existing version-1 planners are upgraded on read, preserving lecture IDs, recurrence, and completion keys. The new shape is saved on the next successful write. Older open clients are asked to reload before writing.

Backup export uses version 2. Restore accepts versions 1 and 2 and upgrades old backups before validation. Example mode is held only in memory and does not change your saved timetable. Reopening after a break recalculates statuses from the device's current time.

## Development and verification

With Node.js 24.15 or newer:

```sh
npm ci
npm run dev
npm test
npm run build
```

Development serves the app and API together on port 3000, with live updates while editing. It uses the same database by default; set `LEDGER_DB_PATH` to a different file for development with separate data. `npm start` serves the built app and automatically rebuilds when needed.

- `npm test`: recurrence, end-time status transitions, DST, completion, supplied resource URL patterns, shared metadata, tags, old backup migration, local persistence across restarts, conflicting writes, rejected cross-origin writes, and private-file access. Server tests use temporary databases and leave your timetable alone.
- `npm run build`: TypeScript check and production frontend build.

Removing a course removes its sessions and their completion history after confirmation. Editing term dates retains completion records. Recording links open the date-filtered Panopto list rather than identifying a particular video; university sign-in and recording availability are handled by Scientia/Panopto. Overnight sessions should be entered as separate same-day sessions.

## Git history and GitHub

This folder is already a Git repository on branch `main`, with descriptive commits, matching entries in [CHANGELOG.md](CHANGELOG.md), and tags:

- `v0.1.0`: initial recurring lecture tracker.
- `v0.2.0`: course grouping, shared links, colours, and session tags.
- `v1.0.0`: standalone local app with SQLite storage.

The first two commits preserve the earlier hosted source milestones. The current version runs locally. Each commit message includes a changelog of that milestone's changes and validation.

To attach an empty GitHub repository you create:

```sh
git remote add origin <your-repository-url>
git push -u origin main
git push origin --tags
```

The current checkout is connected to `git@github.com:dz235711/lecture_tracker.git`. The commands above are for attaching a fresh copy; do not add an existing remote again. If a destination repository already contains commits, merge its history deliberately instead of force-pushing. The original handoff included a verified `lecture-ledger-local.bundle` containing the three implementation milestones and tags; later changes are recorded in this repository.

## Context for new chats

The root `.codex` file is a Markdown summary of the requirements, implementation, architecture, Git history, validation and current context. Pass it to new chats. `AGENTS.md` instructs coding agents to read it first and always keep it up to date after codebase updates.
