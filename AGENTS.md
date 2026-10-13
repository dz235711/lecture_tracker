# Project instructions

Read the root `.codex` Markdown file before working on this project. It contains the user requirements, architecture, history, validation and current handoff context.

**Always update `.codex` after updates to the codebase and before finishing the task.** This includes implementation, configuration, dependencies, tests, schemas and project documentation. Refresh affected sections, remove stale claims, and add a concise Recent work entry describing changes, decisions, actual checks and remaining work. Include the `.codex` update in the same commit when committing a change. Never claim checks passed unless they were run.

Keep `README.md` current when setup or behaviour changes. Maintain `CHANGELOG.md` and descriptive commit messages documenting changes and validation, as requested by the user.

Protect the user's timetable: do not overwrite/reset the real SQLite database for testing or commit personal data, backups or credentials. Use temporary databases for tests and a separate `LEDGER_DB_PATH` for development that changes data. Work in the active repository rather than the historical copy under Documents/Codex.
