# Historical Product Evidence

Material kept for product history and recovery evidence. **None of it is gameplay authority.**

Authority for gameplay meaning is `Game_rules.md` alone (see `docs/CHANGE_GOVERNANCE.md`). Current verified behaviour is described in `docs/LIVING_STATUS.md` and `docs/ARCHITECTURE.md`.

## Rule provenance anchor

`Game_rules.md` records the original recovered snapshot as:

```text
source snapshot: 021a30d8-bad8-40d0-9289-26e765ba2e85.md
SHA-256:         2fdbe99c64b6c4a910ea57c1887b0d2db9327d616feafe476bf0a41073f235c0
```

That snapshot, the Foundation Report and any legacy registry strings are evidence of what was recovered — not authority. The current canonical file is maintained by owner-approved rule slices with permanent rule IDs.

## Preservation inventory

| Evidence | Location | Why it is kept | Classification |
|---|---|---|---|
| Approved V4 Web template (visual/UX source) | `reference/approved-v4-template.html` | Product visual source; defines the approved UI/UX direction and card presentation | `COMPATIBILITY REFERENCE` |
| Legacy canonical Web board runtime | `packages/legacy-runtime` | Retained only for the fixture-preview `runtimeMode: 'legacy-compatibility'` branch and its own tests | `COMPATIBILITY REFERENCE` |
| Recovery/forensic fix plan | `chaosfixplan.md` | Historical repair plan and audit trail; superseded as roadmap by `PLAN.md` | `COMPATIBILITY REFERENCE` |
| Requirements baseline | `REQUIREMENTS.md` | Original product requirements | `COMPATIBILITY REFERENCE` |
| Authentication design/audit/verification notes | `AUTH.md`, `AUTH_AUDIT.md`, `AUTH_VERIFICATION.md` | Historical auth evidence predating the locked account model | `COMPATIBILITY REFERENCE` |
| Recovery scope and checkpoint notes | `docs/RECOVERY_SCOPE.md`, `docs/visual-integration-checkpoint.md` | Recovery evidence | `COMPATIBILITY REFERENCE` |
| Rule-decision records | `docs/core-engine-rule-decisions.md`, `docs/social-engine-rule-decisions.md`, `docs/answer-mode-rule-decisions.md`, `docs/timer-timeout-rule-decisions.md`, `docs/safety-control-rule-decisions.md`, `docs/adaptive-card-distribution-rule.md` | Domain detail behind canonical rules and accepted slices | `COMPATIBILITY REFERENCE` |
| Card-system migration evidence | `docs/card-system-*.md`, `docs/card-system-c1-mapping-audit.csv`, `docs/card-system-c3-asset-ingestion.md` | Card/deck migration history | `COMPATIBILITY REFERENCE` |
| Cleanup manifests | `docs/cleanup-manifest.md`, `docs/cleanup-manifest.json` | Records of previously retired artifacts | `COMPATIBILITY REFERENCE` |
| Old product UI, flyers, card art, PNG card packages | external product history | Historical design evidence for the approved look and copy | `COMPATIBILITY REFERENCE` |

## Rules for using this material

- Use it to understand intent, look, copy and history — never to override `Game_rules.md`, current verified source, or an explicit owner decision.
- The old app's UI/UX/theme/layout/assets are the product's visual source; the old app's **browser runtime and game behaviour are not trusted authority**.
- The approved V4 template embeds an inline script. That script must never be copied as runtime authority; only its presentation may be referenced.
- Evidence that contradicts the canonical rules is a signal to fix the implementation, not to rewrite the rules.
- Nothing here authorizes deletion of a surface; removal requires a proven reference check and an authorized cleanup slice.
