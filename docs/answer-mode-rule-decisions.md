# Answer mode rule decisions

This document records the Phase 3B answer-mode slice now implemented in the authoritative reducer. It is intentionally narrow: it covers the answer controls themselves, the privacy boundary around answer content, and the current deferred line for timers.

| Rule | Source | Implementation | Visibility | Content storage | Configurable? | Confidence | Open question |
| --- | --- | --- | --- | --- | --- | --- | --- |
| SPEAK | Phase 3B brief | `SELECT_ANSWER_MODE(SPEAK)` selects the verbal answer path. The engine does not capture microphone audio or transcribe speech. `REVIEW_ANSWER` is optional, and `SUBMIT_ANSWER` may complete the answer with `completionOnly=true` when no content should be stored. | Mode selection and any optional review stay private to the triggering player. Public resolution events do not carry the spoken answer text. | No audio, no transcript, no public text. Private review metadata may exist in the authoritative state until resolution. | No | HIGH | Whether future product UI should surface an explicit “review transcript” step remains a presentation decision |
| TYPE | Phase 3B brief | `SELECT_ANSWER_MODE(TYPE)` selects typed entry. `REVIEW_ANSWER` may hold private typed content, and `SUBMIT_ANSWER` requires meaningful text before resolution. Empty typed submissions are rejected. | Mode selection and any optional review stay private to the triggering player. Public resolution events do not carry typed text. | Typed content may exist privately in authoritative state, but it is not published in public events. | No | HIGH | Whether future moderation/storage workflows should persist submitted text remains deferred |
| CHOOSE | Phase 3B brief | `SELECT_ANSWER_MODE(CHOOSE)` is only valid when the authoritative prompt supplies non-empty `options`. `SUBMIT_CHOICE` validates that the selected choice exists in the authoritative prompt options. `REVIEW_ANSWER` remains an optional private review step, not a required one. | Choice selection stays private to the triggering player. Public resolution events do not carry the chosen option text. | Choice text may exist privately in authoritative state until the prompt resolves. | Yes, via prompt options on the authoritative prompt | HIGH | Whether choice text should ever appear in public recap/projection layers is a later presentation decision |
| ANSWERED_LIVE | Phase 3B brief | `SELECT_ANSWER_MODE(ANSWERED_LIVE)` marks the answer as completion-only. `MARK_ANSWERED_LIVE` resolves the answer without capturing or storing the spoken content. `REVIEW_ANSWER(completionOnly=true)` may be accepted as an optional private confirmation step, but it is not required. | Mode selection and completion marking stay private. Public resolution events do not carry transcript, audio, or answer text. | Completion metadata only; no content capture. | No | HIGH | Whether a future live-call client needs a richer local presentation state is deferred |

## Current lifecycle

- `WAITING` → `SELECT_ANSWER_MODE` → `MODE_SELECTED`
- `MODE_SELECTED` → optional `REVIEW_ANSWER`
- `TYPE` uses `REVIEW_ANSWER` → `SUBMIT_ANSWER`
- `SPEAK` can use optional `REVIEW_ANSWER` or go straight to `SUBMIT_ANSWER`
- `CHOOSE` can go straight to `SUBMIT_CHOICE` after mode selection; `REVIEW_ANSWER` is optional
- `ANSWERED_LIVE` can go straight to `MARK_ANSWERED_LIVE`; `REVIEW_ANSWER(completionOnly=true)` is optional

The reducer remains deterministic, and answer completion still respects the delayed social-resolution boundary for final-card wins.

## Deferred by design

- timers
- timeout resolution
- any future moderation/storage pipeline for submitted answer content
