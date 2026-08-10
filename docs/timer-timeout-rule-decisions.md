# Timer and timeout rule decisions

This document records the Phase 3C authoritative timer slice now implemented in the reducer. The engine owns timer metadata, but the authoritative clock still comes from server-supplied `now` values on commands and setup.

| Rule | Source | Implementation | Visibility | Content storage | Configurable? | Confidence | Open question |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Clock ownership | Phase 3C brief and repository governance | The pure engine does not read wall-clock time. It only evaluates timer deadlines against explicit `now` values supplied by the server or test harness. | Snapshot state carries the deadline so clients can reconstruct countdowns later. | No content beyond timer metadata. | No | HIGH | None |
| Timer shape | Phase 3C brief | `GameState.timer` stores `purpose`, `ownerPlayerId`, `startedAt`, `deadlineAt`, and `startedAtRevision`. This is the single authoritative timer slot; the engine does not create parallel timer systems. | Serializable in snapshots and reconnect-ready later. | No hidden payload. | No | HIGH | Future timer categories may still need separate config, but not separate timer containers |
| Time source | Phase 3C brief | `GameCommandContext.now` is the authoritative input for timer creation and timeout resolution. `createGame` accepts an optional context now for the initial turn timer. | Server-side only | No content | No | HIGH | Whether future server layers surface a separate monotonic clock is deferred |
| Duration config | Phase 3C brief, approved V4 reference pacing | `GameConfig.turnTimeoutMs` and `GameConfig.socialTimeoutMs` are balancing/configuration values. The defaults are provisional and live in the engine setup helper. | Not directly exposed in gameplay events. | No content | Yes | MEDIUM | Canonical durations are not locked in the supplied brief |
| Timer identity | Phase 3C brief | `expectedRevision` identifies the current authoritative game state, while `timerStartedAtRevision` identifies the specific live timer instance. Social timers may survive intermediate state revisions, and replacement timers always get a new identity. | Internal state only | No content | No | HIGH | None |
| Timeout commands | Phase 3C brief and existing command contract | The reducer handles `TIMEOUT_TURN` and `TIMEOUT_SOCIAL` as authoritative timeout commands. The command actor id remains a provisional server-actor convention because the existing command envelope is player-scoped; authorization still belongs to the server. Each timeout command carries `timerStartedAtRevision` so the reducer can reject stale callbacks before any timeout behavior runs. | Public event surface is minimal. | No content | No | HIGH | A future transport contract may add a dedicated system actor if needed |
| Early timeout | Phase 3C brief | If authoritative `now` is before `deadlineAt`, the timeout command fails with `TIMEOUT_NOT_REACHED` and does not mutate gameplay state. Failed timeout commands are cached for replay safety. | Private failure only | No content | No | HIGH | None |
| Stale timeout | Phase 3C brief | If `timerStartedAtRevision` does not match the live timer identity, the command fails with `STALE_TIMEOUT`. Rewind, pass, answer completion, duel response resolution, or any explicit timer replacement invalidate the old timer; merely advancing through a live social interaction does not. | Private failure only | No content | No | HIGH | None |
| Truth/Dare | Phase 3B brief plus Phase 3C timeout brief | Unresolved Truth/Dare answer timeouts close the social interaction without inventing answer content. The reducer records a private timeout event, resolves the social boundary, and preserves the delayed final-card win rule. | Public timeout event is minimal; answer content stays private. | No answer content is stored or emitted publicly. | No | HIGH | Whether future UI should visually distinguish timeout vs pass is deferred to presentation |
| Paranoia | Phase 2 brief and Phase 3C timeout brief | Paranoia timeout resolves safely without exposing hidden prompt content or inventing a fake target. The engine does not synthesize a public candidate list. | Public timeout event is minimal; private prompt data remains hidden. | No hidden prompt content stored in timeout events. | No | MEDIUM | Exact public recap wording remains a presentation decision |
| Duel | Phase 2/3 brief and Phase 3C timeout brief | Duel timeout closes the active Duel interaction without inventing a winner, loser, or score penalty. Any pending Nope/reaction state is cleared as part of the terminal social resolution boundary. | Public timeout event is minimal; participant-private reaction data remains private. | No invented Duel score or winner data. | No | HIGH | Canonical scoring for later Duel subrules is still deferred |
| Chaos | Phase 2/3 brief | Chaos `targeting='all'` preserves already-completed participant records and marks remaining required participants complete through the same safe timeout boundary. The engine resolves only once the authoritative completion set is satisfied. | Public timeout event is minimal; participant records stay private. | No answer-content leak. | No | HIGH | Additional Chaos scripting families remain deferred |
| Answer privacy | Phase 3B brief and repository governance | Timeout events never expose typed answers, chosen options, transcripts, or audio content. Private answer-state fields remain in authoritative state only until resolution. | PUBLIC timeout events are minimal; player-private filtering remains intact. | No public content capture. | No | HIGH | None |
| Pass interaction | Phase 2/3 brief | A successful Pass replaces the live timer boundary for that interaction. A timeout aimed at the earlier boundary then fails because the authoritative timer has moved on, while the Pass itself remains private. | Private or public as already defined by the social command. | No new content. | No | HIGH | None |
| Rewind interaction | Phase 2/3 brief | Rewind replaces the prompt and starts a fresh social timer for the replacement prompt when the command is timed. The old timer cannot resolve the new prompt. | Prompt-rewind metadata stays private. | No prompted content in timeout events. | No | HIGH | Exact future presentation behavior for rewound prompts remains provisional |
| Flag interaction | Phase 2/3 brief | Flag is moderation-only. It does not stop, reset, or resolve timers unless a later canon layer explicitly says otherwise. | Private flag metadata only. | No flag reason in timeout events. | No | HIGH | None |
| Nope interaction | Phase 2/3 brief and approved V4 pacing | The Duel reaction window is timer-aware through the broader social timer. When the social deadline expires, the pending Nope window does not remain dangling. The reducer does not emit countdown ticks. | Private reaction metadata only. | No card/content leak. | No | MEDIUM | Whether other social cards should become Nope-eligible remains open |
| Delayed final-card win | Phase 1/2 brief | Timeout resolution uses the same authoritative social-resolution boundary as other social completions. If the actor empties their hand, the win is still delayed until the boundary resolves. | Public win event only at the boundary. | No extra content. | No | HIGH | None |

## Canonical timer contract

- The reducer owns timer metadata, but not wall-clock time
- `GameState.timer` is the single authoritative timer slot
- `GameCommandContext.now` is required for timeout evaluation
- `timerStartedAtRevision` is the semantic timer identity carried by timeout commands
- `turnTimeoutMs` and `socialTimeoutMs` are balancing/configuration values, not immutable canon
- `TIMEOUT_TURN` and `TIMEOUT_SOCIAL` are replay-safe commands
- `TIMEOUT_NOT_REACHED` protects early timeout attempts
- `STALE_TIMEOUT` protects replacement interactions and stale timer identities
- PUBLIC timeout events stay minimal and privacy-preserving

## Deferred by design

- multiplayer transport wiring
- reconnect transport wiring
- future timer categories beyond the Phase 3C slice, if later canonized separately
