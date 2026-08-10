# Answer mode rule decisions

This document records the Phase 3B answer-mode slice now implemented in the authoritative reducer. It is intentionally narrow: it covers the answer controls themselves, the privacy boundary around answer content, and the current deferred line for timers.

| Rule | Source | Implementation | Visibility | Content storage | Configurable? | Confidence | Open question |
| --- | --- | --- | --- | --- | --- | --- | --- |
| SPEAK | Phase 3B brief | `SELECT_ANSWER_MODE(SPEAK)` selects the verbal answer path. The engine does not capture microphone audio or transcribe speech. `REVIEW_ANSWER` may carry private reviewed text when the client provides it, and `SUBMIT_ANSWER` may complete the answer with `completionOnly=true` when no content should be stored. | Mode selection and review stay private to the triggering player. Public resolution events do not carry the spoken answer text. | No audio, no transcript, no public text. Private review metadata may exist in the authoritative state until resolution. | No | HIGH | Whether future product UI should surface an explicit “review transcript” step remains a presentation decision |
| TYPE | Phase 3B brief | `SELECT_ANSWER_MODE(TYPE)` selects typed entry. `REVIEW_ANSWER` accepts private typed content, and `SUBMIT_ANSWER` requires meaningful text before resolution. Empty typed submissions are rejected. | Mode selection and review stay private to the triggering player. Public resolution events do not carry typed text. | Typed content may exist privately in authoritative state, but it is not published in public events. | No | HIGH | Whether future moderation/storage workflows should persist submitted text remains deferred |
| CHOOSE | Phase 3B brief | `SELECT_ANSWER_MODE(CHOOSE)` is only valid when the authoritative prompt supplies non-empty `options`. `REVIEW_ANSWER` and `SUBMIT_CHOICE` both validate that the selected choice exists in the authoritative prompt options. | Choice selection stays private to the triggering player. Public resolution events do not carry the chosen option text. | Choice text may exist privately in authoritative state until the prompt resolves. | Yes, via prompt options on the authoritative prompt | HIGH | Whether choice text should ever appear in public recap/projection layers is a later presentation decision |
| ANSWERED_LIVE | Phase 3B brief | `SELECT_ANSWER_MODE(ANSWERED_LIVE)` marks the answer as completion-only. `REVIEW_ANSWER` may confirm the completion-only path, and `MARK_ANSWERED_LIVE` resolves the answer without capturing or storing the spoken content. | Mode selection and completion marking stay private. Public resolution events do not carry transcript, audio, or answer text. | Completion metadata only; no content capture. | No | HIGH | Whether a future live-call client needs a richer local presentation state is deferred |

## Current lifecycle

- `WAITING` → `SELECT_ANSWER_MODE` → `MODE_SELECTED`
- `MODE_SELECTED` → `REVIEW_ANSWER` → `REVIEW`
- `REVIEW` → `SUBMIT_ANSWER`, `SUBMIT_CHOICE`, or `MARK_ANSWERED_LIVE` → `SUBMITTED`

The reducer remains deterministic, and answer completion still respects the delayed social-resolution boundary for final-card wins.

## Deferred by design

- timers
- timeout resolution
- any future moderation/storage pipeline for submitted answer content
