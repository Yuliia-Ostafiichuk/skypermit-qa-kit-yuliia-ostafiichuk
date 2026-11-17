---
name: story-to-api-tests
description: Веде ОДНУ API-задачу SkyPermit з Jira до прогнаних API-тестів — jira-intake, story-doc-check і implementation-check зі стопом на звіт, api-test-case-creator, tc-verifier (mode api), гейт схвалення, testomat-sync, postman-collection-builder, гейт перегляду колекції, postman-cli-run, testomat-sync report. НЕ для UI-задач (/story-to-tests).
argument-hint: "<Jira issue key, e.g. SKY-2>"
disable-model-invocation: true   # пише файли, у Postman, Testomat і в застосунок — лише ручний /виклик
allowed-tools:
  - Skill
  - Agent
  - AskUserQuestion
  - Read(test-cases/**)
  - Grep(test-cases/**)
  - Glob(test-cases/**)
---

# Story → API test cases → Testomat → Postman run

Take one API story from Jira (`$ARGUMENTS`) through analysis, case generation and verification to approved cases in Testomat.io, a Postman collection, a Postman CLI run, and the run results in Testomat.

This skill only **orchestrates**. It doesn't read Jira, Confluence or the code itself, and it doesn't write anything itself:
- test case files are written only by `api-test-case-creator`;
- Testomat is written only by `testomat-sync`;
- Postman is written only by `postman-collection-builder`; collections are run only by `postman-cli-run`.

Talk to the user in their language. Four stops need the user's answer (steps 2, 4, 6 and 7). Never skip them or answer them yourself.

## Ground rules

- Manual API test cases plus the Postman exception from `CLAUDE.md`. No other automation code.
- `../skypermit`, Jira and Confluence are read-only.
- Never edit a test case to make it pass verification. The verdict decides what happens to it (step 3.3).
- Nothing reaches Testomat without approval at the gate in step 4.
- Nothing runs against the app without the user's own «запускай» at `postman-cli-run`'s gate (step 7).
- Never change a case, the collection, the environment or test data to make a run pass, and never rerun without a new «запускай». Failures are reported as they are.
- If a called skill or agent fails or returns something unreadable, say which step failed and what it returned, and stop. Don't fill in its result yourself.

## 0. Argument

`$ARGUMENTS` empty or not an issue key (`[A-Z][A-Z0-9]+-\d+`) → ask for the key and stop.

## 1. Intake

Invoke `Skill jira-intake <KEY>` and take its JSON (call it *intake*).

- No JSON (issue not found, no access) → relay its message and stop.
- `check_type` is not `"api"`:
  - `"ui"` → say: «<KEY> — UI-задача (check_type = ui). Запусти `/story-to-tests <KEY>`.» Stop.
  - `null` → say that the story has no unambiguous `ui`/`api` label, quote the intake `notes`, and suggest `/story-to-tests` for UI stories. Stop.
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

Ask with `AskUserQuestion` — «Продовжити генерацію API-кейсів для <KEY>?»:
- **Так** — use all AC.
- **Так, без деяких AC** — the user names the AC numbers to exclude (via Other). Suggest the «суперечить» ones, but don't exclude anything on your own.
- **Ні, зупинитись** — stop here; the report above is the result.

## 3. Test cases and verification

### 3.1 Rules for the creator

`api-test-case-creator` takes **one business rule** per call, not a page or section. Turn the included AC into a list of rules:

- For each included AC, take the `gate` and `rule_reference` from the story-doc-check evidence: a row of `06 — Business Rules` §6 (as corrected by `07`), or a rule the AC cites directly (e.g. `TSD-4 §2.1`, `06 §1.4`).
- `REGISTRATION` is valid for the aircraft-write rule, which has no gate.
- One rule can serve several AC. Call the creator once per distinct `gate` + `rule_reference` pair.
- An AC that doesn't map to any §6 rule → list those AC and ask the user which rule to use, or whether to leave the AC out. Don't guess.

Excluded AC (step 2) stay out, and so do the rules that only serve them.

Show the AC → rule mapping in one short table before generating.

### 3.2 Generate

1. `Glob test-cases/api/*.md` → list *before*.
2. For each rule, invoke `Skill api-test-case-creator {"gate": "<GATE>", "rule_reference": "<ref>", "story": "<KEY>"}`. Run the calls **sequentially**: the creator picks the next free `API-OP-NNN`, so parallel calls would collide. Its own confirmation stop (more than ~25 conditions) stays; let it ask the user.
3. `Glob test-cases/api/*.md` → list *after*. New files = *after* − *before*.
4. The **case set** = the new files + the existing cases the creator named as duplicates for these rules (they cover the same story and must go to Testomat and Postman too).
5. Keep the creator's **skipped conditions** and **findings** for the final summary. Ignore its `/postman-collection-builder` hand-off: step 6 builds the collection from the approved cases only.

Empty case set → say so with the creator's skipped list and stop.

### 3.3 Verify

Launch one `tc-verifier` agent per case in the set, **all in the same message** so they run in parallel. Pass the path and the flag, e.g. `test-cases/api/API-OP-008.md` + `mode: api`. Wait for all of them.

Read the overall status from the verifier heading `## <ID> — <STATUS>`. Unreadable → run that verifier once more; still unreadable → treat as `DOES NOT CORRESPOND TO SPECS` with reason "verifier returned no status".

| Verdict | Next |
|---|---|
| `CORRESPONDS TO SPECS` | goes to the gate (step 4) |
| `DOES NOT CORRESPOND TO SPECS` | rejected: not shown for approval, never synced, not in the collection |
| `NOTHING FOUND IN DOCUMENTATION` | rejected: not shown for approval, never synced, not in the collection; the missing doc item is an open question |

Rejected files are **not deleted** by this skill. List them in the summary as «на видалення / доопрацювання» with the verifier's reason, so the user decides.

For every verdict, keep the verifier's **Code discrepancies** (if not "none") and **Notes**: a docs-vs-code difference may be a product defect.

No case passed → show the rejected list and stop (nothing to approve).

## 4. Gate → stop 2

Show the cases that passed verification:

| ID | Назва | Техніка | Ендпоінт | AC | Файл | Вердикт |
|---|---|---|---|---|---|---|

Under the table, for each case 1–2 lines: the checked request and the expected status / body (read the file). Then a short line with the number of rejected cases (details come in the summary).

Ask with `AskUserQuestion` — «Схвалюєте API-кейси для запису в Testomat і в колекцію Postman?»:
- **Схвалити всі**
- **Схвалити частину** — the user lists the IDs to approve (via Other). Unknown IDs → say which and ask again.
- **Не схвалювати** — stop. Nothing is written to Testomat or Postman. The files stay in `test-cases/api/`.

## 5. Sync to Testomat

Only the approved cases:

1. `Skill testomat-sync upsert "<KEY> — <title>" <KEY> <paths of approved cases>` → suite id and one `test_id` per case.
2. `Skill testomat-sync run "<KEY> · API" <all test_ids from upsert>` → `run_id`, url. Keep `run_id` for step 8.

If upsert returns no test ids, don't create a run; report the upsert output and stop.

## 6. Postman collection → stop 3

Invoke `Skill postman-collection-builder {"key": "<KEY>", "files": [<paths of approved cases>]}`. Leave `collection_name` at its default (`<KEY> · API`).

- Builder stops on a name collision → relay it and stop. Don't pick another name yourself; the user reruns the step with a name.
- Otherwise show its report as returned (review table, *Not checked*, warnings, secrets to provide). Keep its final JSON for step 7.

Ask with `AskUserQuestion` — «Колекцію <name> переглянуто в Postman? Переходимо до preflight прогону?»:
- **Так, до preflight** — go to step 7.
- **Ні, не запускати** — stop. Say that the Testomat run `<run_id>` stays `running` with no results, and that the collection stays in Postman as built.

## 7. Run → stop 4

Invoke `Skill postman-cli-run <JSON from step 6>`.

It does its own preflight and then waits for the user's **«запускай»**. That gate belongs to `postman-cli-run`: this skill never writes «запускай», never treats the answer at stop 3 as one, and doesn't add its own question here.

- Preflight blocker (empty `baseUrl`, missing shell secret, unreachable host) → relay it and stop. Say that the Testomat run stays `running`; once the blocker is fixed the user can rerun `/postman-cli-run` and then `/testomat-sync report <run_id> …` by hand.
- The user doesn't say «запускай» → stop, same note about the run.
- After the run, take its report and the final JSON array of results (`case_id`, `status`, `message`).

## 8. Results to Testomat

Invoke `Skill testomat-sync report <run_id> <results JSON from step 7>`, passing the array **as is**. Don't drop, merge or rewrite any item: `failed` goes in as `failed`, `skipped` as `skipped`.

If `report` returns `rejected` items or `pending` tests, show them as warnings. A `rejected` failed case is a lost failure: name it explicitly.

## 9. Summary

End with:
- **Testomat:** suite (created/reused), run link, counts from `report` (`passed` / `failed` / `skipped` / `pending`), `rejected` if any, whether the run is closed.
- **Postman:** collection and environment names, Postman Cloud run link, redacted log path in `api-automation/runs/`.
- **Run analysis:** the per-case failure analysis from `postman-cli-run` (cause type: environment / test data / collection / possible defect), with expected vs actual and the doc ref for possible defects. Don't write defect reports.
- **Test data left on the target**, as reported by `postman-cli-run`.
- **Cases:** table ID / action (`created` / `reused`) / file.
- **Rejected by tc-verifier:** ID, verdict, reason, file — «на видалення / доопрацювання».
- **Not approved at the gate:** IDs, if any.
- **Findings:** AC that contradict or are missing from the docs (step 2), AC not implemented in code (step 2), AC with no §6 rule (step 3.1), docs-vs-code discrepancies and verifier notes (step 3.3), creator findings and skipped conditions (step 3.2), *Not checked* and warnings from the builder (step 6), warnings from testomat-sync.
