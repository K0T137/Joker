Apply a fix or small change: $ARGUMENTS

No planning phase. Goes straight to coder → tester → reviewer.
Use this for bug fixes, small tweaks, and single-file changes where the task is unambiguous.
For anything touching 3+ files or requiring design decisions, use /pipeline instead.

---

## Step 1 — Git checkpoint

```bash
git stash
```

Tell the user: "Working tree stashed. Run `git stash pop` to restore if anything goes wrong."

If the working tree is already clean, note that and skip the stash.

---

## Step 2 — Coder

Invoke the `coder` subagent with:
```
Task (no plan file — implement directly from this description):
$ARGUMENTS

Read the relevant files first. Follow existing patterns. Run tests after.
```

If tests fail or build fails:
- STOP. Show the errors to the user.
- Ask: "Tests/build failed. Fix and retry, or abandon? (fix / abandon)"
- If fix: re-invoke coder with the specific errors. Continue.
- If abandon: run `git stash pop` and stop.

---

## Step 3 — Tester

Invoke the `tester` subagent with:
```
The following fix was just applied. Run all tests and return your verdict.
Task: $ARGUMENTS
```

If verdict is **FAIL**:
- Invoke `coder` with the tester's required fixes and new test file paths
- Invoke `tester` one more time
- If still FAIL: STOP and report to user. Ask: "Fix manually or abandon? (fix / abandon)"
  - If abandon: run `git stash pop` and stop.

If verdict is **PASS**: continue.

---

## Step 4 — Reviewer

Invoke the `reviewer` subagent with:
```
Review this fix. No plan file — evaluate against the task description and existing code quality.
Task: $ARGUMENTS
```

If **REJECTED**:
- Show required fixes to user
- Ask: "Fix and re-review, or abandon? (fix / abandon)"
- If fix: invoke `coder` with reviewer's fixes → invoke `tester` → invoke `reviewer` once more
- If still REJECTED or abandoned: run `git stash pop` and stop.

If **APPROVED**: continue.

---

## Step 5 — Final report

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 FIX COMPLETE
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 Task:   $ARGUMENTS
 Status: APPROVED
 Score:  X/10

 Files changed:
 [list from coder output]
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

Ask: "Commit? (yes / no)"
- If yes: stage changed files, commit with a descriptive message, offer to push.
- If no: leave uncommitted.
