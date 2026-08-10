# Safety control rule decisions

This document records the Phase 3A safety-control slice implemented in the authoritative reducer. It is intentionally narrow: Pass, Rewind, and Flag are controls, not cards, and each one remains server-authoritative.

## Rule matrix

| Rule | Source | Implementation | Visibility | Configurable? | Confidence | Open question |
| --- | --- | --- | --- | --- | --- | --- |
| PASS | Phase 3 brief and approved V4 control language | `PASS_PROMPT` is an authoritative control for active eligible social prompts. Truth and Dare resolve privately for the triggering player; Chaos targeting `all` records each required participant independently and resolves only after the full participant set completes. Pass does not consume a card. Duel pass semantics remain deferred and are rejected rather than invented. | Pass acknowledgments are `PLAYER_PRIVATE`. Resolution events remain public and minimal. | No | HIGH | Duel forfeiture/scoring behavior remains deferred |
| REWIND | Phase 3 brief and legacy private-preview flow | `REWIND_PROMPT` is authoritative for Truth and Dare before the prompt is publicly committed. It uses the injected prompt pool to deterministically choose the first alternate eligible prompt, excludes the current prompt, marks one-per-session usage, and refreshes prompt/presentation metadata privately. | Rewind responses are `PLAYER_PRIVATE`. The rejected prompt is not exposed in public events. | No | HIGH | The exact future reveal boundary may be refined when Phase 3B answer-mode work lands |
| FLAG | Phase 3 brief and moderation guidance | `FLAG_PROMPT` is a moderation signal for the currently authoritative prompt reference. It validates the current prompt exists and that the reporter is a legitimate participant in the active social effect, then emits a private moderation-oriented event without mutating gameplay resolution. Moderation persistence remains deferred. | Flag acknowledgments are `PLAYER_PRIVATE`. Reporter identity, reason metadata, and prompt content are not public. | No | HIGH | Backend persistence / moderation workflow is deferred to later phases |

## Canonical, provisional, deferred

- Canonical: Pass is private; Rewind is once per session for eligible Truth/Dare prompts; Flag is a private moderation signal; none of these are cards.
- Provisional: the precise UX surface for these controls in the clients.
- Deferred: Duel Pass semantics, moderation persistence, and all Phase 3B answer-mode behavior.
