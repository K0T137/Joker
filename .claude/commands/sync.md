Audit CLAUDE.md against the current codebase and patch anything stale.

Run this after a significant manual change, or any time you feel CLAUDE.md might have drifted.
The pipeline runs this automatically after every approved run.

---

## Step 1 — Docs agent

Invoke the `docs` subagent with:
```
Audit CLAUDE.md against the current codebase state and patch anything that has drifted.
```

---

## Step 2 — Review

Present the docs agent's "Changes Made" section to the user.

If no changes were needed:
- Report: "CLAUDE.md is up to date. No changes made."
- Stop.

If changes were made:
- Show exactly what changed and why (the evidence cited by docs agent)
- Ask: "Apply these updates to CLAUDE.md? (yes / no / edit)"
  - If yes: the edits are already applied (docs agent used Edit tool). Confirm saved.
  - If no: revert the edits with `git checkout -- CLAUDE.md`
  - If edit: open CLAUDE.md for the user to adjust manually.

---

## Step 3 — Commit (optional)

Ask: "Commit the updated CLAUDE.md? (yes / no)"
- If yes: `git add CLAUDE.md && git commit -m "docs: sync CLAUDE.md with current codebase state"`
- If no: leave staged/unstaged for the user to handle.
