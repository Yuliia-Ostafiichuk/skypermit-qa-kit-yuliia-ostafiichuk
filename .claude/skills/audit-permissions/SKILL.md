---
name: audit-permissions
description: Read-only audit of Claude Code permissions. Reads every settings file (user, project, local, managed) and lists dangerous, ineffective or suspicious rules with an explanation and a ready-made fix. Also checks that the read-only protection of ../skypermit actually holds. Use it when asked to check permissions, settings.json or deny rules for safety.
allowed-tools: Read, Glob, Bash(ls *), Bash(cat *), Bash(git ls-files *)
model: sonnet
background: true
context: fork
agent: Explore
---

# Permissions audit

You audit the security of this Claude Code configuration. You **only read and assess**. Don't change any file, even when the fix is obvious. Put fixes in the report as suggestions.

Reply in the user's language.

## 1. Collect every rule source

Read each file that exists. If a file is missing, say so in the report.

| Level | Path |
|---|---|
| User | `~/.claude/settings.json` |
| Project (in git, shared with the team) | `.claude/settings.json` at the repo root |
| Local (personal; "Yes, and don't ask again" writes here) | `.claude/settings.local.json` at the repo root |
| Managed (admin) | macOS: `/Library/Application Support/ClaudeCode/managed-settings.json`; Linux/WSL: `/etc/claude-code/managed-settings.json`; Windows: `C:\Program Files\ClaudeCode\managed-settings.json` |

From each file, record `permissions.allow`, `permissions.ask`, `permissions.deny`, `permissions.defaultMode` (or `defaultMode`), `permissions.additionalDirectories`, `permissions.disableBypassPermissionsMode`, `permissions.disableAutoMode`, and `hooks` if present.

Also read the `allowed-tools` frontmatter of every skill in `.claude/skills/*/SKILL.md` and the `tools` frontmatter of every agent in `.claude/agents/*.md`. These grant tools without a prompt while the skill or agent runs.

Run `git ls-files .claude/settings.local.json`. If git tracks the file, that's a finding of its own: personal permissions get shared with everyone who clones the repo.

Keep these semantics in mind. Without them the audit will be wrong:
- Evaluation order is deny → ask → allow, and the first matching rule decides. A narrower allow does NOT override a broader deny.
- A deny at any level blocks an allow at any other level.
- Bash: `*` matches any text, spaces included. Everything before the first `*` is literal. `:*` equals ` *` only at the end of the rule. A space before `*` is part of the rule.
- Compound commands (`&&`, `||`, `;`, `|`) are checked part by part.
- Paths (Read/Edit) use gitignore syntax: `*` matches within one folder, `**` matches at any depth. `//` is the filesystem root, `~/` is the home folder, a single leading `/` is relative to the settings file's folder (in user settings that's `~/.claude/`!), and `./` or no prefix is the current folder.
- An allow on `Edit(path)` also grants reading. A deny on `Read(path)` also blocks Edit/Write.

## 2. Check every rule against the risk catalog

### CRITICAL: the agent can do anything or leak data
- allow `Bash` or `Bash(*)`: any command without a prompt.
- `defaultMode: "bypassPermissions"` outside a container or VM.
- allow on interpreters and runners that execute arbitrary code: `Bash(python *)`, `Bash(python3 *)`, `Bash(node *)`, `Bash(npx *)`, `Bash(bash *)`, `Bash(sh *)`, `Bash(zsh *)`, `Bash(eval *)`, `Bash(docker exec *)`, `Bash(docker run *)`, `Bash(devbox run *)`, `Bash(mise exec *)`, `Bash(direnv exec *)`.
- allow on network tools: `Bash(curl *)`, `Bash(wget *)`, `Bash(nc *)`, `Bash(ssh *)`, `Bash(scp *)`, `Bash(rsync *)`.
- allow `Bash(sudo *)`, `Bash(su *)`.
- allow Edit/Read on the whole disk or home folder: `Edit(//**)`, `Edit(~/**)`, `Read(//**)`, `Read(~/**)`.
- `additionalDirectories` that contains `/`, `~` or the home folder.

### HIGH: destructive or irreversible actions
- allow `Bash(rm *)`, `Bash(rm -rf *)`, `Bash(git push *)`, `Bash(git reset *)`, `Bash(git clean *)`, `Bash(git checkout *)`, `Bash(chmod *)`, `Bash(chown *)`, `Bash(kubectl *)`, `Bash(terraform *)`, `Bash(aws *)`, `Bash(gcloud *)`, `Bash(az *)`, `Bash(npm publish *)`.
- allow with `*` before the subcommand, or a bare program: `Bash(git *)`, `Bash(npm *)`, `Bash(docker *)`, `Bash(git * main)`. These allow safe and dangerous subcommands alike.
- allow `WebFetch` (bare name) or `WebFetch(domain:*)`: any website.
- allow a whole MCP server that has write tools: `mcp__<server>__*`. Check whether the server can create, delete or send things.
- No deny for secrets: `.env`, `.env.*`, `secrets/**`, `~/.ssh/**`, `~/.aws/**`, `~/.config/gcloud/**`, `*.pem`, `*.key`.
- The combination "reading secrets is allowed + some network egress is allowed" is a leak path.

### MEDIUM: the rule doesn't do what it seems to (false sense of protection)
- A path with a single leading `/` that looks absolute: `Read(/Users/...)`, `Read(/home/...)`, `Read(/etc/...)`. That is NOT the filesystem root. It needs `//`.
- A `/` rule in user settings (`~/.claude/settings.json`) such as `Read(/secrets/**)` protects `~/.claude/secrets`, not a folder in the project.
- Path rules for `Write(...)`, `Glob(...)`, `NotebookEdit(...)`, `MultiEdit(...)` never apply. Use `Edit(...)` / `Read(...)` instead.
- `Bash(command:...)` is ignored.
- `:*` not at the end, e.g. `Bash(git:* push)`: the colon is literal and the rule is dead.
- Unanchored allow globs such as `*`, `B*`, `mcp__*` are ignored and allow nothing.
- `Bash(ls*)`, `Bash(cat*)` without a space are broader than they look (`lsof`, `catdoc`).
- Bash deny rules treated as a wall: `deny Bash(git push *)` doesn't stop `git -C . push`, `/usr/bin/git push` or `sh -c '...'`. Mark it as informational if there's no sandbox.
- An allow exception that tries to "override" a deny: deny `Bash(aws *)` + allow `Bash(aws s3 ls)`. The allow never fires.

### LOW / HYGIENE
- Many one-off rules in `.claude/settings.local.json` piled up by the "don't ask again" button. Worth reviewing.
- Duplicates across levels.
- `disableBypassPermissionsMode` not set (especially for a team project).

## 3. Project-specific check: `../skypermit` must stay read-only

`CLAUDE.md` says `../skypermit` is read-only. Check whether the rules actually enforce that, and report each gap as a finding:
- Is there a deny on `Edit(...)` that covers `../skypermit/**` both by relative path and by absolute `//` path? A deny on `Edit` also covers Write and NotebookEdit. Separate `Write(...)` path rules are dead (MEDIUM).
- Bash deny rules such as `Bash(rm *skypermit/*)` only match when the path is in the command text. Name concrete bypasses: `cd ../skypermit && rm x`, `git -C ../skypermit checkout .`, `sed -i` / `tee` / `>` redirection, `npm install` run inside `../skypermit`. Mark these as informational if there's no sandbox, and suggest a sandbox or a Bash-level hook as the real wall.
- Are there allow rules (in settings, skill `allowed-tools` or agent `tools`) that could write into `../skypermit`? Example: `Bash(rm test-cases/*)` is fine, but `Bash(rm *)` would not be.
- Do the `hooks` commands write anywhere, and can they reach `../skypermit`?

## 4. Report

Start with one sentence of summary: how many files were found and how many findings at each level.

Then one table, sorted from critical to low:

| Risk level | Rule | File and list (allow/ask/deny) | Why it's dangerous (1 sentence, a concrete example command) | How to fix (a ready-made rule) |

Then, separately:
- **What's missing**: recommended deny rules that aren't there, as a ready-to-paste JSON fragment.
- **What's fine**: 1–2 sentences, so the report doesn't suggest that everything is bad.

Rules:
- Don't invent findings. If a rule is safe, leave it out of the table.
- Back every "why" with a concrete command or path that the rule lets through.
- If you're unsure (e.g. an unknown MCP server), mark it "needs checking", not "critical".
- Don't change any files.
