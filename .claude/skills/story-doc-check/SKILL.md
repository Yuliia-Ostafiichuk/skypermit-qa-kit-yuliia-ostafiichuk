---
name: story-doc-check
description: Звіряє ОДНУ user story з документацією в Confluence: для кожного acceptance criterion — покрито / суперечить / не описано. Лише читання. НЕ для перевірки коду і не для написання кейсів.
argument-hint: "<issue key, e.g. SKY-1>"
allowed-tools:
  - mcp__atlassian__getJiraIssue
  - mcp__atlassian__searchConfluenceUsingCql
  - mcp__atlassian__getConfluencePage
---

# Story vs. docs check

Check the acceptance criteria of Jira issue `$ARGUMENTS` against the **SkyPermit Docs** Confluence space (key `SD1`). The output tells the user, per criterion, whether the documentation backs it, contradicts it, or doesn't describe it.

## Ground rules

- **Read-only.** Use only the read tools listed in `allowed-tools`. Never edit, transition or comment on the Jira issue. Never create, update or comment on Confluence pages. Don't write files.
- **The only source is the documentation.** Don't fill gaps from general knowledge, common sense about aviation, the `../skypermit` code, tests, seed data or other Jira issues. If the docs don't say it, the status is «не описано», even when the answer seems obvious. A gap filled by guessing hides exactly the problem this check is meant to find.
- **Confluence, not local copies.** Don't read `../skypermit/docs/`. Pages and ids are in the table in `CLAUDE.md`.

## 1. Get the story

- `$ARGUMENTS` empty or not an issue key → ask for the key and stop.
- Read the issue with `getJiraIssue` (cloudId `fda6a7bd-b624-41c9-b57a-3bf22663b4ab`, `responseContentFormat: "markdown"`). If it isn't found, say so and stop.
- Take the acceptance criteria from the description (a section titled "Acceptance criteria", "AC", "Критерії приймання" or similar). Keep the issue's numbering and wording.
- No acceptance criteria → say so and stop. Don't derive criteria from the summary or context: that would be checking your own reading, not the story.
- Note what else the story claims as fact (context, rule citations, links to doc pages). Check those too, but they don't get table rows: they go in the summary only if they're wrong.

## 2. Read the docs

- Start with the pages and sections the story itself points to.
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

1. A heading line: `<KEY> — <summary>`.
2. One table:

| # | Acceptance criterion | Статус | Де в Confluence / що не так |
|---|---|---|---|

   - `#` and the criterion text (shortened if long) come from the story.
   - Last column: page + section + quote for «покрито»; the conflict with both sides for «суперечить»; the missing claim and pages checked for «не описано». Page refs use short names (`06 §1.4`), optionally linked: `https://dragan1925.atlassian.net/wiki/spaces/SD1/pages/<page id>`.
3. A one-line summary: counts per status, plus the single most important problem if there is one. Example: `Підсумок: 3 покрито, 0 суперечить, 2 не описано. Головне: часовий пояс зони для комендантської години не визначений (01 → Zone).`

If the story's other factual claims (step 1) are wrong, add them to the summary line. Don't add a separate section, recommendations or next steps.
