# Change Governance

How Cribbit CHAOS decides what the product does, and how that decision becomes code.
This document records process only; it never defines gameplay behaviour.

## Authority chain

```text
explicit owner-approved decision
-> Game_rules.md            (canonical gameplay meaning, permanent rule IDs)
-> rule / decision docs     (the domain detail behind a rule)
-> PLAN.md + docs/LIVING_STATUS.md  (sequence and verified status)
-> packages/contracts, packages/game-engine, packages/cards   (implementation)
-> clients (apps/web, apps/telegram)                          (presentation only)
-> tests, then verified runtime behaviour
```

Never reverse this chain. `RULE-PROVENANCE-002` and `RULE-PROVENANCE-003` in `Game_rules.md` state the same requirement.

Consequences:

- Current runtime behaviour, legacy registry strings, card art, screenshots and outdated documents are evidence, never rule authority (`RULE-PROVENANCE-004`, `RULE-PROVENANCE-005`).
- If implementation contradicts `Game_rules.md`, the implementation is wrong until the rule itself is explicitly changed (`RULE-PROVENANCE-006`).
- Gameplay meaning must not be restated as competing truth in `README.md`, `PLAN.md`, `AGENTS.md`, `docs/LIVING_STATUS.md`, `docs/ARCHITECTURE.md`, `docs/DATABASE.md`, `docs/BUTTON_MAP.md`, `docs/PRODUCT_SCOPE.md` or any client/UI document. Those documents may cite rule IDs and explain ownership; the meaning lives in `Game_rules.md`.

## Rule IDs

- Every canonical gameplay clause carries a permanent ID (`RULE-<FAMILY>-<NNN>`), recorded as an annotation comment next to the clause.
- IDs are permanent: never regenerated, never resequenced, never reused with different meaning.
- Superseded clauses keep their ID and are recorded in the supersession register at the top of `Game_rules.md`.
- Clarification and supersession are different: a clarification keeps the old clause active and adds the new one; a supersession retires part or all of the old clause. Both must be recorded.
- Executable tests and claimed locked behaviour must cite an active rule ID; unresolved-only IDs must not be used to justify an assertion.
- Examples inside `Game_rules.md` are illustrative and are not independent rule authority.

## Change protocol for a gameplay rule (from `RULE-RULE-CHANGES-001`..`004`)

1. show the proposed changed wording first;
2. identify exactly which old rule is superseded or clarified;
3. receive explicit owner approval;
4. update the canonical rule file (`Game_rules.md`) first;
5. only then synchronize implementation, tests and living documents.

A rule slice keeps the rule-file mutation separate from the implementation mutation.

## Preservation classifications

Use these labels whenever documenting or auditing existing code, assets or documents.

| Class | Meaning | Required action |
|---|---|---|
| `ACTIVE` | Verified current behaviour or an in-use capability | Keep; keep documented; keep tested |
| `REPLACED` | Superseded by a newer implementation that is now authoritative | Repoint callers, then remove or explicitly justify retention |
| `UNMIGRATED` | In product scope but not yet wired in the current source | Preserve; keep documented as pending; never delete as dead |
| `COMPATIBILITY REFERENCE` | Retained only to keep an existing caller, fixture or migration working | Document the exact caller and the condition that removes it |
| `DEAD / SAFE TO REMOVE` | Proven to have zero live callers or references | Remove in an authorized cleanup slice; record the evidence first |
| `UNKNOWN — PRESERVE` | Ownership or callers not yet proven | Preserve and document as an unknown; never delete on a guess |

Unmigrated is not dead. A capability is `DEAD / SAFE TO REMOVE` only after reference and caller checks prove it unused.

## Mandatory gates before a slice is accepted

- the canonical rule file was updated before the implementation when gameplay meaning changed;
- the shared engine (never a client) implements gameplay;
- tests exist for the behaviour that changed, and superseded tests were replaced rather than weakened;
- `git diff --check` is clean and the diff matches the declared target list;
- `npm run typecheck`, `npm test`, `npm run lint`, `npm run audit:ui` and the relevant builds ran and passed;
- `README.md`, `PLAN.md`, `AGENTS.md`, `HANDOFF.md` and `docs/LIVING_STATUS.md` agree with verified reality;
- runtime claims are verified against a running system, or reported as NOT VERIFIED.

## Future: AUTHORITY-GUARD-1 (direction only — NOT implemented)

The repository already pins the canonical rule file (`packages/cards/test/game-rules-authority.test.ts` checks its SHA-256 and a set of rule IDs) and checks that deck documentation agrees with the canonical deck. The intended next governance step is a CI-enforced Authority Guard that would:

- require an active rule ID for every claimed locked behaviour and for executable assertions about gameplay;
- resolve cited IDs against the active register in `Game_rules.md`;
- reject missing, retired or unresolved-only IDs in executable assertions;
- reject gameplay semantics restated as authority in non-canonical documents;
- require a recorded owner decision before canonical rule wording changes;
- keep the canonical rule-file pin updated only by an owner-approved rule slice.

This is a recorded direction, not a current capability. Do not implement it, and do not describe it as existing, until the owner authorizes `AUTHORITY-GUARD-1`.
