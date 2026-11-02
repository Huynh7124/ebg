---
name: efficient-exploration
description: Locate relevant files, symbols, and dependencies with minimal context usage before implementing a change.
---
# Efficient Exploration
1. Restate the target behavior in one sentence.
2. Check `docs/ai-context/MODULE_MAP.md` for likely directories.
3. Search paths/symbol names; inspect relevant definitions and their direct callers.
4. Read only necessary source ranges. Widen search only if the path is unclear.
5. Return a concise list of files, responsibilities, and risks; do not print full source files.
6. Treat source code as authoritative if the map is outdated.
