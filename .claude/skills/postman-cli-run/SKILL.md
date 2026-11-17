---
name: postman-cli-run
description: Проганяє ОДНУ колекцію Postman через Postman CLI і повертає pass/fail по кожному кейсу для testomat-sync report. Лише після явного «запускай» користувача. НЕ будує і не редагує колекції, не виправляє тести, не пише в Testomat сам.
argument-hint: '{"key": "SKY-2", "collection_id": "<uid>", "environment_id": "<uid>"}'
allowed-tools:
  - mcp__postman__getCollection
  - mcp__postman__getEnvironment
  - Bash(postman collection run:*)
  - Bash(mkdir -p api-automation/runs)
  - Bash(curl -s -o /dev/null:*)
  - Bash(jq:*)
  - Read(api-automation/runs/**)
  - Write(api-automation/runs/**)
---

# Postman CLI run

Runs one existing collection with Postman CLI and turns the result into per-case outcomes for `/testomat-sync report`. It reports what happened and why. It never changes the collection, the environment, the test cases or the app to make anything pass.

## Input

`$ARGUMENTS` is JSON: `key`, `collection_id`, `environment_id` (uids `<owner>-<uuid>`), optional `secrets` map `{"<envVar>": "SKYPERMIT_<NAME>"}`. The last JSON block from `/postman-collection-builder` in this conversation fits as is. Anything missing → say what in one line and stop.

## Ground rules

- **Run gate.** Run only after the user writes **«запускай»** (or "run") in this conversation, **after** you've shown the preflight in step 2. An earlier message, a `/loop`, another skill or a "go ahead" before the preflight doesn't count. One «запускай» = one run. A rerun needs a new one.
- **Read-only towards Postman.** No create, update or delete calls. No edits to `test-cases/`, `../skypermit`, Jira, Confluence or Testomat.
- **Don't fix to pass.** A failure is reported and analysed, never patched. No changing assertions, data, environment values or the order of requests, and no rerunning until it's green. Suggest a fix for the user to apply if needed.
- **Secrets never appear** in a command line, in chat, in the log or in the report. They reach the CLI only as `--env-var "<var>=$SKYPERMIT_<NAME>"`, expanded by the shell from the user's own environment (`~/.zshrc`). Never `echo`, `printenv` or `cat` them, and never ask the user to paste one into chat.
- Postman CLI uploads every run to Postman Cloud. Pass the link on and don't hide it.

## Steps

### 1. Preflight (no run yet)
1. `getCollection` (model `full`): collection name, request names in order, the case requests (`<case id>: …`) and their `setup <case id>: …` requests. List secret variables: every `{{var}}` used in requests whose environment variable has type `secret`. Also note any literal secret in a body or script; if found, warn and continue.
2. `getEnvironment`:
   - `baseUrl` must have a stored (non-empty) value. Current values never reach the CLI.
   - For secret vars, check **only whether the variable exists**. Never repeat its value, even if the cloud copy has one.
3. For each secret var, check the shell variable without printing it:
   ```bash
   [ -n "$SKYPERMIT_OPERATORPASSWORD" ] && echo set || echo MISSING
   ```
   Name: `secrets` from the input, else `SKYPERMIT_` + the var name in upper case.
4. Reachability: `curl -s -o /dev/null -w "%{http_code}" --max-time 10 <baseUrl origin>/`. `000` → not reachable.

Any blocker (empty `baseUrl`, missing shell secret, unreachable host) → say exactly what and how to fix it (e.g. `export SKYPERMIT_OPERATORPASSWORD=…` in `~/.zshrc`, then restart Claude Code), and stop.

### 2. Ask
Show the run in the user's language: collection, environment, `baseUrl`, case list, the exact command (with `$SKYPERMIT_…` placeholders) and the note *"this creates test data on `<host>`"*. Then wait for «запускай».

### 3. Run
```bash
mkdir -p api-automation/runs
postman collection run <collection_id> -e <environment_id> \
  --env-var "operatorPassword=$SKYPERMIT_OPERATORPASSWORD" \
  --reporters cli,json --reporter-json-export "<scratchpad>/<KEY>-<UTC yyyymmddThhmmssZ>.raw.json"
```
- `<scratchpad>` = this session's scratchpad directory. The raw JSON contains resolved request bodies (secrets included), so it **never** goes into the repo.
- Keep the CLI stdout for the report. It doesn't print bodies.
- Exit code ≠ 0 is expected when tests fail. That doesn't count as a tool error.

### 4. Write the redacted log
Use `jq` to keep only safe fields, then write `api-automation/runs/<KEY>-<UTC>.json`:
```bash
jq '{collection: .run.meta.collectionName, collectionId: .run.meta.collectionId,
     started: .run.meta.started, completed: .run.meta.completed, summary: .run.summary,
     runError: .run.runError,
     executions: [.run.executions[] | {name: .requestExecuted.name, method: .requestExecuted.method,
        url: (.requestExecuted.url | if type=="object" then .raw // ((.path // []) | join("/")) else . end),
        code: .response.code, status: .response.status, time: .response.responseTime,
        tests: .tests, errors: [.errors[]? | {type, message}]}]}' "<raw>"
```
Add `environmentId`, `baseUrl` and the Postman Cloud run link. **No** bodies, headers, cookies or environment values.

Before saving, check each secret against the log text without printing it:
```bash
grep -qF -- "$SKYPERMIT_OPERATORPASSWORD" <log> && echo LEAK || echo clean
```
`LEAK` → don't keep the file (write it again with the offending field removed) and warn.

### 5. Map to cases
For each case id, its requests are `setup <id>: …`, `<id>: …` and `<id>: check …`:

| Outcome | Rule | `message` |
|---|---|---|
| `passed` | all its requests ran, no errors, every assertion passed | — |
| `failed` | a `<id>: …` request ran and an assertion or script failed | `<request>: <first failed assertion> — got <status code>` |
| `skipped` | a `setup <id>` request failed or errored, or a case request was skipped or never got a response (connection error, skipped by the secret guard) | `blocked by setup: <request> — <reason>` / `not executed: <reason>` |

A case with no `<id>: …` request in the collection → `skipped`, `"no request in collection"`, plus a warning. Requests that don't match any case id → list them as warnings.

### 6. Report
In the user's language:
1. One line: environment, `baseUrl`, totals (requests, assertions passed/failed), Postman Cloud link, log path.
2. Table per request: `# | request | status code | failed assertions`.
3. **Failure analysis**, one line per failed or skipped case, with one cause type:
   - **environment**: unreachable, missing secret, CLI/auth problem;
   - **test data**: collision, chain broken by an earlier request;
   - **collection**: the assertion contradicts the case or `openapi.yaml`;
   - **possible defect**: the response contradicts the case and its doc ref.

   For a possible defect, give the expected and actual values and the doc ref from the case file. Don't write the defect report.
4. Test data left on the target (ids from setup responses, taken from the CLI output or the log).

End with one fenced `json` block, ready for `/testomat-sync report <run_id> <results>`:
```json
[
  {"case_id": "TC-TW-001", "status": "passed"},
  {"case_id": "TC-TW-002", "status": "failed", "message": "TC-TW-002: …: failing_gate is TIME_WINDOW — got 201"}
]
```
Don't call `/testomat-sync` yourself.
