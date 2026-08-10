# Core engine rule decisions

This document records the Phase 1 gameplay decisions that were implemented from the cleaned repository sources, and it marks where the canonical Bible v5 is still needed before a rule should be treated as locked.

## Source gap

The cleaned repository does not currently include `Cribbit_CHAOS_Canonical_Master_Bible_v5_FINAL.pdf`.

The Bible v5 PDF has now been reviewed externally to the repository. The relevant canonical findings are recorded here, but the PDF itself is not stored in git.

## Rule matrix

| Rule | Source file | Source section / reference | Implementation | Configurable? | Confidence | Open question |
| --- | --- | --- | --- | --- | --- | --- |
| Starting hand count | `Canonical Master Bible v5` | `Balancing Knobs` | `GameConfig.startingHandCount` remains configurable. Default `7` is an implementation default only. | Yes | CANONICAL that it is configurable | Default remains provisional |
| Draw penalty | `Canonical Master Bible v5` | `Balancing Knobs` | `GameConfig.drawPenalty` remains configurable. Default `2` is an implementation default only. | Yes | CANONICAL that it is configurable | Default remains provisional |
| Voluntary draw | `reference/approved-v4-template.html` | `commandDrawCard` flow | `GameConfig.allowVoluntaryDraw` defaults to `false`; when false, draw is rejected if a legal play exists | Yes | Medium | Bible v5 did not lock this detail as canonical behavior |
| Initial discard choice | `reference/approved-v4-template.html` | `starterCardFromDeck` / game-start sequence | `GameConfig.initialDiscardStrategy` is a provisional implementation strategy. Current supported values: `FIRST_NUMBER_CARD` and `TOP_SHUFFLED_CARD`. | Yes | Medium | Bible v5 did not establish the starter-discard rule as final canon |
| Turn advancement after Draw | `Canonical Master Bible v5` and approved V4 flow | Authoritative loop / draw effect behavior | Draw resolves an effect, then turn resolution follows the configured `drawPenaltySkipsTurn` rule. | Yes | CANONICAL that the effect exists; provisional on whether the penalized player keeps the turn | Bible v5 does not lock the turn-return detail |
| Draw target behavior | `Canonical Master Bible v5` and approved V4 flow | Authoritative loop / draw effect behavior | The next player receives the draw penalty. Whether that player becomes active is controlled by `GameConfig.drawPenaltySkipsTurn`. | Yes | CANONICAL that the next player draws; provisional on the turn outcome | Bible v5 does not lock the turn-return detail |
| Two-player Reverse behavior | `Canonical Master Bible v5` | `Player-count modes` | Reverse in a two-player game behaves as a turn-return effect. | No | CANONICAL / HIGH | None for this slice |
| Number-card matching | `reference/approved-v4-template.html` | `resolvePlayedCard` matching rules | Number cards are legal when color or symbol/value matches the active discard state | No | High | None for the core slice |
| Skip | `reference/approved-v4-template.html` | `resolvePlayedCard` skip branch | Skip advances past the next player and records a skip event | No | High | None for the core slice |
| Reverse | `Canonical Master Bible v5` and approved V4 flow | `resolvePlayedCard` reverse branch | Reverse flips turn direction and, in a two-player game, acts as a turn-return effect. | No | High | None for the core slice |
| Wild | `reference/approved-v4-template.html` | `resolvePlayedCard` wild branch | Wild enters `PENDING_WILD_COLOR` and pauses the turn until color selection | No | High | None for the core slice |
| Wild color selection | `reference/approved-v4-template.html` | `commandSelectWildColor` flow | The actor who played Wild chooses the active color, then the turn completes | No | High | None for the core slice |
| Zero-card win | `REQUIREMENTS.md` | `R5 — Game core` | Empty hand on resolution ends the game and records the winner | No | High | None for the core slice |
| Command actor identity | `REQUIREMENTS.md` | `R3 — Multiplayer authority` | Gameplay commands validate against `command.playerId`, not against `state.currentPlayerId` alone | No | High | None; this is a required authority boundary |
| Command idempotency | `REQUIREMENTS.md` | `R13 — Idempotency` | `processedCommands` stores a command fingerprint keyed by `commandId`, `playerId`, and payload shape; successful and failed attempts both become safe replays, and changed payloads collide instead of being reused | No | High | API persistence may later own deeper historical replay if we need it |
| Event privacy boundary | `REQUIREMENTS.md` | `R14 — Security` plus multiplayer transport scope | `GameEvent.visibility` marks hand-reveal events as `PLAYER_PRIVATE`; those events carry `playerId`, `targetPlayerId`, and related payload data so the future projection layer can filter by actor/recipient before broadcast | Yes at the projection layer | High | The eventual Socket.IO projection should enforce this filter before emitting to other players |

## Notes

- `startingHandCount`, `drawPenalty`, `drawPenaltySkipsTurn`, and `allowVoluntaryDraw` remain configuration knobs.
- `CARD_DEALT`, `CARD_DRAWN`, and `DRAW_EFFECT_APPLIED` are the current private-reveal event classes.
- This slice intentionally does not implement the social-card families, safety cards, or multiplayer transport.
