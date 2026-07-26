# Skill Registry

Generated: 2026-07-26 | Scope: real-state-app-frontend | Mode: engram

## User Skills (global)

| Skill                | Trigger                                                                                                                                                                                                                                                                                                                                                                                            | Path                                                      |
| -------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------- |
| branch-pr            | Create Gentle AI pull requests with issue-first checks. Trigger: creating, opening, or preparing PRs for review.                                                                                                                                                                                                                                                                                   | `~/.config/opencode/skills/branch-pr/SKILL.md`            |
| chained-pr           | Trigger: PRs over 400 lines, stacked PRs, review slices. Split oversized changes into chained PRs that protect review focus.                                                                                                                                                                                                                                                                       | `~/.config/opencode/skills/chained-pr/SKILL.md`           |
| cognitive-doc-design | Design docs that reduce cognitive load. Trigger: writing guides, READMEs, RFCs, onboarding, architecture, or review-facing docs.                                                                                                                                                                                                                                                                   | `~/.config/opencode/skills/cognitive-doc-design/SKILL.md` |
| comment-writer       | Write warm, direct collaboration comments. Trigger: PR feedback, issue replies, reviews, Slack messages, or GitHub comments.                                                                                                                                                                                                                                                                       | `~/.config/opencode/skills/comment-writer/SKILL.md`       |
| customize-opencode   | Use ONLY when the user is editing or creating opencode's own configuration: opencode.json, opencode.jsonc, files under .opencode/, or files under ~/.config/opencode/. Also use when creating or fixing opencode agents, subagents, skills, plugins, MCP servers, or permission rules. Do not use for the user's own application code, or for any project that is not configuring opencode itself. | `<built-in>`                                              |
| go-testing           | Trigger: Go tests, go test coverage, Bubbletea teatest, golden files. Apply focused Go testing patterns.                                                                                                                                                                                                                                                                                           | `~/.config/opencode/skills/go-testing/SKILL.md`           |
| issue-creation       | Create Gentle AI issues with issue-first checks. Trigger: creating GitHub issues, bug reports, or feature requests.                                                                                                                                                                                                                                                                                | `~/.config/opencode/skills/issue-creation/SKILL.md`       |
| judgment-day         | Trigger: judgment day, dual review, adversarial review, juzgar. Run explicit blind dual review with at most two scoped fix/re-judgment rounds.                                                                                                                                                                                                                                                     | `~/.config/opencode/skills/judgment-day/SKILL.md`         |
| skill-creator        | Trigger: new skills, agent instructions, documenting AI usage patterns. Create LLM-first skills with valid frontmatter.                                                                                                                                                                                                                                                                            | `~/.config/opencode/skills/skill-creator/SKILL.md`        |
| skill-improver       | Trigger: improve skills, audit skills, refactor skills, skill quality. Audit and upgrade existing LLM-first skills.                                                                                                                                                                                                                                                                                | `~/.config/opencode/skills/skill-improver/SKILL.md`       |
| work-unit-commits    | Plan commits as reviewable work units. Trigger: implementation, commit splitting, chained PRs, or keeping tests and docs with code.                                                                                                                                                                                                                                                                | `~/.config/opencode/skills/work-unit-commits/SKILL.md`    |

## Project Skills

None found under `real-state-app-frontend/skills/`, `.opencode/skills/`, `.claude/skills/`, `.github/skills/`, `.atl/skills/`, or similar project-level skill paths.

## SDD Pipeline Skills (managed — do not invoke directly)

The following SDD skills are installed at the user level and managed by the orchestrator. They are listed here for awareness but are NOT intended for manual invocation:

- `sdd-init` — SDD initialization
- `sdd-explore` — SDD exploration
- `sdd-propose` — Change proposal
- `sdd-spec` — Delta specifications
- `sdd-design` — Technical design
- `sdd-tasks` — Task breakdown
- `sdd-apply` — Implementation
- `sdd-verify` — Verification
- `sdd-archive` — Archive closure
- `sdd-onboard` — SDD workflow onboarding

## Convention Files

No project-level `AGENTS.md`, `CLAUDE.md`, `.cursorrules`, `GEMINI.md`, or `copilot-instructions.md` found.

## Usage

Sub-agents receive the exact SKILL.md path above and read the full skill source of truth directly.
