# Aletheia agent entry point

Read and follow [`docs/agents/engineering-guide.md`](docs/agents/engineering-guide.md) before making changes in this repository.

## Linear issue engineering workflow

Treat the templates below as persistent instructions. The user does not need to
paste them for every issue. Replace `<ISSUE-ID>` with the active Linear issue;
`ALE-52` is only an example, never a default.

### Starting implementation

When the user explicitly asks to start or implement a new Linear issue,
retrieve and read the complete issue first. Then treat the request as:

> Implement `<ISSUE-ID>` according to its Linear issue.
>
> Use `$engineering-loop` throughout the development:
>
> - establish the change contract and risk tier before implementation;
> - follow the repository engineering guide;
> - use TDD;
> - preserve unrelated changes;
> - do not mark the issue complete yet.

Before editing for a new issue, synchronize local `main`, create an
industry-standard issue-prefixed branch without `codex` in its name, and
inspect the applicable repository instructions, implementation, tests, and
acceptance criteria. When continuing an already-active issue, remain on its
existing branch and re-read its current Linear scope before editing. A request
for status, explanation, planning, or the next issue does not authorize
implementation.

### Verifying completed development

When the user asks to "verify the development", perform a final audit, or
confirm completion, resolve the active issue from the request, branch, and
progress record. Then treat the request as:

> `$engineering-loop` Perform the final pre-merge audit for `<ISSUE-ID>`.
>
> Before confirming completion:
>
> 1. Re-read the Linear acceptance criteria.
> 2. Inspect the complete diff against the merge base.
> 3. Select the final risk tier.
> 4. Review correctness, architecture, security, privacy, reliability,
>    performance, memory, cost, compatibility, and regression risks.
> 5. Run every relevant repository-native check.
> 6. Correct material findings and rerun affected checks.
> 7. Update `<ISSUE-ID>` with dated evidence, skipped or blocked checks,
>    remaining risks, and rollout/rollback information.
> 8. Mark the issue complete only if the acceptance criteria and relevant
>    checks pass with no unresolved material findings.

For phased issues, audit only the phase requested. Do not mark the parent issue
complete until every phase and parent-level acceptance criterion is satisfied.
If the active issue cannot be resolved unambiguously, ask the user before
changing code or Linear state.
