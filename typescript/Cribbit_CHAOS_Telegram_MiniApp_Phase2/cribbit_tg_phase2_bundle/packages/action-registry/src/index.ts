export type BackendClass = 'game-command' | 'rest' | 'realtime' | 'client-only' | 'dev-only';

export interface ActionAssignment {
  action: string;
  backendClass: BackendClass;
  target: string;
  method?: 'GET' | 'POST' | 'PATCH' | 'DELETE' | 'WS';
  notes: string;
}

/**
 * Production assignment for every literal data-action emitted by the approved V4 UI/runtime.
 * Client-only actions are intentionally listed so no control is accidentally mistaken for a missing backend route.
 */
export const ACTION_ASSIGNMENTS: readonly ActionAssignment[] = [
  { action:'add-to-room', backendClass:'rest', target:'/v1/rooms/:roomId/prompt-pool/:promptId', method:'POST', notes:'Persist prompt in the authoritative live room pool.' },
  { action:'advance-submission', backendClass:'rest', target:'/v1/moderation/submissions/:submissionId/advance', method:'POST', notes:'Moderator/development workflow; role-gated.' },
  { action:'answer-mode', backendClass:'game-command', target:'SELECT_ANSWER_MODE', method:'WS', notes:'Select explicit Speak, Type, Choose or Answered Live path.' },
  { action:'apply-room-config', backendClass:'rest', target:'/v1/rooms/:roomId/config', method:'PATCH', notes:'Host-only authoritative room configuration.' },
  { action:'card-detail', backendClass:'client-only', target:'local-dialog', notes:'Displays already-authorized card metadata; no mutation.' },
  { action:'choose-wild', backendClass:'game-command', target:'SELECT_WILD_COLOR', method:'WS', notes:'Authoritative active-color change.' },
  { action:'clear-log', backendClass:'dev-only', target:'local-qa-log', notes:'QA-only display reset; never clears server audit events.' },
  { action:'close-rail-drawers', backendClass:'client-only', target:'local-layout', notes:'Visual panel state.' },
  { action:'complete-flow', backendClass:'game-command', target:'COMPLETE_FLOW', method:'WS', notes:'Resolve current authoritative flow when permitted.' },
  { action:'draw-card', backendClass:'game-command', target:'DRAW_CARD', method:'WS', notes:'Server validates active player and draw legality.' },
  { action:'duel-vote', backendClass:'game-command', target:'DUEL_VOTE', method:'WS', notes:'Submit eligible Duel resolution choice.' },
  { action:'edit-answer', backendClass:'client-only', target:'local-answer-draft', notes:'Returns unsubmitted answer to editing; server has not accepted it yet.' },
  { action:'finish-speak', backendClass:'game-command', target:'REVIEW_ANSWER', method:'WS', notes:'Production voice adapter submits reviewed transcription, never passive call audio.' },
  { action:'flow-close-request', backendClass:'client-only', target:'local-guard', notes:'Prevents dismissing unresolved authoritative flow.' },
  { action:'force-recap', backendClass:'dev-only', target:'FORCE_RECAP', method:'WS', notes:'QA-only state transition, disabled in production.' },
  { action:'join-room', backendClass:'rest', target:'/v1/rooms/join', method:'POST', notes:'Resolve room code/invite and create room membership.' },
  { action:'lab-add-card', backendClass:'dev-only', target:'LAB_ADD_CARD', method:'WS', notes:'QA only.' },
  { action:'lab-human-turn', backendClass:'dev-only', target:'LAB_HUMAN_TURN', method:'WS', notes:'QA only.' },
  { action:'lab-one-card', backendClass:'dev-only', target:'LAB_ONE_CARD', method:'WS', notes:'QA only.' },
  { action:'lab-queue-chaos', backendClass:'dev-only', target:'QA_CHAOS_QUEUE', notes:'QA-only deterministic fixture selection.' },
  { action:'lab-trigger-draw', backendClass:'dev-only', target:'LAB_TRIGGER_DRAW', method:'WS', notes:'QA only.' },
  { action:'paranoia-choice', backendClass:'game-command', target:'PARANOIA_CHOICE', method:'WS', notes:'Private server-validated target selection.' },
  { action:'duel-target', backendClass:'game-command', target:'DUEL_TARGET', method:'WS', notes:'Server validates eligible Duel opponent.' },
  { action:'chaos-target', backendClass:'game-command', target:'CHAOS_TARGET', method:'WS', notes:'Server validates target for the preselected CHAOS effect.' },
  { action:'focus-create-prompt', backendClass:'client-only', target:'local-scroll', notes:'Navigation helper only.' },
  { action:'nope-reaction', backendClass:'game-command', target:'NOPE_REACTION', method:'WS', notes:'Server validates reaction window and Nope ownership.' },
  { action:'open-global-search', backendClass:'client-only', target:'local-search-overlay', notes:'Searches cached route/prompt data; remote prompt search may be added later.' },
  { action:'open-mobile-nav', backendClass:'client-only', target:'local-navigation', notes:'Presentation only.' },
  { action:'open-notifications', backendClass:'rest', target:'/v1/me/notifications', method:'GET', notes:'Production notifications load from shared account backend.' },
  { action:'open-profile', backendClass:'rest', target:'/v1/me', method:'GET', notes:'Load shared Cribbit profile.' },
  { action:'play-again', backendClass:'rest', target:'/v1/games/:sessionId/rematch', method:'POST', notes:'Create/rematch server session; client then navigates to returned room/session.' },
  { action:'play-card', backendClass:'game-command', target:'PLAY_CARD', method:'WS', notes:'Server validates ownership and legal play atomically.' },
  { action:'prompt-detail', backendClass:'rest', target:'/v1/prompts/:promptId', method:'GET', notes:'Fetch authorized prompt detail and attribution visibility.' },
  { action:'publish-prompt', backendClass:'game-command', target:'PUBLISH_PROMPT', method:'WS', notes:'Server-controlled reveal/publish step.' },
  { action:'reconnect-now', backendClass:'realtime', target:'/v1/realtime + /v1/games/:sessionId/snapshot', method:'WS', notes:'Reconnect socket then hydrate authoritative snapshot/revision.' },
  { action:'remove-from-room', backendClass:'rest', target:'/v1/rooms/:roomId/prompt-pool/:promptId', method:'DELETE', notes:'Host-authorized live-pool removal.' },
  { action:'reset-demo', backendClass:'dev-only', target:'local-demo-reset', notes:'Never exposed as production session reset.' },
  { action:'resolve-chaos', backendClass:'game-command', target:'COMPLETE_FLOW', method:'WS', notes:'CHAOS effect result is already selected server-side; this acknowledges/completes it.' },
  { action:'retry-last-command', backendClass:'realtime', target:'replay same commandId', method:'WS', notes:'Idempotent replay must return prior result rather than apply twice.' },
  { action:'review-choice-answer', backendClass:'game-command', target:'REVIEW_ANSWER', method:'WS', notes:'Validate choice before final submit.' },
  { action:'review-live-answer', backendClass:'game-command', target:'REVIEW_ANSWER', method:'WS', notes:'Completion-only; no passive transcript.' },
  { action:'review-typed-answer', backendClass:'game-command', target:'REVIEW_ANSWER', method:'WS', notes:'Review explicit typed answer.' },
  { action:'safety-flag', backendClass:'game-command', target:'FLAG_PROMPT', method:'WS', notes:'Private moderation signal; separate from Pass/Rewind/Nope.' },
  { action:'safety-pass', backendClass:'game-command', target:'PASS_PROMPT', method:'WS', notes:'Private consent-preserving decline.' },
  { action:'safety-rewind', backendClass:'game-command', target:'REWIND_PROMPT', method:'WS', notes:'Private eligible Truth/Dare replacement before reveal.' },
  { action:'save-profile', backendClass:'rest', target:'/v1/me/profile', method:'PATCH', notes:'Persist shared account/profile settings across web and Telegram.' },
  { action:'save-prompt', backendClass:'rest', target:'/v1/prompts/:promptId/save', method:'POST', notes:'Destination determines My Deck or House Deck; public submission remains separate.' },
  { action:'share-recap', backendClass:'client-only', target:'platform.share', notes:'User-initiated share. Recap itself is fetched from backend.' },
  { action:'simulate-disconnect', backendClass:'dev-only', target:'local-network-fixture', notes:'QA only.' },
  { action:'spin-roulette', backendClass:'client-only', target:'local-animation', notes:'Animation only. Server has selected the prompt before spin begins.' },
  { action:'submit-answer', backendClass:'game-command', target:'SUBMIT_ANSWER', method:'WS', notes:'Finalize reviewed answer/completion metadata.' },
  { action:'toggle-activity', backendClass:'client-only', target:'local-layout', notes:'Presentation only.' },
  { action:'toggle-focus-mode', backendClass:'client-only', target:'local-layout', notes:'Presentation only.' },
  { action:'toggle-fullscreen', backendClass:'client-only', target:'platform.fullscreen', notes:'Uses browser Fullscreen or Telegram requestFullscreen when supported.' },
  { action:'toggle-left-rail', backendClass:'client-only', target:'local-layout', notes:'Presentation only.' },
  { action:'toggle-right-rail', backendClass:'client-only', target:'local-layout', notes:'Presentation only.' },
  { action:'use-nope', backendClass:'game-command', target:'NOPE_REACTION', method:'WS', notes:'Server validates owned Nope card and eligible effect window.' }
] as const;

export const ACTION_ASSIGNMENT_BY_NAME = new Map(ACTION_ASSIGNMENTS.map(item => [item.action, item]));

export interface ControlAssignment {
  selector: string;
  backendClass: BackendClass;
  target: string;
  notes: string;
}

/** Non-data-action controls that are still intentional and fully classified. */
export const CONTROL_ASSIGNMENTS: readonly ControlAssignment[] = [
  { selector:'[data-nav]', backendClass:'client-only', target:'client router', notes:'Route/view navigation only.' },
  { selector:'[data-board-tab]', backendClass:'client-only', target:'board query state', notes:'Filter/tab state; data can be refreshed via prompt endpoints.' },
  { selector:'[data-library-tab]', backendClass:'client-only', target:'library query state', notes:'Tab selection only.' },
  { selector:'[data-create-destination]', backendClass:'client-only', target:'prompt draft destination', notes:'Selects destination before submission.' },
  { selector:'[data-room-category]', backendClass:'client-only', target:'room config draft', notes:'Drafted locally until Apply Room Config persists it.' },
  { selector:'.mode-card[data-mode]', backendClass:'client-only', target:'room setup draft', notes:'Drafted locally; authoritative mode persists on room/start.' },
  { selector:'[data-source]', backendClass:'client-only', target:'room setup draft', notes:'Drafted locally until host applies room config.' },
  { selector:'[data-filter]', backendClass:'client-only', target:'board query state', notes:'Presentation/query filter.' },
  { selector:'[data-close-dialog]', backendClass:'client-only', target:'dialog close', notes:'Presentation only.' },
  { selector:'[data-call-mode]', backendClass:'game-command', target:'SELECT_ANSWER_MODE', notes:'Same explicit answer-mode command as in game flow.' },
  { selector:'#startGameButton', backendClass:'rest', target:'POST /v1/rooms/:roomId/start', notes:'Authoritative server creates/deals session and first turn.' },
  { selector:'#ecosystemPromptForm', backendClass:'rest', target:'POST /v1/prompts', notes:'Create/save/submit prompt according to selected destination.' },
  { selector:'#playerCount', backendClass:'client-only', target:'room setup draft', notes:'Balancing/config draft until room start.' },
  { selector:'#worldSelect', backendClass:'rest', target:'PATCH /v1/me/profile + room eligibility', notes:'Profile/world eligibility is persisted server-side.' },
  { selector:'#ceilingSelect', backendClass:'rest', target:'PATCH /v1/me/profile', notes:'Persist content ceiling/boundary.' },
  { selector:'#promptSearch', backendClass:'client-only', target:'prompt query', notes:'Local/cached query now; may call GET /v1/prompts?q= later.' },
  { selector:'[id^="knob"]', backendClass:'dev-only', target:'server ruleset config', notes:'Balancing knobs belong to controlled server config, not public clients.' },
  { selector:'[id^="roomWeight"]', backendClass:'client-only', target:'room config draft', notes:'Persisted only by Apply Room Config.' },
  { selector:'#roomVibeStart,#roomVibeEnd', backendClass:'client-only', target:'room config draft', notes:'Persisted only by Apply Room Config.' },
  { selector:'#globalSearchInput', backendClass:'client-only', target:'client search overlay', notes:'No mutation.' }
] as const;
