Run the full development pipeline for this task: $ARGUMENTS

Work through every step below in order. Never skip a step. Never proceed past a STOP.

---

## Step 1 — Planner (scope + approval gate)

Invoke the `planner` subagent with the task: "$ARGUMENTS"

Present the planner's full output to the user.

If the planner listed Clarifying Questions:
- STOP. Ask the user those questions.
- When answered, re-invoke the `planner` with the original task plus the answers.

Once the planner output has no open questions, ask the user:
> "Planner proposes the above approach. Proceed to architecture? (yes / change: [description])"

If the user says change: incorporate their feedback and re-invoke the `planner`. Repeat until approved.
If the user says yes: continue to Step 2.

---

## Step 2 — Git checkpoint

Before any code is written, create a safe checkpoint:

```bash
cd /path/to/repo && git stash
```

Tell the user: "Working tree stashed. If anything goes wrong, run `git stash pop` to restore."

If the working tree is already clean, note that and skip the stash.

---

## Step 3 — Architect (technical plan)

Invoke the `architect` subagent with:
```
Task: $ARGUMENTS

Approved scope from planner:
[planner output from Step 1]

Write the completed plan to .claude/pipeline-plan.md
```

After the architect finishes, confirm that `.claude/pipeline-plan.md` was written.

Ask the user:
> "Architecture plan written to .claude/pipeline-plan.md. Review it now, or proceed straight to coding? (review / proceed)"

If review: pause here so the user can read the file. Resume when they say proceed.
If proceed: continue to Step 4.

---

## Step 4 — Coder (implementation)

Invoke the `coder` subagent with:
```
Implement the plan in .claude/pipeline-plan.md exactly as written.
```

If the coder reports test failures or build errors:
- STOP. Show the errors to the user.
- Ask: "Tests/build failed. Fix and retry, or abandon pipeline? (fix / abandon)"
- If fix: re-invoke the `coder` with the specific errors to address, then continue.
- If abandon: run `git stash pop` to restore the working tree and stop.

---

## Step 5 — Tester (validation)

Invoke the `tester` subagent with:
```
The plan in .claude/pipeline-plan.md was just implemented. Run all tests, write any missing test cases from the plan, and return your verdict.
```

If verdict is **FAIL**:
  Invoke the `coder` subagent with:
  ```
  The tester found failures. Fix only the listed issues.
  Files to fix: [tester's list]
  New test files to read first: [tester's list]
  ```
  Then invoke the `tester` again.

  If still **FAIL** after the second attempt:
  - STOP. Show the user the remaining failures.
  - Ask: "Tester still failing after retry. Fix manually, or abandon? (fix / abandon)"
  - If abandon: run `git stash pop` and stop.

If verdict is **PASS**: continue to Step 6.

---

## Step 6 — Reviewer (final gate)

Invoke the `reviewer` subagent with:
```
Review the implementation against the plan in .claude/pipeline-plan.md
```

If verdict is **REJECTED**:
  Show the user the required fixes.
  Ask: "Reviewer rejected. Fix and re-review, or abandon? (fix / abandon)"

  If fix:
  - Invoke `coder` with the reviewer's required fixes
  - Invoke `tester` to confirm tests still pass
  - Invoke `reviewer` one final time
  - If rejected again: STOP and report to user — do not loop further.

  If abandon: run `git stash pop` and stop.

If verdict is **APPROVED**: continue to Step 7.

---

## Step 7 — Sync docs

Invoke the `docs` subagent with:
```
The following feature was just implemented and approved. Audit CLAUDE.md and patch anything that has drifted.
Task completed: $ARGUMENTS
```

If the docs agent made changes, show the user what changed and why.
If no changes were needed, note "CLAUDE.md already up to date."

---

## Step 8 — Final report

Present to the user:

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 PIPELINE COMPLETE
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 Task:    $ARGUMENTS
 Status:  APPROVED
 Score:   X/10

 Files changed:
 [list from coder output]

 CLAUDE.md: updated / already up to date
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

Ask: "Commit everything? (yes / no)"
- If yes: stage all changed files including CLAUDE.md, commit with a descriptive message, and offer to push.
- If no: leave uncommitted.

Clean up: delete `.claude/pipeline-plan.md` after a successful commit.
