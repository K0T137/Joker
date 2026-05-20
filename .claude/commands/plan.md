Run only the planning stages for this task: $ARGUMENTS

This command runs Planner → Architect and stops. No code is written.
Use this when you want to review and iterate on the design before committing to implementation.
When ready to implement, run /pipeline with the same task description.

---

## Step 1 — Planner

Invoke the `planner` subagent with the task: "$ARGUMENTS"

Present the full output to the user.

If clarifying questions exist:
- STOP. Ask the user.
- Re-invoke planner with answers until no open questions remain.

Ask: "Proceed to detailed architecture? (yes / change: [description])"
- If change: re-invoke planner with feedback.
- If yes: continue.

---

## Step 2 — Architect

Invoke the `architect` subagent with:
```
Task: $ARGUMENTS

Approved scope:
[planner output]

Write the completed plan to .claude/pipeline-plan.md
```

After architect finishes, tell the user:
```
Plan written to .claude/pipeline-plan.md

Review it, make any edits you want, then run:
  /pipeline $ARGUMENTS
to proceed with implementation.
```

Stop here.
