---
name: story-doc-check
description: Звіряє ОДНУ user story з документацією в Confluence: для кожного acceptance criterion — покрито / суперечить / не описано. Вхід — JSON від /jira-intake (текстом, шляхом до .json або останній вивід /jira-intake у цій розмові); Jira сам не читає. Лише читання. НЕ для перевірки коду і не для написання кейсів.
argument-hint: "<jira-intake JSON | path/to/intake.json | empty = last /jira-intake output>"
allowed-tools:
  - Read
  - mcp__atlassian__searchConfluenceUsingCql
  - mcp__atlassian__getConfluencePage
---

# Story vs. docs check

Check the acceptance criteria of one story, given as `/jira-intake` JSON, against the **SkyPermit Docs** Confluence space (key `SD1`). The output tells the user, per criterion, whether the documentation backs it, contradicts it, or doesn't describe it.

## Ground rules

- **Read-only.** Use only the read tools listed in `allowed-tools`. Don't call Jira at all: the story comes only from the intake JSON. Never create, update or comment on Confluence pages. Don't write files.
- **The only source is the documentation.** Don't fill gaps from general knowledge, common sense about aviation, the `../skypermit` code, tests, seed data or other Jira issues. If the docs don't say it, the status is «не описано», even when the answer seems obvious. A gap filled by guessing hides exactly the problem this check is meant to find.
- **Confluence, not local copies.** Don't read `../skypermit/docs/`. Pages and ids are in the table in `CLAUDE.md`.

## 1. Get the story (intake JSON)

Find the input, in this order:
1. `$ARGUMENTS` is a JSON object → use it.
2. `$ARGUMENTS` is a path to a `.json` file → `Read` it. Missing or unreadable → say so and stop.
3. `$ARGUMENTS` is empty → use the most recent `/jira-intake` JSON block in this conversation. None → ask the user to run `/jira-intake <KEY>` first and stop.
4. `$ARGUMENTS` is just an issue key (e.g. `SKY-2`) or anything else → say this skill takes `/jira-intake` output, suggest `/jira-intake <KEY>`, and stop.

Validate it:
- Must be valid JSON with `key` (string), `title` (string) and `acceptance_criteria` (array of strings). `check_type`, `confluence_url`, `notes` are optional. Anything else wrong → name the problem and stop. Don't repair or guess missing fields.
- `acceptance_criteria` empty → say so (quote the intake `notes` if they explain why) and stop. Don't derive criteria from the title or notes: that would be checking your own reading, not the story.
- Number the criteria 1…n in array order and keep their wording.

Use the other fields only as pointers, never as evidence:
- `confluence_url` → the first page to read (take the page id from `/pages/<id>`). If it isn't in space `SD1`, read nothing from it and mention that in the summary line.
- `notes` → doc pages the story names without a link (e.g. «03 — API contract», «06 … розділ 1.4»): read those too. These are the story's own doc references; if they point to the wrong place, mention it in the summary line.
- `check_type` → which page to search first (`api` → `03`, `ui` → `04`). It never changes a status.

## 2. Read the docs

- Start with the pages and sections the story itself points to (`confluence_url`, pages named in `notes`, rule citations inside the criteria).
- For each criterion, search further with `searchConfluenceUsingCql` (`space = SD1 AND text ~ "<term>"`) and read the pages it hits with `getConfluencePage` (`contentFormat: "markdown"`).
- Always read `05 — Open Questions` and `07 — Clarifications`. `07` overrides `06` where they disagree. An item that `05` lists as open is «не описано», not «покрито».
- Mind precedence statements inside the docs themselves, e.g. `06` says the source document wins over the compilation, and `A-7 §4` says the amendment wins over the base catalogue. Apply them before you call something a contradiction.

## 3. Give each criterion a status

Break a criterion into its separate claims (value, gate, citation, state, UI behaviour, …) and check each one. The criterion's status is the worst of its claims: **суперечить** > **не описано** > **покрито**.

| Status | When | What to give |
|---|---|---|
| **покрито** | Every claim is stated in the docs, or follows directly from statements in the docs, with no extra assumption | Page (`06`), section (`§1.4`, or the heading name), a short verbatim quote (≤ 25 words) in the docs' language |
| **суперечить** | At least one claim conflicts with what the docs say, after applying `07` and the docs' own precedence rules | What the criterion says, what the docs say, where (page + section + quote) |
| **не описано** | At least one claim isn't in the docs, or is listed as open in `05`, and nothing contradicts it | Which claim is missing; list the pages and sections you checked |

Rules:
- "Follows directly" means a reader could get it from the quoted text with no outside knowledge. Show the reasoning chain in one sentence, e.g. "TIME_WINDOW is last and evaluation stops at first failure (`06` Evaluation order), so the earlier three passed."
- When some claims are covered and others not, still give the one worst status, and say which part is covered and where in the same row.
- Don't use the code to settle a doubt. Write down what's undefined instead.
- Two doc pages that disagree with each other and aren't settled by `07`/`05` → «не описано», and name both places.

## 4. Output

Answer in the user's language. Output exactly this, nothing more:

1. A heading line: `<key> — <title>` from the intake JSON.
2. One table:

| # | Acceptance criterion | Статус | Де в Confluence / що не так |
|---|---|---|---|

   - `#` and the criterion text (shortened if long) come from the story.
   - Last column: page + section + quote for «покрито»; the conflict with both sides for «суперечить»; the missing claim and pages checked for «не описано». Page refs use short names (`06 §1.4`), optionally linked: `https://dragan1925.atlassian.net/wiki/spaces/SD1/pages/<page id>`.
3. A one-line summary: counts per status, plus the single most important problem if there is one. Example: `Підсумок: 3 покрито, 0 суперечить, 2 не описано. Головне: часовий пояс зони для комендантської години не визначений (01 → Zone).`

If the story's doc pointers (step 1: `confluence_url`, pages named in `notes`) are wrong or outside `SD1`, add that to the summary line. Don't add a separate section, recommendations or next steps.
