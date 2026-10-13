# Lecture Ledger

A lecture and tutorial tracker that runs on your computer. Enter a term and one week's schedule; sessions repeat through the inclusive term end date. Your timetable and completion history live in a local SQLite file.

## Open the desktop app

Double-click **Lecture Ledger** on your desktop or in your applications menu. It opens in its own Electron window. Close the window, use the sidebar **Quit app** button, or choose **File → Quit Lecture Ledger** to shut it down. Opening it again focuses the existing window.

Desktop mode keeps your existing timetable at `data/lecture-ledger.sqlite` in this checkout. It automatically selects an available internal port; there is no browser address or port setting to manage. Materials and recordings open in your usual browser so university sign-in works normally.

The window has a compact app layout and native File, Edit, View and Help menus. **Ctrl+1/2/3** opens Overview, Courses & lectures and Catch up; **Ctrl+,** opens Term & settings; **Ctrl+Q** quits. Backup export uses a native Save dialog, and restore uses a file chooser. Current saves finish before the database closes.

From this folder, `./open.sh`, `./start.sh` or `npm start` opens the desktop app; `./stop.sh` or `npm run stop` quits it. The shell scripts select Node.js 24.15 or newer from PATH or the runtime bundled on this computer. `LEDGER_NODE_BIN` can select a particular Node executable.

To install or refresh the Linux shortcut after cloning or moving the folder:

```sh
./app.sh install-shortcut
```

If your desktop asks, choose **Allow Launching** once. Some desktop file menus do not show application actions; closing the app or its File menu provides the controls directly.

Startup installs missing dependencies and builds changed sources. The first setup downloads Electron and needs internet; subsequent starts work offline. Electron includes its own Node/Chromium runtime, while Node.js 24.15+ is used to prepare the source build. Background startup logs are in `.ledger/desktop.log`.

On another computer with Node.js 24.15 or newer:

```sh
npm ci
npm start
```

Electron supports Linux, macOS and Windows. The supplied desktop shortcuts are Linux-specific. This checkout launches from source; no distributable installer or automatic updater is included.

## Optional browser mode and ports

Browser hosting remains available for development or when preferred:

```sh
npm run browser         # Foreground server; Ctrl+C stops it
npm run browser:open    # Background server and default browser
npm run browser:stop    # Stop the browser server
./app.sh status         # Browser server status/address
./app.sh port 3001      # Save its preferred port
```

Browser mode defaults to port 3000 and tries the next 20 ports if it is busy. The local preference is saved in ignored `ledger.config.json`; [ledger.config.example.json](ledger.config.example.json) shows the format. Ports must be whole numbers between 1 and 65535. A preference change takes effect at the next browser-server start. `PORT` overrides it for one run and requires that exact port. These settings do not affect desktop mode.

`./app.sh` with no arguments also opens the desktop app. The old `./app.sh menu` graphical menu controls optional browser hosting. Use the desktop window's own menus for normal app use. Browser runtime state/logs stay in `.ledger/`; no unrelated program is stopped. Desktop and browser modes use the same database by default, with revision checks preventing stale overwrites.

## Your data

The default file is `data/lecture-ledger.sqlite`, relative to this repository. SQLite may also create `-wal` and `-shm` files beside it while the app runs. Closing the desktop app or browser and reopening it keeps your data. All browsers on this computer that use the same running app see the same timetable.

The app listens only on `127.0.0.1`. It uses no account login or cloud database. Once installed, the tracker runs entirely on your computer. Opening course materials or recordings still connects to the university websites and may require university sign-in.

The data directory, backups, installed dependencies, and generated build are excluded from Git. Git stores the source and its history; it does not back up your timetable. Export a JSON backup from **Term & settings → Export backup** and keep a copy somewhere safe. Restore it with **Restore backup**. Backups from the earlier hosted tracker are accepted, including its older format; completion records are preserved.

For a database outside the repository, set `LEDGER_DB_PATH` to an absolute filename before starting. For example, on Linux/macOS:

```sh
LEDGER_DB_PATH=/path/to/private-folder/lecture-ledger.sqlite ./open.sh
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

Weekly sessions need only a course, weekday, start/end times and comma-separated tags such as Tutorial, Lab or Revision. There is no separate session-name field: the course and tags identify each session, with Lecture shown when tags are blank. Search uses course names and tags. The overview groups occurrences by course; the course page edits shared links and weekly sessions. Course numbers and location details are not repeated in the lecture view.

Older saved session names remain as hidden compatibility metadata in existing records/backups. New sessions do not store a name. Editing tags keeps the session ID and every week's completion history; existing version-1 and version-2 backups remain accepted.

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
npm run test:desktop
```

Browser development serves the app and API together with live frontend updates. It reads the browser port preference and uses the same database by default; set `LEDGER_DB_PATH` to a separate file for development. Stop a development server with Ctrl+C. `npm start` rebuilds changed sources and opens the desktop app.

- `npm test`: recurrence, end-time status transitions, DST, completion, supplied resource URL patterns, shared metadata, tags, old backup migration, local persistence across restarts, conflicting writes, rejected cross-origin writes, and private-file access. Launcher checks cover background/foreground startup, repeated and concurrent opens, shutdown, occupied ports, saved port preferences, invalid configuration, stale state, shortcut validity, dialog save/cancel flows, and persistence. Server and launcher tests use temporary databases and leave your timetable alone.
- `npm run build`: TypeScript check, production frontend and bundled Node backend for Electron.
- `npm run test:desktop`: actual Electron renderer/menu/completion/persistence/shutdown checks with a temporary database/profile, plus navigation/link-policy checks. Requires a graphical Linux session (or an appropriate test display).

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
