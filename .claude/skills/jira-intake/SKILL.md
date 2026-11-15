---
name: jira-intake
description: Читає ОДНУ задачу з Jira за ключем і повертає JSON (key, title, check_type, acceptance_criteria, confluence_url, notes) як вхід для подальшої QA-роботи. Використовуй, коли треба структуровано витягти дані зі story перед аналізом, кейсами чи планом. Його JSON — вхід для /story-doc-check. НЕ використовуй для самої звірки з документацією (це /story-doc-check), для написання кейсів, для пошуку чи списку задач і для будь-яких змін у Jira. Лише читання.
argument-hint: "<issue key, e.g. SKY-1>"
allowed-tools:
  - mcp__atlassian__getJiraIssue
  - mcp__atlassian__getJiraIssueRemoteIssueLinks
---

# Jira intake

Read Jira issue `$ARGUMENTS` and return its data as one JSON object. This is extraction only: no analysis, no checking against the docs, no test design.

## Ground rules

- **Read-only.** Use only the tools in `allowed-tools`. Never edit, transition, assign, link, log work on or comment on the issue. Don't write files.
- **Only what the issue says.** Every value comes from the issue itself. Don't guess, infer, normalise or fill gaps from the summary, the docs, the `../skypermit` code or other issues. When a value is missing or unclear, use `null` (or `[]`) and say why in `notes`.

## 1. Get the issue

- `$ARGUMENTS` empty or not an issue key (`[A-Z][A-Z0-9]+-\d+`) → ask for the key and stop. No JSON.
- Call `getJiraIssue` (cloudId `fda6a7bd-b624-41c9-b57a-3bf22663b4ab`, `responseContentFormat: "markdown"`). Not found or no access → say so in one line and stop. No JSON.
- Call `getJiraIssueRemoteIssueLinks` for the same issue (needed for `confluence_url`). If it fails, carry on and mention it in `notes`.

## 2. Fill the fields

| Field | Type | Rule |
|---|---|---|
| `key` | string | The issue key as Jira returns it. |
| `title` | string | The issue summary, verbatim. |
| `check_type` | `"ui"` \| `"api"` \| `null` | From the issue's **labels** only (case-insensitive exact match on `ui` / `api`). Exactly one of them → that value, lowercase. Both, or neither → `null`, with a note saying which labels were found (e.g. `"labels contain both ui and api"`, `"no ui/api label; labels: [backend, sprint-3]"`). Never derive it from the title, description, components or issue type, even when it looks obvious. |
| `acceptance_criteria` | string[] | Items of the acceptance-criteria section of the description (headed "Acceptance criteria", "AC", "Критерії приймання" or similar). One array element per item, in the issue's order, verbatim text with list markers / numbering stripped. No section → `[]` and a note. Don't derive criteria from the summary or other text. |
| `confluence_url` | string \| `null` | A Confluence page URL that is **literally present** in the issue: in the description (including link targets) or in its remote links. It must be a real URL to a Confluence page (contains `/wiki/`), copied exactly. Never construct a URL from a page title, a short name like `06 §1.4` or a page id from `CLAUDE.md`. None → `null`. Several different ones → the first in the description (then remote links), and list the others in `notes`. If the issue names a doc page without linking it, say so in `notes`. |
| `notes` | string[] | Short, factual notes on anything missing, ambiguous or dropped: the reasons for each `null` / `[]`, extra Confluence links, unreadable remote links, AC items that are unclear or merged. `[]` if nothing to note. |

## 3. Output

Output exactly one fenced `json` block with the object below and nothing else, no text before or after. Keep field order. Write `notes` in the user's language; everything else stays as in the issue.

```json
{
  "key": "SKY-1",
  "title": "…",
  "check_type": null,
  "acceptance_criteria": ["…", "…"],
  "confluence_url": "https://dragan1925.atlassian.net/wiki/spaces/SD1/pages/491521",
  "notes": ["Є обидві мітки: ui та api — check_type = null."]
}
```
