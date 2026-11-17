---
name: story-to-tests
description: Веде ОДНУ UI-story з Jira до схвалених кейсів у Testomat — jira-intake, story-doc-check і implementation-check зі стопом на звіт, ui-test-case-creator, tc-verifier, гейт схвалення, testomat-sync. НЕ для API-задач.
argument-hint: "<Jira issue key, e.g. SKY-1>"
disable-model-invocation: true
allowed-tools:
  - Skill
  - Agent
  - AskUserQuestion
  - Read
  - Grep
  - Glob
---

# Story → approved UI test cases in Testomat

Take one UI story from Jira (`$ARGUMENTS`) through analysis, case generation and verification to approved test cases and a new run in Testomat.io.

This skill only **orchestrates**. It doesn't read Jira, Confluence or the code itself, and it doesn't write anything itself:
- test case files are written only by `ui-test-case-creator`;
- Testomat is written only by `testomat-sync`.

Talk to the user in their language. Two stops need the user's answer (step 2 and step 4). Never skip them or answer them yourself.

## Ground rules

- Manual test cases only. No automation code (see `CLAUDE.md`).
- `../skypermit`, Jira and Confluence are read-only.
- Never edit a test case to make it pass verification. The verdict decides what happens to it (step 3).
- Nothing reaches Testomat without approval at the gate in step 4.
- If a called skill or agent fails or returns something unreadable, say which step failed and what it returned, and stop. Don't fill in its result yourself.

## 0. Argument

`$ARGUMENTS` empty or not an issue key (`[A-Z][A-Z0-9]+-\d+`) → ask for the key and stop.

## 1. Intake

Invoke `Skill jira-intake <KEY>` and take its JSON (call it *intake*).

- No JSON (issue not found, no access) → relay its message and stop.
- `check_type` is not `"ui"`:
  - `"api"` → say: «<KEY> — API-задача (check_type = api). Запусти `/story-to-api-tests <KEY>`.» Stop.
  - `null` → say that the story has no unambiguous `ui`/`api` label, quote the intake `notes`, and suggest `/story-to-api-tests` for API stories. Stop.
- `acceptance_criteria` is `[]` → say so, quote the intake `notes`, stop.

## 2. Analysis → stop 1

Run both checks with the intake JSON as input, in parallel:
- `Agent` with `subagent_type: "implementation-check"`, prompt = the intake JSON as text. Launch it first, in the background.
- `Skill story-doc-check <intake JSON>` in the main thread.

Wait for both. Then show **one report**:

1. The story-doc-check table and summary line, as returned.
2. Implementation table built from the implementation-check JSON (don't paste the raw JSON):

   | # | Acceptance criterion | Реалізація | Докази / чого бракує |
   |---|---|---|---|

   `implemented` → `file:line` refs; `partial` → `present` / `missing`; `not_found` → what was searched (`notes`). Then one line with the overall `verdict`.
3. **Flags:** the AC that are «суперечить» or «не описано» in the docs, and the AC that are `not_found` in the code. For each, one short line why it matters for testing (a case built on a contradicted AC produces false defects; an unimplemented AC will fail by design).

Ask with `AskUserQuestion` — «Продовжити генерацію кейсів для <KEY>?»:
- **Так** — use all AC.
- **Так, без деяких AC** — the user names the AC numbers to exclude (via Other). Suggest the «суперечить» ones, but don't exclude anything on your own.
- **Ні, зупинитись** — stop here; the report above is the result.

## 3. Test cases and verification

### 3.1 Scope for the creator

The scope is the Confluence page / section the **story itself** points to:
- `confluence_url` (page id from `/pages/<id>`, resolve the short name via the table in `CLAUDE.md`);
- pages / sections named in the intake `notes` or cited inside the AC (e.g. `06 §1.4`, `04 §Operator portal`).

If the link is only to a whole page, narrow it to the section(s) the included AC are about, using the story-doc-check evidence (it names the page + section per AC). If the story points nowhere and story-doc-check found no section either, ask the user which page/section to use. Don't guess.

Excluded AC (step 2) stay out: tell the creator which AC are excluded, and leave out the conditions that only serve them.

### 3.2 Generate

1. `Glob test-cases/ui/*.md` → list *before*.
2. Invoke `Skill ui-test-case-creator "<page> §<section>"` (one call per section if there are several, sequentially — the creator picks the next free ID, so parallel calls would collide). Its own confirmation stop (more than ~25 conditions) stays; let it ask the user.
3. `Glob test-cases/ui/*.md` → list *after*. New files = *after* − *before*.
4. The **case set** = the new files + the existing cases the creator listed as duplicates of this scope (they cover the same story and must go to Testomat too).
5. Keep the creator's **skipped conditions** and **selector findings** for the final summary.

Empty case set → say so with the creator's skipped list and stop.

### 3.3 Verify

Launch one `tc-verifier` agent per case in the set, **all in the same message** so they run in parallel. Pass only the path, e.g. `test-cases/ui/TC-UI-014.md`. Wait for all of them.

Read the overall status from the verifier heading `## <ID> — <STATUS>`. Unreadable → run that verifier once more; still unreadable → treat as `DOES NOT CORRESPOND TO SPECS` with reason "verifier returned no status".

| Verdict | Next |
|---|---|
| `CORRESPONDS TO SPECS` | goes to the gate (step 4) |
| `DOES NOT CORRESPOND TO SPECS` | rejected: not shown for approval, never synced |
| `NOTHING FOUND IN DOCUMENTATION` | rejected: not shown for approval, never synced; the missing doc item is an open question |

Rejected files are **not deleted** by this skill (it has no write tools). List them in the summary as «на видалення / доопрацювання» with the verifier's reason, so the user decides.

For every verdict, keep the verifier's **Code discrepancies** (if not "none"): a docs-vs-code difference may be a product defect.

No case passed → show the rejected list and stop (nothing to approve).

## 4. Gate → stop 2

Show the cases that passed verification:

| ID | Назва | Техніка | AC | Файл | Вердикт |
|---|---|---|---|---|---|

Under the table, for each case 1–2 lines: the key step and the expected result (read the file). Then a short line with the number of rejected cases (details come in the summary).

Ask with `AskUserQuestion` — «Схвалюєте кейси для запису в Testomat?»:
- **Схвалити всі**
- **Схвалити частину** — the user lists the IDs to approve (via Other). Unknown IDs → say which and ask again.
- **Не схвалювати** — stop. Nothing is written to Testomat. The files stay in `test-cases/ui/`.

## 5. Sync to Testomat

Only the approved cases:

1. `Skill testomat-sync upsert "<KEY> — <title>" <KEY> <paths of approved cases>` → suite id and one `test_id` per case.
2. `Skill testomat-sync run "<KEY> — <YYYY-MM-DD>" <all test_ids from upsert>` → `run_id`, url.

Don't call `report`: the run hasn't been executed yet. If upsert returns no test ids, don't create a run; report the upsert output and stop.

## 6. Summary

End with:
- **Testomat:** suite (created/reused), run link, number of tests in the run.
- **Cases:** table ID / action (`created` / `reused`) / file.
- **Rejected by tc-verifier:** ID, verdict, reason, file — «на видалення / доопрацювання».
- **Not approved at the gate:** IDs, if any.
- **Findings:** AC that contradict or are missing from the docs (step 2), AC not implemented in code (step 2), docs-vs-code discrepancies (step 3.3), selector findings and skipped conditions from the creator (step 3.2), warnings from testomat-sync.
