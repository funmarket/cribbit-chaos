# Audio and media plan

Status: planning only. Not authorized gameplay implementation. Does not change `Game_rules.md`.

Audio is a media + presentation layer. The engine stays audio-blind except for existing answer-mode and completion facts. Bytes never live in PostgreSQL. Clients never talk to object storage or the database.

Authority already locked and reused here:

- `REQUIREMENTS.md` R7: Speak, Type, Choose, Answered Live. Answered Live stores completion metadata only. No passive background capture.
- `RULE-ANSWER-PRIVACY`: engine must not fabricate speech; private answers are not automatically public.
- `RULE-PROMPTS-007`: manual one-off prompts are not auto-saved to the permanent library.
- `RULE-PREGAME`: player-contributed room content uses the shared prompt system.
- `FLAG_PROMPT` remains a non-mutating moderation signal.

Open product locks (do not invent defaults in code):

- pregame-only voice prompts vs in-game manual recordings
- whether spoken answers are ever stored
- official reads: Piper, Kokoro, or later human VO
- retention window for player media

## Package ownership

| Owner | May do | Must not do |
|---|---|---|
| `packages/game-engine` | Read answer mode, completion, `mediaId` presence | Synth, record, play, wait on audio |
| `packages/prompts` | Use `hasAudio` / locale as eligibility metadata | Fetch files or choose a voice |
| `apps/api` | Signed upload/download, persist metadata | Embed audio in command results |
| media workers | TTS, ASR, VAD, transcode | Mutate game revision |
| `packages/ui` + platform adapters | Capture, play, mute, autoplay unlock | Advance turns when a clip ends |

`CAPTURING` stays a client presentation state.

Suggested worker process names, not engine modules:

```text
workers/tts-piper
workers/tts-kokoro
workers/asr-whisper
workers/vad-silero
```

## Open-source workers

All three run off the request path that commits `expectedRevision`. House-library work is batch. Upload analysis is async after the object lands.

| Worker | Binary / model | License | Job |
|---|---|---|---|
| TTS fast path | [Piper](https://github.com/rhasspy/piper) | MIT | CPU synthesis for one-off manuals and bulk precompute when quality can be lower |
| TTS host voice | [Kokoro-82M](https://huggingface.co/hexgrad/Kokoro-82M) | Apache 2.0 | Official prompt narration; no voice cloning |
| ASR | [whisper.cpp](https://github.com/ggml-org/whisper.cpp) small/distil | MIT | Transcript check on player recordings |
| VAD | [Silero VAD](https://github.com/snakers4/silero-vad) | MIT | Speech-present gate before Whisper |

Do not use Coqui XTTS v2 in this product (CPML, non-commercial). Do not clone player voices.

Client SFX stay in git + Cloudflare Pages (`packages/audio` catalog). Howler or `AudioContext` only. No worker.

Storage: Cloudflare R2 (or S3-compatible) objects + signed URLs issued by the Railway API. Analyze a 16 kHz mono WAV copy; persist Opus.

## Cache key

Canonical TTS object key:

```text
tts/{sha256(normalized_text + "|" + locale + "|" + voice_key + "|" + model_id + "|" + sample_rate + "|" + codec)}.opus
```

`normalized_text` is Unicode NFKC, collapsed whitespace, stripped wrapping punctuation variants so `"Hello!"` and `"hello"` collide on purpose.

Postgres stores the hex digest as `text_hash` on `prompt_media` / `media_assets`. If prompt text changes, the hash misses and the worker regenerates. Text remains source of truth; audio is derived.

Lookup order:

```text
client memory (current prompt + last N)
  -> Cloudflare edge / R2
    -> precomputed house/system clip
      -> live Piper/Kokoro only for unsaved manuals
```

System-line phrase bank is pre-rendered and concatenated with the body (`"Truth."`, `"Pass. Draw two."`, `"Roulette locked."`). Cached prefixes are required; live full-prompt synth is not the default path.

Live synth, if used at all, streams clause chunks split on `[.!?…,:;]`. Playback may start on clause 1. Resolution must not wait.

## Schema sketch

Additive. Do not replace `prompts.text` or `answers.answer_text`.

```text
media_assets
  id
  kind            sfx | music | tts_prompt | player_prompt | player_answer | system_line
  storage_key
  mime_type
  duration_ms
  byte_size
  checksum
  text_hash
  locale
  voice_key
  transcript      required for player_prompt
  created_by
  moderation_status
  moderation jsonb
  created_at

prompt_media
  prompt_id
  media_id
  role            canonical_read | alt_read | player_recorded

answers
  media_id        nullable
  capture_mode    none | completion_only | stored_recording
```

`prompts.text` stays mandatory even when a recording exists. Manual one-off rows stay session-scoped unless an explicit save command is added later.

Room/user audio config is preference JSON, not a rule:

```json
{
  "sfx": true,
  "music": false,
  "autoReadPrompts": true,
  "allowPlayerPromptRecordings": true,
  "storeSpokenAnswers": false
}
```

Default planning assumption until locked otherwise: `storeSpokenAnswers=false`. Speak and Answered Live do not create `player_answer` rows.

## Moderation states

`media_assets.moderation_status`:

| State | Meaning | Playback |
|---|---|---|
| `uploaded` | Object accepted; analysis not finished | author-only preview |
| `analyzing` | VAD / ASR / text scores running | author-only preview |
| `approved_for_room` | Allowed in this room's content world | eligible listeners under existing privacy |
| `approved_library` | Allowed in the permanent house/saved pool | same |
| `pending_review` | Model uncertain or FLAG reopened | hold for new listeners; game continues on text |
| `blocked` | Policy reject | never projected |
| `tombstoned` | Soft-deleted; purge bucket later | never projected |

Pipeline for `player_prompt` only (not SFX, not Answered Live, not official reads of already-approved house text):

```text
magic bytes + ffprobe
-> ffmpeg normalize
-> Silero VAD (reject no-speech if the slot requires speech)
-> duration / size caps
-> whisper.cpp transcript
-> text policy (Detoxify-class scores + content-world allowlist)
-> optional waveform classifier later
-> state transition
```

Hard auto-block only: empty/invalid file, child-sounding voice if that check is enabled, CSAM/hash hits, attaching media to Answered Live, malware. Spicy Dare/Paranoia text is not an automatic block in an adult content world.

`FLAG_PROMPT` may set `media_id`. FLAG does not resolve the social effect. Public events never carry scores, transcripts, or signed URLs.

Privacy projection is the same as prompt text: if the player cannot see the prompt (sealed Roulette, Keep Secret, private preview), they cannot receive the audio URL.

## Latency budget

| Path | Target | How |
|---|---|---|
| SFX | < 30 ms | local catalog |
| House / system read, warm | 50–200 ms TTFB | precompute + CDN |
| Pregame player prompt in-game | already ready | synth + moderate at submit |
| In-game manual with no clip | text first; audio optional 300–800 ms | Piper chunks or skip |
| Answered Live / Speak | no TTS wait | completion / live only |

## Commands that stay out of family handlers

- `REQUEST_MEDIA_UPLOAD`
- `ATTACH_PROMPT_MEDIA`
- existing manual-prompt submit plus optional `mediaId`

No `AUDIO_FINISHED` command. Playback completion is not an authoritative transition.

## Out of scope until explicitly locked

- stored spoken answers
- voice cloning / XTTS
- always-on room capture
- engine timeouts tied to clip duration
- committing this worker set into `packages/game-engine` or client bundles
