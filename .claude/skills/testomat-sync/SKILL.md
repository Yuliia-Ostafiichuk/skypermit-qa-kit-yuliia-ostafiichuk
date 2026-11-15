---
name: testomat-sync
description: Синхронізує кейси з test-cases/ у Testomat.io — upsert без дублів, створення рану, запис результатів. Спільний для story-to-tests і story-to-api-tests. НЕ для написання чи перевірки кейсів.
---

# Testomat sync

The one place where this kit talks to Testomat.io. Both orchestrators (UI and API) call it; nothing else should create suites, tests or runs in Testomat.

`$ARGUMENTS` starts with a command:

| Command | Arguments | Returns |
|---|---|---|
| `upsert` | `<suite title> <issue key> <case files...>` | suite id + one test id per case |
| `run` | `<run title> <test ids...>` | `run_id` |
| `report` | `<run_id> <results>` | per-test outcome, run closed |

Unknown command or missing arguments → say what is missing in one line and stop.

## Ground rules

- **Testomat only.** Tools: `mcp__testomatio__suites`, `mcp__testomatio__tests`, `mcp__testomatio__runs`, `mcp__testomatio__testruns` (CLI-style: pass `command`). Read case files with `Read`. Never write to `test-cases/`, Jira, Confluence or `../skypermit`.
- **Never delete** suites, tests, runs or testruns. Duplicates you find are reported, not removed.
- **No duplicates.** A case is matched by its ID, never created twice. See `upsert`.
- **No invented results.** `report` writes only the statuses it was given.
- Finish every command with one fenced `json` block (shapes below), plus a short line per warning in the user's language.

## upsert

1. **Read the cases.** For each file: `case_id` = the `**ID:**` value (fallback: file name without `.md`); `title` = the `# ` heading text, which already reads `<case_id>: …`; `description` = everything after the heading line. A file without an ID or a heading → skip it with a warning.
2. **Find or create the suite.** `suites list` with `search_text: <suite title>`, then keep only exact, case-sensitive title matches.
   - One → use it.
   - None → `suites create` with `title`, `file_type: "file"`.
   - Several → stop and list them; don't guess.
3. **Find or create each test.** `tests list` with `tql: "test % '<case_id>:'"`, then keep only tests whose `title` starts with exactly `<case_id>: ` (so `TC-UI-01` never matches `TC-UI-013`). `list` returns `title` with the tags appended (`… @SKY-1 @ui`); strip them before comparing it with the file.
   - One → reuse its id (`action: "reused"`). Don't change its title, description, tags or suite. If it lives in another suite or its title/description differs from the file, add a warning.
   - None → `tests create` with `suite_id`, `title`, `description`, `state: "manual"` and `link: [{"action":"add","type":"tag","value":"<issue key>"}]` (`action: "created"`).
   - Several → reuse the oldest (`created_at`), warn and list the other ids as duplicates.

```json
{
  "suite_id": "6c2c7128",
  "suite_action": "reused",
  "tests": [
    {"case_id": "TC-UI-003", "test_id": "a8156e75", "action": "reused"},
    {"case_id": "TC-UI-014", "test_id": "…", "action": "created"}
  ],
  "warnings": []
}
```

## run

`runs create` with `title`, `kind: "manual"`, `test_ids`. Don't look for or reuse a run with the same title: every call is a new run. Testomat launches it immediately, so it starts as `running`.

```json
{"run_id": "efe3c242", "url": "https://app.testomat.io/projects/…/runs/efe3c242", "tests_count": 10}
```

## report

`<results>` is a JSON array (inline, or a path to a `.json` file):

```json
[
  {"test_id": "a8156e75", "status": "failed", "message": "TIME_WINDOW shows ZC-2026.1 §3 instead of A-7 §1"},
  {"case_id": "TC-UI-004", "status": "passed"}
]
```

- Each item has `test_id` or `case_id`, and `status` = `passed` | `failed` | `skipped`. A `failed` item without `message` → write it anyway and warn; the failure reason belongs in the defect, not here.
- `case_id` → resolve to the test in this run by title prefix `<case_id>: ` (`testruns list` with `run_id`). Not in the run → warn, skip it.
1. `testruns list` with `run_id` → map `test_id` → existing testrun.
2. For each result: existing testrun → `testruns update` (`testrun_id`, `run_id`, `status`, `message`); none → `testruns create` (`run_id`, `test_id`, `status`, `message`).
3. Close the run: `runs update` with `run_id`, `status_event: "finish_manual"` (`"finish"` if the run is not manual). Tests in the run that got no result stay `pending`; list them as a warning.

```json
{
  "run_id": "efe3c242",
  "written": [{"test_id": "a8156e75", "status": "failed"}],
  "pending": ["2ae9f681"],
  "closed": true,
  "counts": {"passed": 0, "failed": 1, "skipped": 0, "pending": 1},
  "warnings": []
}
```
