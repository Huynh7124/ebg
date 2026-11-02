# Codex Working Rules

Goal: minimize unnecessary context and tool output without sacrificing correctness.

- Start with `docs/ai-context/MODULE_MAP.md` to identify likely paths; consult `ARCHITECTURE.md` only for cross-module tasks.
- Search filenames and symbols before reading file bodies. Read only relevant ranges and immediate dependencies.
- Do not dump entire directories, lockfiles, generated assets, or long logs into context.
- Trust current source over potentially stale documentation; expand exploration when evidence is insufficient.
- Make minimal scoped edits. Do not refactor unrelated code or add dependencies without reason.
- Run focused tests first; report what was and wasn't verified.
- Keep final replies short: summary, changed files, tests, blockers. Do not paste unchanged code.
- Update module map only when paths or responsibilities change; update decisions only for consequential architectural choices.
- For exploration, implementation, or debugging, consult the matching `.agents/skills/*/SKILL.md` if available. These are repository guidance even if skill auto-discovery is unavailable.

## Automatic Workflow (No Repeated Prompts Required)

For every task, apply these rules automatically without requiring the user to say "Follow AGENTS.md":
- Infer whether the task is exploration, implementation, or debugging; consult the matching skill guidance only when useful.
- Consult `docs/ai-context/MODULE_MAP.md` only when it helps locate relevant code; do not read every context document by default.
- Search only relevant files and dependencies; expand scope when correctness or safety requires it.
- Make minimal, targeted changes and avoid unrelated refactoring.
- Run focused tests or checks when appropriate; disclose tests not run.
- Keep responses concise and avoid pasting code already shown in diffs.
- Do not ask the user to repeat these standing instructions.
- Follow explicit task instructions when they override optional workflow preferences.
