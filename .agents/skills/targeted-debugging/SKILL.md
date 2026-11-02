---
name: targeted-debugging
description: Diagnose reproducible errors by tracing evidence and the smallest relevant code path instead of scanning the whole repository.
---
# Targeted Debugging
1. Capture the exact symptom, error message, and reproduction steps.
2. Find the failing function, endpoint, or component from logs/stack trace.
3. Inspect the immediate call path and configuration; expand only if needed.
4. Form and test one or two evidence-based hypotheses.
5. Fix the root cause with a targeted regression test where practical.
6. Report cause, fix, verification, and any uncertainty concisely.
