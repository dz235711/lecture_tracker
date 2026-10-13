# Lecture Ledger

A private, account-backed lecture and tutorial tracker. Set term dates, add courses, and enter a weekly schedule once. Every occurrence is generated through the inclusive term end date.

## Courses and resources

Each course stores a name, numeric Scientia course number, Imperial Panopto folder ID, and colour. Sessions reference their course rather than duplicating resource metadata. Course colours and resource edits apply to all of that course's occurrences.

Course materials use `https://scientia.doc.ic.ac.uk/2627/modules/<course-number>/materials` as requested. Recording links use the shared Panopto folder and the occurrence's date for both `startDate` and `endDate`, formatted as `MM/DD/YYYY` and encoded with quoted values in the URL fragment. The folder field accepts either a raw folder ID or an Imperial Panopto URL.

Weekly sessions have their own titles, weekdays, times, and comma-separated tags such as Tutorial, Lab, or Revision. The overview groups occurrences by course; the course page edits shared links and weekly sessions. Course numbers and location details are not repeated in the lecture view.

## Progress and persistence

A lecture stays Upcoming until its scheduled end time, then becomes Unfinished unless that occurrence is marked Completed. Each occurrence has independent completion and undo. The device clock is read every second and on focus/visibility changes. Timezone-aware recurrence follows daylight-saving changes.

D1 stores each signed-in user's planner, with optimistic revision checks to prevent stale overwrites. Existing version-1 planners are upgraded on read, preserving lecture IDs, recurrence, and completion keys. The new shape is saved on the next successful write. Older open clients are asked to reload before writing. Existing database migrations are unchanged because the planner remains a JSON record in the same table.

Backup export uses version 2. Restore accepts versions 1 and 2 and upgrades old backups before validation. Example mode is held only in memory; preview data is separate from production data.

## Development and verification

Requires Node 22.13 or newer. Use the Sites dependency installer and build helper. `npm run dev` starts the portable preview; `/signin-with-chatgpt?return_to=/` supplies the starter's loopback-only test identity. Hosted authentication is provided by Sites.

- `node scripts/test-model.mjs`: recurrence, status boundary, DST, exact supplied URL templates, dates/year boundaries, shared metadata/colour, folder parsing, tags, validation, and legacy migration with completion preservation. Requires Node with TypeScript stripping (the bundled Node 24 runtime works).
- `node scripts/test-api.mjs`: local authenticated persistence, course/tag edits, invalid input, stale revisions, and old-client write protection. Uses only loopback, creates a temporary test planner, and restores the original local state afterwards.
- `node node_modules/typescript/bin/tsc --noEmit`: type check.
- Sites build helper: deployable Cloudflare Worker and static assets.

Removing a course removes its sessions and their completion history after confirmation. Editing term dates retains completion records. Recording links open the date-filtered Panopto list rather than identifying a particular video; university sign-in and recording availability are handled by Scientia/Panopto. Overnight sessions should be entered as separate same-day sessions.
