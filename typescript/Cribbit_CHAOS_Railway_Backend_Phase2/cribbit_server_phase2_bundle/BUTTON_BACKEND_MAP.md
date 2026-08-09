# Cribbit CHAOS — UI to Backend Map

All `57` registered runtime actions are classified. Client-only and dev-only controls are listed intentionally so they are not mistaken for missing backend work.

## Runtime actions

| UI action | Class | Backend / owner | Method | Behavior |
|---|---|---|---|---|
| `add-to-room` | rest | `/v1/rooms/:roomId/prompt-pool/:promptId` | POST | Persist prompt in the authoritative live room pool. |
| `advance-submission` | rest | `/v1/moderation/submissions/:submissionId/advance` | POST | Moderator/development workflow; role-gated. |
| `answer-mode` | game-command | `SELECT_ANSWER_MODE` | WS | Select explicit Speak, Type, Choose or Answered Live path. |
| `apply-room-config` | rest | `/v1/rooms/:roomId/config` | PATCH | Host-only authoritative room configuration. |
| `card-detail` | client-only | `local-dialog` | — | Displays already-authorized card metadata; no mutation. |
| `choose-wild` | game-command | `SELECT_WILD_COLOR` | WS | Authoritative active-color change. |
| `clear-log` | dev-only | `local-qa-log` | — | QA-only display reset; never clears server audit events. |
| `close-rail-drawers` | client-only | `local-layout` | — | Visual panel state. |
| `complete-flow` | game-command | `COMPLETE_FLOW` | WS | Resolve current authoritative flow when permitted. |
| `draw-card` | game-command | `DRAW_CARD` | WS | Server validates active player and draw legality. |
| `duel-vote` | game-command | `DUEL_VOTE` | WS | Submit eligible Duel resolution choice. |
| `edit-answer` | client-only | `local-answer-draft` | — | Returns unsubmitted answer to editing; server has not accepted it yet. |
| `finish-speak` | game-command | `REVIEW_ANSWER` | WS | Production voice adapter submits reviewed transcription, never passive call audio. |
| `flow-close-request` | client-only | `local-guard` | — | Prevents dismissing unresolved authoritative flow. |
| `force-recap` | dev-only | `FORCE_RECAP` | WS | QA-only state transition, disabled in production. |
| `join-room` | rest | `/v1/rooms/join` | POST | Resolve room code/invite and create room membership. |
| `lab-add-card` | dev-only | `LAB_ADD_CARD` | WS | QA only. |
| `lab-human-turn` | dev-only | `LAB_HUMAN_TURN` | WS | QA only. |
| `lab-one-card` | dev-only | `LAB_ONE_CARD` | WS | QA only. |
| `lab-queue-chaos` | dev-only | `QA_CHAOS_QUEUE` | — | QA-only deterministic fixture selection. |
| `lab-trigger-draw` | dev-only | `LAB_TRIGGER_DRAW` | WS | QA only. |
| `paranoia-choice` | game-command | `PARANOIA_CHOICE` | WS | Private server-validated target selection. |
| `duel-target` | game-command | `DUEL_TARGET` | WS | Server validates eligible Duel opponent. |
| `chaos-target` | game-command | `CHAOS_TARGET` | WS | Server validates target for the preselected CHAOS effect. |
| `focus-create-prompt` | client-only | `local-scroll` | — | Navigation helper only. |
| `nope-reaction` | game-command | `NOPE_REACTION` | WS | Server validates reaction window and Nope ownership. |
| `open-global-search` | client-only | `local-search-overlay` | — | Searches cached route/prompt data; remote prompt search may be added later. |
| `open-mobile-nav` | client-only | `local-navigation` | — | Presentation only. |
| `open-notifications` | rest | `/v1/me/notifications` | GET | Production notifications load from shared account backend. |
| `open-profile` | rest | `/v1/me` | GET | Load shared Cribbit profile. |
| `play-again` | rest | `/v1/games/:sessionId/rematch` | POST | Create/rematch server session; client then navigates to returned room/session. |
| `play-card` | game-command | `PLAY_CARD` | WS | Server validates ownership and legal play atomically. |
| `prompt-detail` | rest | `/v1/prompts/:promptId` | GET | Fetch authorized prompt detail and attribution visibility. |
| `publish-prompt` | game-command | `PUBLISH_PROMPT` | WS | Server-controlled reveal/publish step. |
| `reconnect-now` | realtime | `/v1/realtime + /v1/games/:sessionId/snapshot` | WS | Reconnect socket then hydrate authoritative snapshot/revision. |
| `remove-from-room` | rest | `/v1/rooms/:roomId/prompt-pool/:promptId` | DELETE | Host-authorized live-pool removal. |
| `reset-demo` | dev-only | `local-demo-reset` | — | Never exposed as production session reset. |
| `resolve-chaos` | game-command | `COMPLETE_FLOW` | WS | CHAOS effect result is already selected server-side; this acknowledges/completes it. |
| `retry-last-command` | realtime | `replay same commandId` | WS | Idempotent replay must return prior result rather than apply twice. |
| `review-choice-answer` | game-command | `REVIEW_ANSWER` | WS | Validate choice before final submit. |
| `review-live-answer` | game-command | `REVIEW_ANSWER` | WS | Completion-only; no passive transcript. |
| `review-typed-answer` | game-command | `REVIEW_ANSWER` | WS | Review explicit typed answer. |
| `safety-flag` | game-command | `FLAG_PROMPT` | WS | Private moderation signal; separate from Pass/Rewind/Nope. |
| `safety-pass` | game-command | `PASS_PROMPT` | WS | Private consent-preserving decline. |
| `safety-rewind` | game-command | `REWIND_PROMPT` | WS | Private eligible Truth/Dare replacement before reveal. |
| `save-profile` | rest | `/v1/me/profile` | PATCH | Persist shared account/profile settings across web and Telegram. |
| `save-prompt` | rest | `/v1/prompts/:promptId/save` | POST | Destination determines My Deck or House Deck; public submission remains separate. |
| `share-recap` | client-only | `platform.share` | — | User-initiated share. Recap itself is fetched from backend. |
| `simulate-disconnect` | dev-only | `local-network-fixture` | — | QA only. |
| `spin-roulette` | client-only | `local-animation` | — | Animation only. Server has selected the prompt before spin begins. |
| `submit-answer` | game-command | `SUBMIT_ANSWER` | WS | Finalize reviewed answer/completion metadata. |
| `toggle-activity` | client-only | `local-layout` | — | Presentation only. |
| `toggle-focus-mode` | client-only | `local-layout` | — | Presentation only. |
| `toggle-fullscreen` | client-only | `platform.fullscreen` | — | Uses browser Fullscreen or Telegram requestFullscreen when supported. |
| `toggle-left-rail` | client-only | `local-layout` | — | Presentation only. |
| `toggle-right-rail` | client-only | `local-layout` | — | Presentation only. |
| `use-nope` | game-command | `NOPE_REACTION` | WS | Server validates owned Nope card and eligible effect window. |

## Other static controls

| Selector | Class | Backend / owner | Behavior |
|---|---|---|---|
| `[data-nav]` | client-only | `client router` | Route/view navigation only. |
| `[data-board-tab]` | client-only | `board query state` | Filter/tab state; data can be refreshed via prompt endpoints. |
| `[data-library-tab]` | client-only | `library query state` | Tab selection only. |
| `[data-create-destination]` | client-only | `prompt draft destination` | Selects destination before submission. |
| `[data-room-category]` | client-only | `room config draft` | Drafted locally until Apply Room Config persists it. |
| `.mode-card[data-mode]` | client-only | `room setup draft` | Drafted locally; authoritative mode persists on room/start. |
| `[data-source]` | client-only | `room setup draft` | Drafted locally until host applies room config. |
| `[data-filter]` | client-only | `board query state` | Presentation/query filter. |
| `[data-close-dialog]` | client-only | `dialog close` | Presentation only. |
| `[data-call-mode]` | game-command | `SELECT_ANSWER_MODE` | Same explicit answer-mode command as in game flow. |
| `#startGameButton` | rest | `POST /v1/rooms/:roomId/start` | Authoritative server creates/deals session and first turn. |
| `#ecosystemPromptForm` | rest | `POST /v1/prompts` | Create/save/submit prompt according to selected destination. |
| `#playerCount` | client-only | `room setup draft` | Balancing/config draft until room start. |
| `#worldSelect` | rest | `PATCH /v1/me/profile + room eligibility` | Profile/world eligibility is persisted server-side. |
| `#ceilingSelect` | rest | `PATCH /v1/me/profile` | Persist content ceiling/boundary. |
| `#promptSearch` | client-only | `prompt query` | Local/cached query now; may call GET /v1/prompts?q= later. |
| `[id^="knob"]` | dev-only | `server ruleset config` | Balancing knobs belong to controlled server config, not public clients. |
| `[id^="roomWeight"]` | client-only | `room config draft` | Persisted only by Apply Room Config. |
| `#roomVibeStart,#roomVibeEnd` | client-only | `room config draft` | Persisted only by Apply Room Config. |
| `#globalSearchInput` | client-only | `client search overlay` | No mutation. |
