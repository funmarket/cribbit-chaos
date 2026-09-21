import type { Card, CardColor, GameCommand, GameState, LegalCommandOption, PlayerDecisionCapabilities } from '../../../packages/contracts/src/index.ts';
import { ApiError, CribbitApiClient, CribbitRealtimeClient, type RoomSessionResult, type WaitingRoomResult } from '../../../packages/api-client/src/index.ts';
import { cribbitAuth } from '../../../packages/ui/src/auth-controller.ts';
import { activateSharedView, type SharedNavigationRoot } from '../../../packages/ui/src/navigation-controller.ts';
import { openWebAuthDialog } from './web-auth.ts';
import { renderDiscardedPile } from './pile-presentation.ts';

type LivePlayer = { id:string; name:string; isHuman:boolean };
type CommandBody<T = GameCommand> = T extends GameCommand ? Omit<T,'commandId'|'playerId'|'expectedRevision'|'sessionId'> : never;

type LiveSession = {
  room: RoomSessionResult;
  state: GameState;
  capabilities: PlayerDecisionCapabilities;
  players: LivePlayer[];
  realtime: CribbitRealtimeClient;
  unsubscribe?: () => void;
  status?: string;
};

/** Presentation contract shared by the Live board and the Local QA Simulation board. */
export type LiveSessionView = {
  room: Pick<RoomSessionResult, 'joinCode'>;
  state: GameState;
  capabilities: PlayerDecisionCapabilities;
  players: LivePlayer[];
};

function escapeHTML(value:unknown): string {
  return String(value ?? '').replace(/[&<>'"]/g, char => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', "'":'&#39;', '"':'&quot;' })[char] || char);
}

function titleForCard(card:Card): string {
  if (card.kind === 'number') return `${card.color ?? ''} ${card.value ?? ''}`.trim();
  return card.kind.replaceAll('_',' ').replace(/\b\w/g, char => char.toUpperCase());
}

function iconForCard(card:Card): string {
  if (card.kind === 'truth') return 'i-truth';
  if (card.kind === 'dare') return 'i-lightning';
  if (card.kind === 'paranoia') return 'i-paranoia';
  if (card.kind === 'chaos') return 'i-spiral';
  if (card.kind === 'duel') return 'i-swords';
  if (card.kind === 'nope') return 'i-hand';
  if (card.kind === 'reverse') return 'i-reverse';
  if (card.kind === 'draw') return 'i-draw';
  if (card.kind === 'skip') return 'i-skip';
  return 'i-card';
}

function renderCard(card:Card, interactive:boolean, legal:boolean, ruleCopy = 'Shared live session'): string {
  const kind = escapeHTML(card.kind);
  const color = card.color ? ` data-color="${escapeHTML(card.color)}"` : '';
  const number = card.kind === 'number' ? `<span class="game-card__icon is-number">${escapeHTML(card.value)}</span>` : `<svg class="game-card__icon icon" aria-hidden="true"><use href="#${iconForCard(card)}"></use></svg>`;
  const action = interactive ? ` data-action="play-card" data-card-id="${escapeHTML(card.id)}" aria-disabled="${String(!legal)}"` : '';
  const element = interactive ? 'button' : 'div';
  return `<${element} class="game-card game-card--mini" data-kind="${kind}"${color}${action} data-legal="${String(legal)}" ${interactive ? 'type="button"' : ''} aria-label="${escapeHTML(titleForCard(card))}">
    <span class="game-card__tab"><svg class="icon" aria-hidden="true"><use href="#${iconForCard(card)}"></use></svg></span>
    <strong class="game-card__title">${escapeHTML(titleForCard(card))}</strong>
    ${number}
    <p class="game-card__rule">${escapeHTML(ruleCopy)}</p>
    <svg class="frog-seal icon" aria-hidden="true"><use href="#i-frog"></use></svg>
  </${element}>`;
}


function playerName(session:LiveSessionView, playerId:string | null | undefined): string {
  return session.players.find(player => player.id === playerId)?.name || playerId || '—';
}

function activeStateCopy(session:LiveSessionView): {title:string; copy:string} {
  const state = session.state;
  if (state.pendingEffect?.type === 'WILD_COLOR') return { title:'Choose a color', copy:'Wild is waiting for the active player to choose the next color.' };
  const social = state.social;
  if (!social) return { title:'Play or draw', copy:'Match the active color or symbol, use an eligible special, or draw under the shared rules.' };
  const prompt = social.prompt?.text;
  if (social.resolutionComplete) return { title:`${titleForKind(social.cardKind)} resolved`, copy:'Complete the authoritative flow to continue.' };
  return { title:`${titleForKind(social.cardKind)} resolution`, copy:prompt || 'Complete the active authoritative flow.' };
}

function titleForKind(kind:string): string {
  return kind.replaceAll('_',' ').replace(/\b\w/g, char => char.toUpperCase());
}

function button(label:string, action:string, extra=''): string {
  return `<button class="button button--sm" type="button" data-live-action="${action}" ${extra}>${escapeHTML(label)}</button>`;
}

function decisionLabel(session:LiveSessionView, option: LegalCommandOption): string {
  const presentation = option.presentation;
  const command = option.command;
  if (presentation.category === 'TARGET' && presentation.targetPlayerId) return `Target ${playerName(session,presentation.targetPlayerId)}`;
  if (presentation.category === 'COLOR' && presentation.color) return presentation.color.toUpperCase();
  if (presentation.category === 'PLAY_CARD' && presentation.cardKind) return `Play ${presentation.cardKind.replaceAll('_',' ')}`;
  if (presentation.category === 'DRAW_CARD') return 'Draw';
  if (presentation.category === 'ANSWER_MODE') return 'Answered Live';
  if (presentation.category === 'COMPLETION') return command.type === 'SUBMIT_DUEL_RESPONSE' ? 'Submit Response' : 'Mark Complete';
  if (presentation.category === 'VOTE' && presentation.voteForPlayerId) return `Vote ${playerName(session,presentation.voteForPlayerId)}`;
  if (command.type === 'ACTIVATE_GHOST') return 'ACTIVATE_GHOST';
  if (command.type === 'PLAY_NOPE') return 'PLAY_NOPE';
  if (presentation.category === 'CHOICE' && presentation.choiceKey) return presentation.choiceKey.replaceAll('_',' ');
  if (presentation.category === 'CONTINUE') return 'Continue';
  return command.type.replaceAll('_',' ');
}

function decisionControls(session:LiveSessionView, userId:string): string {
  const capabilities = session.capabilities;
  if (!capabilities.options.length) return '';
  return `<div class="filter-row">${capabilities.options.map(option => `<button class="button button--sm" type="button" data-live-option-id="${escapeHTML(option.optionId)}">${escapeHTML(decisionLabel(session,option))}</button>`).join('')}</div>`;
}

function socialControls(session:LiveSessionView, userId:string): string {
  const projected = decisionControls(session,userId);
  if (projected) return projected;
  const state = session.state;
  if (state.pendingEffect?.type === 'WILD_COLOR' && state.pendingEffect.playerId === userId) {
    return `<div class="filter-row">${(['lime','orange','cyan','purple'] as CardColor[]).map(color => button(color.toUpperCase(),'wild-color',`data-color="${color}"`)).join('')}</div>`;
  }
  const social = state.social;
  if (!social) return '';
  const actor = playerName(session,social.actorId);
  const target = playerName(session,social.pendingTargetId);
  const waitingFor = social.pendingTargetId ? target : actor;
  return `<span class="tag" data-tone="cyan">Waiting for shared rule action from ${escapeHTML(waitingFor)}</span>`;
}

export function renderLiveSession(session:LiveSessionView, userId:string, mode:'LIVE'|'LOCAL' = 'LIVE'): void {
  const local = mode === 'LOCAL';
  const boardCopy = local ? 'Local QA Simulation' : 'Shared live session';
  const state = session.state;
  const human = state.players.find(player => player.id === userId);
  const current = state.players.find(player => player.id === state.currentPlayerId);
  const top = state.discardPile.at(-1);
  const active = activeStateCopy(session);
  const playableCardIds = new Set(
    session.capabilities.options
      .filter(option => option.presentation.category === 'PLAY_CARD')
      .map(option => option.presentation.cardInstanceId)
      .filter((cardId): cardId is string => Boolean(cardId)),
  );
  const canDraw = session.capabilities.options.some(option => option.presentation.category === 'DRAW_CARD');

  const roomName = document.querySelector<HTMLElement>('#gameRoomName');
  if (roomName) roomName.textContent = local ? `Local ${session.room.joinCode}` : `Room ${session.room.joinCode}`;
  const roomMeta = document.querySelector<HTMLElement>('#gameRoomMeta');
  if (roomMeta) roomMeta.textContent = `${state.players.length} players • ${local ? 'ephemeral local simulation' : 'shared live session'} • rev ${state.revision}`;
  const badge = document.querySelector<HTMLElement>('#modeBadge');
  if (badge) { badge.textContent = local ? 'SIMULATION' : 'LIVE'; badge.dataset.tone = local ? 'cyan' : 'lime'; }
  const phase = document.querySelector<HTMLElement>('#boardPhaseLabel');
  if (phase) phase.textContent = state.phase.replaceAll('_',' / ');
  const currentName = document.querySelector<HTMLElement>('#currentTurnName');
  if (currentName) currentName.textContent = playerName(session,current?.id);
  const activeTitle = document.querySelector<HTMLElement>('#activeChallengeTitle');
  if (activeTitle) activeTitle.textContent = active.title;
  const activeCopy = document.querySelector<HTMLElement>('#activeChallengeCopy');
  if (activeCopy) activeCopy.textContent = active.copy;
  const inline = document.querySelector<HTMLElement>('#inlineFlowControls');
  if (inline) inline.innerHTML = socialControls(session,userId);
  const colorLabel = document.querySelector<HTMLElement>('#activeColorLabel');
  if (colorLabel) colorLabel.textContent = state.activeColor ? state.activeColor.toUpperCase() : '—';
  const timer = document.querySelector<HTMLElement>('#timerValue');
  if (timer) timer.textContent = state.timer ? String(Math.max(0,Math.ceil((state.timer.deadlineAt-Date.now())/1000))) : '—';

  const list = document.querySelector<HTMLElement>('#playerList');
  if (list) list.innerHTML = state.players.map(player => {
    const view = session.players.find(item => item.id === player.id);
    return `<div class="player-row${player.id === state.currentPlayerId ? ' is-current' : ''}${player.id === userId ? ' is-you' : ''}"><span class="avatar">${escapeHTML((view?.name || '?').slice(0,1).toUpperCase())}</span><span class="player-meta"><b>${escapeHTML(view?.name || player.id)}</b><span>${player.id === userId ? 'You' : 'Connected'}</span></span><strong class="card-count">${player.hand.length}</strong></div>`;
  }).join('');

  const hand = document.querySelector<HTMLElement>('#handScroll');
  if (hand) hand.innerHTML = human?.hand.map(card => renderCard(card,true,playableCardIds.has(card.id), boardCopy)).join('') || '<div class="empty-state"><h3>Empty hand</h3><p>Awaiting authoritative win check.</p></div>';
  const handCount = document.querySelector<HTMLElement>('#handCount');
  if (handCount) handCount.textContent = `${human?.hand.length ?? 0} cards`;
  const discard = document.querySelector<HTMLElement>('#discardSlot');
  if (discard) discard.innerHTML = top ? renderCard(top,false,false,boardCopy) : '<span class="tag">No discard</span>';
  renderDiscardedPile(state.discardPile);
  const drawCount = document.querySelector<HTMLElement>('#drawPileCount');
  if (drawCount) drawCount.textContent = `${state.drawPile.length} left`;
  const drawButton = document.querySelector<HTMLButtonElement>('#drawButton');
  if (drawButton) drawButton.setAttribute('aria-disabled',String(!canDraw));

  const pass = document.querySelector<HTMLButtonElement>('[data-action="safety-pass"]');
  if (pass) pass.setAttribute('aria-disabled',String(!(state.social && state.social.actorId === userId && ['truth','dare'].includes(state.social.cardKind))));
  const rewind = document.querySelector<HTMLButtonElement>('[data-action="safety-rewind"]');
  if (rewind) rewind.setAttribute('aria-disabled',String(!(state.social?.prompt && state.social.actorId === userId && !state.rewindUsedByPlayerIds.includes(userId))));
  const flag = document.querySelector<HTMLButtonElement>('[data-action="safety-flag"]');
  if (flag) flag.setAttribute('aria-disabled',String(!state.social?.prompt));

  const revision = document.querySelector<HTMLElement>('#revisionLabel');
  if (revision) revision.textContent = local ? `Local rev ${state.revision} · ephemeral, not persisted` : `Server rev ${state.revision} · Railway live`;
  activateSharedView('game', document as unknown as SharedNavigationRoot);
}

function extractApiMessage(error:unknown): string {
  if (error instanceof ApiError) {
    try {
      const body = JSON.parse(error.message) as {message?:string; error?:string};
      return body.message || body.error || error.message;
    } catch { return error.message; }
  }
  return error instanceof Error ? error.message : 'Request failed.';
}

export function toast(title:string, copy:string): void {
  const node = document.createElement('div');
  node.style.cssText = 'position:fixed;right:18px;bottom:18px;z-index:99999;background:#111827;color:#fff;padding:12px 14px;border-radius:12px;max-width:360px;box-shadow:0 10px 30px #0008';
  node.innerHTML = `<b>${escapeHTML(title)}</b><div style="margin-top:4px;font-size:12px">${escapeHTML(copy)}</div>`;
  document.body.append(node);
  window.setTimeout(() => node.remove(),3200);
}

export function readRoomCreatePayload() {
  const sources: Record<string,boolean> = {};
  document.querySelectorAll<HTMLButtonElement>('[data-source]').forEach(item => { if (item.dataset.source) sources[item.dataset.source] = item.getAttribute('aria-pressed') !== 'false'; });
  return {
    roomName:(document.querySelector<HTMLInputElement>('#roomName')?.value || 'Night Squad').trim(),
    mode:document.querySelector<HTMLSelectElement>('#modeSelect')?.value || document.querySelector<HTMLElement>('[data-mode][aria-pressed="true"]')?.dataset.mode || 'party',
    playerCount:Number(document.querySelector<HTMLInputElement>('#playerCount')?.value || 5),
    world:(document.querySelector<HTMLSelectElement>('#worldSelect')?.value === 'adult' ? 'adult' : 'clean') as 'adult'|'clean',
    ceiling:Number(document.querySelector<HTMLSelectElement>('#ceilingSelect')?.value || 3),
    sources,
  };
}

function installLiveControls(): void {
  const simulation = document.querySelector<HTMLButtonElement>('#startGameButton');
  if (!simulation || document.querySelector('[data-action="create-live-game"]')) return;
  simulation.innerHTML = '<svg class="icon"><use href="#i-play" /></svg>Local QA Simulation';
  simulation.setAttribute('aria-label','Local QA Simulation — not live Railway gameplay');
  simulation.title = 'Local QA Simulation — not live Railway gameplay';
  simulation.classList.remove('button--primary');
  const live = document.createElement('button');
  live.className = 'button button--primary';
  live.type = 'button';
  live.dataset.action = 'create-live-game';
  live.innerHTML = '<svg class="icon"><use href="#i-wifi" /></svg>Create Live Game';
  simulation.parentElement?.insertBefore(live,simulation);

  const joinLabel = document.querySelector<HTMLLabelElement>('label[for="joinCode"]');
  if (joinLabel) joinLabel.textContent = 'Join live room';
  const joinInput = document.querySelector<HTMLInputElement>('#joinCode');
  const helper = joinInput?.parentElement?.querySelector<HTMLElement>('.field-help');
  if (helper) helper.textContent = 'Joins the shared Railway room used by both Web and Telegram.';
}

export function startWebLiveRooms(api:CribbitApiClient): () => void {
  let live: LiveSession | null = null;
  let waitingRoom: WaitingRoomResult | null = null;
  let waitingRealtime: CribbitRealtimeClient | null = null;
  let pendingAuthenticatedAction: (() => void) | null = null;

  const authUnsubscribe = cribbitAuth.subscribe(state => {
    if (state.status === 'AUTHENTICATED' && pendingAuthenticatedAction) {
      const action = pendingAuthenticatedAction;
      pendingAuthenticatedAction = null;
      action();
    }
  });

  const requireAuth = (action:() => void): void => {
    if (cribbitAuth.current.status === 'AUTHENTICATED') return action();
    pendingAuthenticatedAction = action;
    openWebAuthDialog(api);
  };

  const closeWaitingRoom = (): void => {
    waitingRealtime?.disconnect();
    waitingRealtime = null;
    waitingRoom = null;
    document.querySelector('#ccWaitingRoom')?.remove();
  };

  const renderWaitingRoom = (room: WaitingRoomResult, userId: string): void => {
    const host = room.ownerUserId === userId;
    let panel = document.querySelector<HTMLElement>('#ccWaitingRoom');
    if (!panel) {
      panel = document.createElement('section');
      panel.id = 'ccWaitingRoom';
      panel.className = 'panel cc-waiting-room';
      const anchor = document.querySelector('[data-action="create-live-game"]');
      if (anchor?.parentElement) anchor.parentElement.insertBefore(panel, anchor.nextSibling);
      else document.querySelector('#app')?.append(panel);
    }
    panel.innerHTML = `
      <div class="panel-header"><div><h2 class="panel-title">Live room · ${escapeHTML(room.joinCode)}</h2>
      <p class="panel-subtitle">${room.status === 'STARTED' ? 'Game started' : `Waiting for players · ${room.memberCount}/${room.playerCount}`}</p></div></div>
      <div class="stack">${room.members.map(member => `<div class="row"><span class="tag">${escapeHTML(member.role)}</span><b>${escapeHTML(member.name)}</b><span>${member.seat + 1}</span></div>`).join('')}</div>
      ${host && room.status !== 'STARTED' ? `<button class="button button--primary" type="button" data-action="start-live-game" ${room.memberCount === room.playerCount ? '' : 'aria-disabled="true"'}>Start Game</button>` : ''}
      <p class="field-help">Share room code <b>${escapeHTML(room.joinCode)}</b>. Live rooms use real players only.</p>`;
  };

  const enterWaitingRoom = (room: WaitingRoomResult): void => {
    const auth = cribbitAuth.current;
    if (auth.status !== 'AUTHENTICATED') return;
    closeWaitingRoom();
    waitingRoom = room;
    if (room.status === 'STARTED' && room.sessionId) return void openRoom({ ok:true, roomId:room.roomId, sessionId:room.sessionId, joinCode:room.joinCode, players:[] });
    renderWaitingRoom(room, auth.user.id);
    waitingRealtime = new CribbitRealtimeClient(api.config);
    const socket = waitingRealtime.connect();
    waitingRealtime.joinRoomChannel(room.roomId);
    socket.on('room-updated', () => { void api.getRoom(room.roomId).then(next => { waitingRoom = next; renderWaitingRoom(next, auth.user.id); }).catch(() => undefined); });
    socket.on('room-started', (payload:{ sessionId?:string }) => {
      if (!payload?.sessionId) return;
      const room2 = waitingRoom;
      closeWaitingRoom();
      void openRoom({ ok:true, roomId:room2?.roomId ?? room.roomId, sessionId:payload.sessionId, joinCode:room2?.joinCode ?? room.joinCode, players:[] });
    });
    toast('Live room ready', `Room code ${room.joinCode}. Waiting for ${room.playerCount} real players.`);
  };

  const startWaitingRoom = (): void => {
    const room = waitingRoom;
    if (!room) return;
    void api.startRoom(room.roomId).then(openRoom).catch(error => toast('Could not start game', extractApiMessage(error)));
  };

  const openRoom = async (room:RoomSessionResult): Promise<void> => {
    closeWaitingRoom();
    const auth = cribbitAuth.current;
    if (auth.status !== 'AUTHENTICATED') return;
    live?.unsubscribe?.();
    live?.realtime.disconnect();
    const snapshot = await api.getSnapshot<GameState>(room.sessionId);
    const realtime = new CribbitRealtimeClient(api.config);
    live = { room, state:snapshot.state, capabilities:snapshot.capabilities, players:snapshot.players, realtime };
    const socket = realtime.connect();
    const refresh = async (payload:{sessionId?:string}) => {
      if (!live || payload.sessionId !== live.room.sessionId) return;
      try {
        const next = await api.getSnapshot<GameState>(live.room.sessionId);
        live.state = next.state;
        live.capabilities = next.capabilities;
        live.players = next.players;
        renderLiveSession(live,auth.user.id);
      } catch (error) { console.warn('[Cribbit] Web live snapshot refresh failed.',error); }
    };
    socket.on('session-updated',refresh);
    realtime.joinSession(room.sessionId);
    live.unsubscribe = () => socket.off('session-updated',refresh);
    renderLiveSession(live,auth.user.id);
    toast('Live room connected',`Room code ${room.joinCode}. Web and Telegram players share this session.`);
  };

  const send = async (body:CommandBody): Promise<void> => {
    const auth = cribbitAuth.current;
    if (!live || auth.status !== 'AUTHENTICATED') return;
    const command = {
      ...body,
      commandId:crypto.randomUUID(),
      playerId:auth.user.id,
      expectedRevision:live.state.revision,
      sessionId:live.room.sessionId,
    } as GameCommand;
    try {
      const response = await api.sendCommand<GameState>(command);
      if (response.state && response.capabilities) {
        live.state = response.state;
        live.capabilities = response.capabilities;
      } else {
        const snapshot = await api.getSnapshot<GameState>(live.room.sessionId);
        live.state = snapshot.state;
        live.capabilities = snapshot.capabilities;
        live.players = snapshot.players;
      }
      renderLiveSession(live,auth.user.id);
      if (!response.ok) toast('Action rejected',response.error?.message || 'The shared game rejected that action.');
    } catch (error) {
      toast('Live action failed',extractApiMessage(error));
      try {
        const snapshot = await api.getSnapshot<GameState>(live.room.sessionId);
        live.state = snapshot.state;
        live.capabilities = snapshot.capabilities;
        live.players = snapshot.players;
        renderLiveSession(live,auth.user.id);
      } catch { /* preserve last known state */ }
    }
  };

  const createLive = (): void => requireAuth(() => {
    void api.createRoom(readRoomCreatePayload()).then(enterWaitingRoom).catch(error => toast('Could not create live game',extractApiMessage(error)));
  });
  const joinLive = (): void => requireAuth(() => {
    const code = (document.querySelector<HTMLInputElement>('#joinCode')?.value || '').trim().toUpperCase();
    if (!/^[A-Z0-9]{4,12}$/.test(code)) return toast('Invalid room code','Enter 4–12 letters or numbers.');
    void api.joinRoom(code).then(enterWaitingRoom).catch(error => toast('Could not join room',extractApiMessage(error)));
  });

  installLiveControls();

  const capture = (event:Event): void => {
    const target = event.target instanceof Element ? event.target : null;
    if (!target) return;
    const create = target.closest('[data-action="create-live-game"]');
    const join = target.closest('[data-action="join-room"]');
    const startLive = target.closest('[data-action="start-live-game"]');
    if (startLive) {
      event.preventDefault();
      event.stopImmediatePropagation();
      startWaitingRoom();
      return;
    }
    if (create || join) {
      event.preventDefault();
      event.stopImmediatePropagation();
      if (create) createLive(); else joinLive();
      return;
    }
    if (!live) return;

    const play = target.closest<HTMLElement>('[data-action="play-card"]');
    const draw = target.closest('[data-action="draw-card"]');
    const pass = target.closest('[data-action="safety-pass"]');
    const rewind = target.closest('[data-action="safety-rewind"]');
    const flag = target.closest('[data-action="safety-flag"]');
    const liveAction = target.closest<HTMLElement>('[data-live-action]');
    const liveOption = target.closest<HTMLElement>('[data-live-option-id]');
    if (!(play || draw || pass || rewind || flag || liveAction || liveOption)) return;
    event.preventDefault();
    event.stopImmediatePropagation();

    if (play?.dataset.cardId) return void send({type:'PLAY_CARD',cardId:play.dataset.cardId});
    if (draw) return void send({type:'DRAW_CARD'});
    if (pass) return void send({type:'PASS_PROMPT'});
    if (rewind) return void send({type:'REWIND_PROMPT'});
    if (flag) return void send({type:'FLAG_PROMPT',promptId:live.state.social?.prompt?.id || '',reasonCode:'USER_FLAG'});
    if (liveOption?.dataset.liveOptionId) {
      const auth = cribbitAuth.current;
      const userId = auth.status === 'AUTHENTICATED' ? auth.user.id : '';
      const selected = live.capabilities.options.find(option => option.optionId === liveOption.dataset.liveOptionId);
      if (selected) return void send(selected.command as CommandBody);
      return;
    }
    if (!liveAction) return;
    const action = liveAction.dataset.liveAction;
    if (action === 'wild-color') return void send({type:'SELECT_WILD_COLOR',color:liveAction.dataset.color as CardColor});
    if (action === 'complete-flow') return void send({type:'COMPLETE_FLOW'});
    if (action === 'answer-live') {
      void (async () => { await send({type:'SELECT_ANSWER_MODE',mode:'ANSWERED_LIVE'}); await send({type:'MARK_ANSWERED_LIVE'}); })();
      return;
    }
    if (action === 'answer-type-open') return void send({type:'SELECT_ANSWER_MODE',mode:'TYPE'});
    if (action === 'answer-type-submit') {
      const value = document.querySelector<HTMLInputElement>('#ccLiveAnswer')?.value.trim() || '';
      if (!value) return toast('Answer required','Type an answer first.');
      void (async () => { await send({type:'REVIEW_ANSWER',value}); await send({type:'SUBMIT_ANSWER'}); })();
      return;
    }
    if (action === 'paranoia-target' && liveAction.dataset.playerId) return void send({type:'SELECT_PARANOIA_TARGET',targetId:liveAction.dataset.playerId});
    if (action === 'paranoia-classic') return void send({type:'SELECT_PARANOIA_PHASE',phase:'CLASSIC'});
    if (action === 'paranoia-stranger') return void send({type:'SELECT_PARANOIA_PHASE',phase:'STRANGER'});
    if (action === 'paranoia-answer' && liveAction.dataset.playerId) return void send({type:'SELECT_PARANOIA_CLASSIC_ANSWER',targetId:liveAction.dataset.playerId});
    if (action === 'paranoia-reveal') return void send({type:'SUBMIT_PARANOIA_CLASSIC_DECISION',decision:'REVEAL'});
    if (action === 'paranoia-secret') return void send({type:'SUBMIT_PARANOIA_CLASSIC_DECISION',decision:'KEEP_SECRET'});
    if (action === 'paranoia-vote' && liveAction.dataset.vote) return void send({type:'SUBMIT_PARANOIA_VOTE',vote:liveAction.dataset.vote as 'BELIEVE'|'LYING'|'HOLDING_BACK'});
    if (action === 'duel-target' && liveAction.dataset.playerId) return void send({type:'SELECT_DUEL_TARGET',targetId:liveAction.dataset.playerId});
    if (action === 'duel-response-initiator') return void send({type:'SUBMIT_DUEL_RESPONSE',side:'initiator',completionOnly:true});
    if (action === 'duel-response-opponent') return void send({type:'SUBMIT_DUEL_RESPONSE',side:'opponent',completionOnly:true});
    if (action === 'duel-vote' && liveAction.dataset.playerId) return void send({type:'DUEL_VOTE',winnerId:liveAction.dataset.playerId});
  };
  document.addEventListener('click',capture);

  const enterCapture = (event:KeyboardEvent): void => {
    if (event.key !== 'Enter' || !(event.target instanceof HTMLInputElement) || event.target.id !== 'joinCode') return;
    event.preventDefault();
    event.stopImmediatePropagation();
    joinLive();
  };
  document.addEventListener('keydown',enterCapture,true);

  return () => {
    authUnsubscribe();
    live?.unsubscribe?.();
    live?.realtime.disconnect();
    document.removeEventListener('click',capture);
    document.removeEventListener('keydown',enterCapture,true);
  };
}
