# Core engine rule decisions

This document records the Phase 1 gameplay decisions that were implemented from the cleaned repository sources, and it marks where the canonical Bible v5 is still needed before a rule should be treated as locked.

## Source gap

The cleaned repository does not currently include `Cribbit_CHAOS_Canonical_Master_Bible_v5_FINAL.pdf`.

That means the approved V4 HTML and the existing requirements file are useful implementation references, but they do not by themselves settle every ambiguous card rule. Bible v5 still needs to be reintroduced or otherwise verified before ambiguous behavior is treated as final canon.

## Rule matrix

| Rule | Source file | Source section / reference | Implementation | Configurable? | Confidence | Open question |
| --- | --- | --- | --- | --- | --- | --- |
| Starting hand count | `REQUIREMENTS.md` | `R5 — Game core` plus approved V4 hero copy / setup flow in `reference/approved-v4-template.html` | `GameConfig.startingHandCount` defaults to `7` and is used by `createGame` when dealing hands | Yes | Medium | Bible v5 needed to confirm whether 7 is canon or just the current balance default |
| Draw penalty | `reference/approved-v4-template.html` | `resolvePlayedCard` draw effect section | `GameConfig.drawPenalty` defaults to `2` and is used when a Draw card resolves | Yes | Medium | Bible v5 needed to confirm whether 2 is canon or provisional |
| Voluntary draw | `reference/approved-v4-template.html` | `commandDrawCard` flow | `GameConfig.allowVoluntaryDraw` defaults to `false`; when false, draw is rejected if a legal play exists | Yes | Medium | Bible v5 needed to confirm whether voluntary draw is canon or a balance knob |
| Initial discard choice | `reference/approved-v4-template.html` | `starterCardFromDeck` / game-start sequence | `pickStarterCard` selects the first numbered card in the shuffled deck, falling back to the last card if needed | No for the current rule path; fallback is defensive | Medium | Bible v5 needed to confirm whether this is the intended authoritative starter selection rule |
| Turn advancement after Draw | `reference/approved-v4-template.html` | `commandDrawCard` | Drawing one card immediately advances the turn in the reducer | No | High | None yet; this matches the approved reference flow |
| Draw target behavior | `reference/approved-v4-template.html` | `resolvePlayedCard` draw effect section | The next player receives the draw penalty and then the turn advances | No | High | None yet; this matches the approved reference flow |
| Two-player Reverse behavior | `reference/approved-v4-template.html` | `resolvePlayedCard` reverse branch | Reverse uses `2` steps in a 2-player game so the same player effectively gets the turn again | No | High | Bible v5 should confirm whether this is locked canon or only an approved V4 convention |
| Number-card matching | `reference/approved-v4-template.html` | `resolvePlayedCard` matching rules | Number cards are legal when color or symbol/value matches the active discard state | No | High | None for the core slice |
| Skip | `reference/approved-v4-template.html` | `resolvePlayedCard` skip branch | Skip advances past the next player and records a skip event | No | High | None for the core slice |
| Reverse | `reference/approved-v4-template.html` | `resolvePlayedCard` reverse branch | Reverse flips turn direction and advances accordingly | No | High | None for the core slice, aside from the Bible-v5 confirmation noted above |
| Wild | `reference/approved-v4-template.html` | `resolvePlayedCard` wild branch | Wild enters `PENDING_WILD_COLOR` and pauses the turn until color selection | No | High | None for the core slice |
| Wild color selection | `reference/approved-v4-template.html` | `commandSelectWildColor` flow | The actor who played Wild chooses the active color, then the turn completes | No | High | None for the core slice |
| Zero-card win | `REQUIREMENTS.md` | `R5 — Game core` | Empty hand on resolution ends the game and records the winner | No | High | None for the core slice |
| Command actor identity | `REQUIREMENTS.md` | `R3 — Multiplayer authority` | Gameplay commands validate against `command.playerId`, not against `state.currentPlayerId` alone | No | High | None; this is a required authority boundary |
| Command idempotency | `REQUIREMENTS.md` | `R13 — Idempotency` | `processedCommands` stores a command fingerprint keyed by `commandId`, `playerId`, and payload shape; exact replays return a safe replay response without reapplying effects | No | High | API persistence may later own deeper historical replay if we need it |
| Event privacy boundary | `REQUIREMENTS.md` | `R14 — Security` plus multiplayer transport scope | `GameEvent.visibility` marks hand-reveal events as `PLAYER_PRIVATE`; the projection layer must filter private events before any broadcast | Yes at the projection layer | High | The eventual Socket.IO projection should enforce this filter before emitting to other players |

## Notes

- `startingHandCount`, `drawPenalty`, and `allowVoluntaryDraw` remain configuration knobs.
- `CARD_DEALT`, `CARD_DRAWN`, and `DRAW_EFFECT_APPLIED` are the current private-reveal event classes.
- This slice intentionally does not implement the social-card families, safety cards, or multiplayer transport.
