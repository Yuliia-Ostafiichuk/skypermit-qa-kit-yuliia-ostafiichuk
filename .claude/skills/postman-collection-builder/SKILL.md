---
name: postman-collection-builder
description: Будує ОДНУ колекцію Postman і її environment з файлів API-кейсів і openapi.yaml через Postman MCP. Запити «<case id>: …», тести на статус і тіло респонсу, секрети лише в environment. Після створення зупиняється на рев'ю. НЕ запускає колекції (postman-cli-run) і не пише кейси.
argument-hint: '{"key": "SKY-2", "files": ["test-cases/time-window/TC-TW-001.md"], "collection_name": "SKY-2 · API", "base_url": "https://skypermit.vercel.app/api/v1"}'
allowed-tools:
  - Read(test-cases/**)
  - Read(../skypermit/public/openapi.yaml)
  - mcp__postman__getCollections
  - mcp__postman__getEnvironments
  - mcp__postman__createCollection
  - mcp__postman__createEnvironment
  - mcp__postman__getCollection
---

# Postman collection builder

Turns manual API test cases into **one new** Postman collection plus **one new** environment, then stops for review. It never runs anything (that is `/postman-cli-run`) and never writes or edits test cases.

## Input

`$ARGUMENTS` is JSON:

| Field | Required | Meaning |
|---|---|---|
| `key` | yes | Jira key, e.g. `SKY-2`. Goes into the collection description. |
| `files` | yes | API case files under `test-cases/` (e.g. `test-cases/time-window/TC-TW-001.md`). |
| `collection_name` | no | Default `<key> · API`. |
| `environment_name` | no | Default `<collection_name> · env`. |
| `base_url` | no | Default: `servers[0].url` from `openapi.yaml`. Must end in `/api/v1`. |

Missing `key` or `files`, or a file that doesn't exist → say what's missing in one line and stop.

## Ground rules

- **Postman workspace:** `SkyPermit`, id `35768908-4935-42f4-a37e-63d2d4de4e90`. Pass it to every `get*` / `create*` call.
- **Create only.** Never update, overwrite or delete an existing collection or environment, and never add requests to one. Name collision → stop (step 2).
- **Secrets only as environment variables** of type `secret` with an **empty** value. Never put a password, token or key literally in a body, header, URL, script or collection variable. If a case file contains a literal secret, use `{{var}}` instead and add a warning.
- **The case file is the test basis.** Request bodies come from Preconditions and Steps; assertions come from Expected result, typed by the response schema in `openapi.yaml`. Something the case expects that the API contract can't show → list it under *not checked*. Don't invent expectations, and don't drop any.
- `openapi.yaml` and the case disagree (path, field name, status) → follow the case, mark the request `⚠ contract mismatch` in the review table. Don't resolve it silently.
- Read `../skypermit` only. Never write there.

## Steps

### 1. Read
- For each case: `ID`, title (`# <ID>: …`), `Doc ref`, Preconditions, Steps, Expected result.
- From `openapi.yaml`: for each operation the cases use, the method, path, request schema (required fields, formats, limits), the response schema for the expected status, and how auth works. Session cookies from `POST /operators` or `/auth/login` are carried by Postman's cookie jar. Don't store cookies or tokens in variables.

### 2. Check names
`getCollections` with `name = <collection_name>` and `getEnvironments` filtered by name. Any exact match → stop, report the existing uid, and ask for another name.

### 3. Build the requests
Order: for each case, its setup requests first, then its case request. Several cases may share a setup chain only if their preconditions are identical.

- **Setup request** (one per precondition entity: operator, pilot, aircraft, flight request…): name `setup <case id>: <what it creates>`. Status assertion + the fields the next requests rely on (e.g. `id` is a non-empty string, `state` = `DRAFT`). Save ids to **collection variables** (`pm.collectionVariables.set`).
- **Case request** (the call in Steps): name exactly `<case id>: <case title without the ID>`. That name is how `/postman-cli-run` maps results back to the case. Exactly one case request per case.
- **Extra check request** for an expected result that isn't visible in the case response (e.g. `state = REJECTED` after a 422): add `GET` on the resource if `openapi.yaml` has one, and name it `<case id>: check <what>`. Otherwise the item goes under *not checked*.
- **Unique test data:** a pre-request script on the first setup request sets `runId = Date.now().toString()`. Use it for e-mails, national ids and serial numbers so repeated runs don't collide.
- **Times** (window start, certification dates…): compute them in pre-request scripts relative to `Date.now()`, as the case defines them. Write the source rule as a comment (`// 06 §1.4: now + 5 h < 6 h lead time`).
- **Secret guard:** a request that uses a secret starts its pre-request script with
  ```js
  if (!pm.environment.get('<var>')) { console.warn('<var> is not set'); pm.execution.skipRequest(); }
  ```
  Don't `throw`: the request would still be sent.

### 4. Assertions: every request gets both kinds
```js
pm.test('Status is 422', () => pm.response.to.have.status(422));
let body; try { body = pm.response.json(); } catch (e) { body = undefined; }
pm.test('Body is JSON', () => pm.expect(body, 'response body is not JSON').to.be.an('object'));
if (body) {
  pm.test('failing_gate is TIME_WINDOW', () => pm.expect(body.failing_gate).to.eql('TIME_WINDOW'));
  // …one pm.test per field the case expects
}
```
- **Status:** the exact code from Expected result (setup: the success code from `openapi.yaml`).
- **Body:** every value the case expects, one `pm.test` each, with the doc value in the test name. Also the required fields of the response schema (presence and type), so a contract break shows up even when the values match.
- Parse JSON with try/catch as above, so a missing or non-JSON response gives one clear failure instead of `JSONError` noise.
- A 2xx response that must yield an id → also assert the id, so a broken chain fails at the right request.

### 5. Environment
`createEnvironment` with:
- `baseUrl`: type `default`, value = `base_url`. It must be the **stored** value: current values never reach Postman CLI.
- One variable per secret the requests use: type `secret`, value `""`, description `"Secret. Pass to the CLI as SKYPERMIT_<KEY_UPPER> via --env-var; never store a value here."`.

### 6. Collection
`createCollection` (schema v2.1.0) with:
- `info.description`: key, case files with their doc refs, environment name, the list of secret variables and their `SKYPERMIT_*` names.
- All items from step 3, plus empty collection variables for every id or time they set.

Then `getCollection` (model `full`) on the new uid and check: every case has exactly one `<case id>: …` request, no literal secret anywhere, and every request has a status test and a body test.

### 7. Stop and report
In the user's language. Don't run anything, and don't offer to run anything except through `/postman-cli-run`.

1. Collection uid and name, environment uid and name, Postman link.
2. Review table, one row per request in order:

   | # | Request name | Method + path | Assertions (status · body) | Case / doc ref |
   |---|---|---|---|---|

3. **Not checked**: expected results the collection can't assert, and why.
4. **Warnings**: contract mismatches, literal secrets replaced, shared setup chains.
5. **Secrets to provide before a run**: `operatorPassword → SKYPERMIT_OPERATORPASSWORD`, …

End with one fenced `json` block for `/postman-cli-run`:
```json
{"key": "SKY-2", "collection_id": "<uid>", "environment_id": "<uid>", "cases": ["TC-TW-001"], "secrets": {"operatorPassword": "SKYPERMIT_OPERATORPASSWORD"}}
```
