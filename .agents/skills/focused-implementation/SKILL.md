---
name: focused-implementation
description: Implement a requested code change with narrow scope, limited context reads, and focused verification.
---
# Focused Implementation
1. Identify affected entry points and constraints.
2. Inspect only the necessary implementation and adjacent tests.
3. Write a short internal plan for nontrivial changes; avoid lengthy commentary.
4. Change the smallest reasonable surface while maintaining correctness.
5. Run targeted tests or checks; widen validation if the change is cross-cutting.
6. Summarize modified files, behavior, tests, and remaining risks in a few lines.
