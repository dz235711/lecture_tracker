# Lecture Ledger

A lecture and tutorial tracker that runs on your computer. Enter a term and one week's schedule; sessions repeat through the inclusive term end date. Your timetable and completion history live in a local SQLite file.

## Start the app

On this Linux computer, double-click the **Lecture Ledger** desktop shortcut. It starts the app in the background and opens your browser. You can close the terminal and browser without losing your timetable. Right-click the shortcut for **Shut down**, **Configure port**, or **App controls**. If the desktop asks, choose **Allow Launching** once.

To install the shortcut after cloning or moving this folder, run:

```sh
./app.sh install-shortcut
```

This adds the shortcut to your desktop and applications menu. Desktop controls use `zenity`, which is already available on this computer. You can also run `./app.sh` to choose **Open app**, **Shut down**, or **Configure port** from a small window.

Terminal controls work from this folder:

```sh
./open.sh          # Start in the background and open your browser
./stop.sh          # Shut down the app
./app.sh status   # Show whether it is running and its address
```

Opening again reuses the app that is already running. Shutdown waits for requests to finish, closes SQLite, and releases the port. It only controls the app launched from this checkout; it does not stop unrelated programs or the historical copy. Closing a browser tab alone keeps the server running.

Startup installs dependencies and builds the app on the first run, and rebuilds after source changes. First installation needs an internet connection; later starts work offline with installed dependencies. Logs and private control state are in the ignored `.ledger/` folder; check `.ledger/server.log` if background startup fails. For a server running visibly in a terminal, use `./start.sh` and press Ctrl+C to stop it. `./stop.sh` also stops a server started that way.

The script uses Node.js 24.15 or newer from your PATH, or the Node runtime already bundled on this computer. On another computer, install Node.js 24.15 or newer, clone the repository, and run:

```sh
npm ci
npm run open
npm run stop
```

These commands work on Windows, macOS, and Linux with a suitable Node installation. `npm start` remains available for foreground startup. The shell scripts are available on Linux/macOS; desktop shortcuts and dialogs are Linux-specific. `LEDGER_NODE_BIN` can select a particular Node executable for the shell scripts.

## Port configuration

The preferred port is **3000**. If it is occupied, the app tries the next 20 ports and opens the address it actually uses. **Configure port** in the desktop controls saves your preference for future starts. The equivalent terminal command is:

```sh
./app.sh port 3001
```

The preference is saved locally in the ignored `ledger.config.json`. You can edit it directly; [ledger.config.example.json](ledger.config.example.json) shows the format. Ports must be whole numbers between 1 and 65535. Changing the preference takes effect after shutting down and opening the app again. Your database location stays the same when the port changes.

`PORT=3001 ./open.sh` overrides the preference for one run and requires that exact port; it does not fall back or save a new preference. `npm run port -- 3001` saves a preference when using npm. `./app.sh status` shows the running address, including an automatically selected port.

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

Development serves the app and API together, with live updates while editing. It reads the same preferred port and uses the same database by default; set `LEDGER_DB_PATH` to a different file for development with separate data. Stop a development server with Ctrl+C; desktop controls manage production startup. `npm start` serves the built app and automatically rebuilds when needed.

- `npm test`: recurrence, end-time status transitions, DST, completion, supplied resource URL patterns, shared metadata, tags, old backup migration, local persistence across restarts, conflicting writes, rejected cross-origin writes, and private-file access. Launcher checks cover background/foreground startup, repeated and concurrent opens, shutdown, occupied ports, saved port preferences, invalid configuration, stale state, shortcut validity, dialog save/cancel flows, and persistence. Server and launcher tests use temporary databases and leave your timetable alone.
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
