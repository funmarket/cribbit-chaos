import type { AnswerMode, GameState, ParanoiaPhase } from '../../../packages/contracts/src/index.ts';
import type { PlatformAdapter } from '../../../packages/platform/src/types.ts';
import type { TelegramBackendGame } from './backendGame.ts';
import './styles/contextual.css';

type Tone = 'neutral' | 'success' | 'warning';
type StatusSetter = (message: { text:string; tone:Tone }) => void;

type ContextAction = {
  title: string;
  body: string;
};

export function openContextualRuleUI(
  host: HTMLElement,
  platform: PlatformAdapter,
  game: TelegramBackendGame,
  onChanged: () => void,
  setStatus: StatusSetter,
): boolean {
  closeContextualRuleUI(host);
  const action = contextualAction(game.getState(), game);
  if (!action) return false;

  const wrapper = document.createElement('div');
  wrapper.className = 'tg-context-layer';
  wrapper.dataset.contextLayer = 'active';
  wrapper.innerHTML = `
    <button class="tg-context-scrim" type="button" data-context-scrim aria-label="Close contextual panel"></button>
    <section class="tg-context-sheet" role="dialog" aria-modal="true" aria-labelledby="tgContextTitle">
      <div class="tg-context-handle" aria-hidden="true"></div>
      <header class="tg-context-header">
        <div>
          <small>ACTIVE GAME ACTION</small>
          <h2 id="tgContextTitle">${escapeHTML(action.title)}</h2>
        </div>
        <button type="button" class="tg-context-close" data-context-close aria-label="Close">×</button>
      </header>
      ${action.body}
      <p class="tg-context-authority">Shared game state decides whether each action is legal and what happens next.</p>
    </section>
  `;
  host.append(wrapper);

  const close = () => closeContextualRuleUI(host);
  wrapper.querySelector<HTMLElement>('[data-context-scrim]')?.addEventListener('click', close);
  wrapper.querySelector<HTMLElement>('[data-context-close]')?.addEventListener('click', close);

  wrapper.querySelectorAll<HTMLButtonElement>('[data-command]').forEach(button => {
    button.addEventListener('click', async () => {
      button.disabled = true;
      const result = await runCommand(button, wrapper, game);
      platform.haptic(result.ok ? 'medium' : 'light');
      setStatus(result.ok
        ? { text:result.success ?? 'Game state updated.', tone:'success' }
        : { text:result.error ?? 'The game rejected that action.', tone:'warning' });
      close();
      onChanged();
    });
  });

  platform.haptic('light');
  return true;
}

export function closeContextualRuleUI(host: HTMLElement): void {
  host.querySelector<HTMLElement>('[data-context-layer]')?.remove();
}

export function hasContextualAction(state: GameState, game: TelegramBackendGame): boolean {
  return Boolean(contextualAction(state, game));
}

function contextualAction(state: GameState, game: TelegramBackendGame): ContextAction | null {
  const social = state.social;
  const humanId = game.humanPlayerId;

  if (!social) return null;

  if (social.resolutionComplete) {
    if (social.actorId !== humanId) return null;
    return {
      title:'Continue',
      body:`<p class="tg-context-copy">This card effect is resolved. Continue the authoritative flow.</p>${commandButton('COMPLETE_FLOW','Continue','')}`,
    };
  }

  if (social.cardKind === 'truth' || social.cardKind === 'dare') {
    if (social.actorId !== humanId || !social.prompt) return null;
    return truthDareAction(state, social.cardKind);
  }

  if (social.cardKind === 'chaos') {
    if (!social.pendingCompletionPlayerIds.includes(humanId) || social.completedCompletionPlayerIds.includes(humanId)) return null;
    const record = social.completionRecords[humanId];
    if (!record?.mode) {
      return {
        title:'Chaos',
        body:`${promptCard('CHAOS', social.prompt?.text ?? 'Complete the active Chaos effect.')}${commandButton('CHAOS_LIVE','Completed / Answered Live','')}`,
      };
    }
    return {
      title:'Chaos',
      body:`${promptCard('CHAOS', social.prompt?.text ?? 'Complete the active Chaos effect.')}${commandButton('MARK_ANSWERED_LIVE','Confirm completion','')}`,
    };
  }

  if (social.cardKind === 'paranoia') {
    const prompt = social.prompt?.text ?? 'Paranoia';
    if (!social.pendingTargetId && social.actorId === humanId) {
      return {
        title:'Choose a Player',
        body:`${promptCard('PARANOIA', prompt)}${targetGrid(state, game, social.pendingTargetIds, 'SELECT_PARANOIA_TARGET')}`,
      };
    }
    if (social.pendingTargetId && !social.paranoiaPhase && social.actorId === humanId) {
      return {
        title:'Classic or Stranger?',
        body:`${promptCard('PARANOIA', prompt)}<div class="tg-answer-grid">${commandButton('SELECT_PARANOIA_PHASE','Classic','CLASSIC')}${commandButton('SELECT_PARANOIA_PHASE','Stranger','STRANGER')}</div>`,
      };
    }
    if (social.paranoiaPhase === 'CLASSIC' && !social.classicAnswerPlayerId && social.pendingTargetId === humanId) {
      const eligible = state.players.filter(player => player.id !== humanId).map(player => player.id);
      return {
        title:'Choose Answer Player',
        body:`<p class="tg-context-copy">Choose another player for the Classic Paranoia answer.</p>${targetGrid(state, game, eligible, 'SELECT_PARANOIA_CLASSIC_ANSWER')}`,
      };
    }
    if (social.paranoiaPhase === 'CLASSIC' && social.classicAnswerPlayerId === humanId && !social.classicRevealDecision) {
      return {
        title:'Reveal or Keep Secret?',
        body:`<div class="tg-answer-grid">${commandButton('SUBMIT_PARANOIA_CLASSIC_DECISION','Reveal','REVEAL')}${commandButton('SUBMIT_PARANOIA_CLASSIC_DECISION','Keep Secret','KEEP_SECRET')}</div>`,
      };
    }
    if (social.paranoiaPhase === 'STRANGER' && social.paranoiaVote?.eligibleVoterIds.includes(humanId) && !social.paranoiaVote.votes[humanId]) {
      return {
        title:'Stranger Vote',
        body:`<p class="tg-context-copy">Vote on the selected player's response.</p><div class="tg-answer-grid">${commandButton('SUBMIT_PARANOIA_VOTE','Believe','BELIEVE')}${commandButton('SUBMIT_PARANOIA_VOTE','Lying','LYING')}${commandButton('SUBMIT_PARANOIA_VOTE','Holding Back','HOLDING_BACK')}</div>`,
      };
    }
    return null;
  }

  if (social.cardKind === 'duel') {
    const duel = social.pendingDuel;
    if (!duel?.opponentId && social.actorId === humanId) {
      return {
        title:'Choose Duel Target',
        body:targetGrid(state, game, social.pendingTargetIds, 'SELECT_DUEL_TARGET'),
      };
    }
    if (!duel?.opponentId) return null;
    const prompt = duel.prompt?.text ?? social.prompt?.text ?? 'Complete the Duel response.';
    if (duel.initiatorId === humanId && !duel.initiatorResponse?.submitted) {
      return {
        title:'Your Duel Response',
        body:`${promptCard('DUEL', prompt)}${commandButton('SUBMIT_DUEL_RESPONSE','Answered Live','initiator')}`,
      };
    }
    if (duel.opponentId === humanId && !duel.opponentResponse?.submitted) {
      return {
        title:'Your Duel Response',
        body:`${promptCard('DUEL', prompt)}${commandButton('SUBMIT_DUEL_RESPONSE','Answered Live','opponent')}`,
      };
    }
    if (duel.vote?.eligibleVoterIds.includes(humanId) && !duel.vote.votes[humanId]) {
      return {
        title:'Duel Group Vote',
        body:`<p class="tg-context-copy">Choose the Duel winner.</p>${targetGrid(state, game, [duel.initiatorId, duel.opponentId], 'DUEL_VOTE')}`,
      };
    }
  }

  return null;
}

function truthDareAction(state: GameState, kind: 'truth' | 'dare'): ContextAction {
  const social = state.social!;
  const prompt = social.prompt!;
  const answer = social.answerState;
  const title = kind === 'truth' ? 'Truth' : 'Dare';

  if (!answer.mode) {
    const choose = prompt.options?.length ? commandButton('SELECT_ANSWER_MODE','Choose','CHOOSE') : '';
    return {
      title,
      body:`${promptCard(title.toUpperCase(), prompt.text)}<div class="tg-answer-grid">${commandButton('SELECT_ANSWER_MODE','Speak','SPEAK')}${commandButton('SELECT_ANSWER_MODE','Type','TYPE')}${choose}${commandButton('ANSWERED_LIVE_NOW','Answered Live','ANSWERED_LIVE')}</div>${commandButton('PASS_PROMPT','Pass / Not For Me','')}`,
    };
  }

  if (answer.mode === 'CHOOSE') {
    return {
      title,
      body:`${promptCard(title.toUpperCase(), prompt.text)}<div class="tg-answer-grid">${(prompt.options ?? []).map(option => commandButton('SUBMIT_CHOICE', option, option)).join('')}</div>`,
    };
  }

  if (answer.mode === 'TYPE') {
    return {
      title,
      body:`${promptCard(title.toUpperCase(), prompt.text)}<textarea class="tg-input" data-context-answer rows="4" maxlength="500" placeholder="Type your answer"></textarea>${commandButton('SUBMIT_TYPED_ANSWER','Submit answer','')}`,
    };
  }

  if (answer.mode === 'SPEAK') {
    return {
      title,
      body:`${promptCard(title.toUpperCase(), prompt.text)}<p class="tg-context-copy">Speak your answer to the group, then confirm completion.</p>${commandButton('SUBMIT_SPOKEN_ANSWER','Spoken / Done','')}`,
    };
  }

  return {
    title,
    body:`${promptCard(title.toUpperCase(), prompt.text)}${commandButton('MARK_ANSWERED_LIVE','Confirm Answered Live','')}`,
  };
}

async function runCommand(
  button: HTMLButtonElement,
  wrapper: HTMLElement,
  game: TelegramBackendGame,
): Promise<{ ok:boolean; success?:string; error?:string }> {
  const command = button.dataset.command ?? '';
  const value = button.dataset.value ?? '';

  const send = async (payload: Parameters<TelegramBackendGame['send']>[0]) => {
    const result = await game.send(payload);
    return result.ok
      ? { ok:true as const }
      : { ok:false as const, error:result.error?.message ?? 'The game rejected that action.' };
  };

  if (command === 'SELECT_ANSWER_MODE') {
    return { ...(await send({ type:'SELECT_ANSWER_MODE', mode:value as AnswerMode })), success:`${value} selected.` };
  }
  if (command === 'ANSWERED_LIVE_NOW') {
    const selected = await send({ type:'SELECT_ANSWER_MODE', mode:'ANSWERED_LIVE' });
    if (!selected.ok) return selected;
    const marked = await send({ type:'MARK_ANSWERED_LIVE' });
    return marked.ok ? { ok:true, success:'Answered Live recorded.' } : marked;
  }
  if (command === 'SUBMIT_TYPED_ANSWER') {
    const answer = wrapper.querySelector<HTMLTextAreaElement>('[data-context-answer]')?.value.trim() ?? '';
    if (!answer) return { ok:false, error:'Type an answer before submitting.' };
    const reviewed = await send({ type:'REVIEW_ANSWER', value:answer });
    if (!reviewed.ok) return reviewed;
    const submitted = await send({ type:'SUBMIT_ANSWER' });
    return submitted.ok ? { ok:true, success:'Answer submitted.' } : submitted;
  }
  if (command === 'SUBMIT_SPOKEN_ANSWER') {
    const reviewed = await send({ type:'REVIEW_ANSWER', completionOnly:true });
    if (!reviewed.ok) return reviewed;
    const submitted = await send({ type:'SUBMIT_ANSWER' });
    return submitted.ok ? { ok:true, success:'Spoken answer completed.' } : submitted;
  }
  if (command === 'SUBMIT_CHOICE') return { ...(await send({ type:'SUBMIT_CHOICE', choice:value })), success:'Choice submitted.' };
  if (command === 'MARK_ANSWERED_LIVE') return { ...(await send({ type:'MARK_ANSWERED_LIVE' })), success:'Completion recorded.' };
  if (command === 'CHAOS_LIVE') {
    const selected = await send({ type:'SELECT_ANSWER_MODE', mode:'ANSWERED_LIVE' });
    if (!selected.ok) return selected;
    const marked = await send({ type:'MARK_ANSWERED_LIVE' });
    return marked.ok ? { ok:true, success:'Chaos completion recorded.' } : marked;
  }
  if (command === 'PASS_PROMPT') return { ...(await game.passPrompt()), success:'Prompt passed.' };
  if (command === 'COMPLETE_FLOW') return { ...(await send({ type:'COMPLETE_FLOW' })), success:'Flow completed.' };
  if (command === 'SELECT_PARANOIA_TARGET') return { ...(await send({ type:'SELECT_PARANOIA_TARGET', targetId:value })), success:'Paranoia target selected.' };
  if (command === 'SELECT_PARANOIA_PHASE') return { ...(await send({ type:'SELECT_PARANOIA_PHASE', phase:value as ParanoiaPhase })), success:`${value} selected.` };
  if (command === 'SELECT_PARANOIA_CLASSIC_ANSWER') return { ...(await send({ type:'SELECT_PARANOIA_CLASSIC_ANSWER', targetId:value })), success:'Answer player selected.' };
  if (command === 'SUBMIT_PARANOIA_CLASSIC_DECISION') return { ...(await send({ type:'SUBMIT_PARANOIA_CLASSIC_DECISION', decision:value as 'REVEAL'|'KEEP_SECRET' })), success:'Paranoia decision submitted.' };
  if (command === 'SUBMIT_PARANOIA_VOTE') return { ...(await send({ type:'SUBMIT_PARANOIA_VOTE', vote:value as 'BELIEVE'|'LYING'|'HOLDING_BACK' })), success:'Vote submitted.' };
  if (command === 'SELECT_DUEL_TARGET') return { ...(await send({ type:'SELECT_DUEL_TARGET', targetId:value })), success:'Duel target selected.' };
  if (command === 'SUBMIT_DUEL_RESPONSE') return { ...(await send({ type:'SUBMIT_DUEL_RESPONSE', side:value as 'initiator'|'opponent', completionOnly:true })), success:'Duel response submitted.' };
  if (command === 'DUEL_VOTE') return { ...(await send({ type:'DUEL_VOTE', winnerId:value })), success:'Duel vote submitted.' };

  return { ok:false, error:`Unsupported Telegram action: ${command}` };
}

function targetGrid(
  state: GameState,
  game: TelegramBackendGame,
  targetIds: readonly string[],
  command: string,
): string {
  return `<div class="tg-target-grid">${targetIds.map(id => {
    const name = game.players.find(player => player.id === id)?.name ?? id;
    return `<button type="button" data-command="${escapeHTML(command)}" data-value="${escapeHTML(id)}"><span>${escapeHTML(name.slice(0,1).toUpperCase())}</span><b>${escapeHTML(name)}</b></button>`;
  }).join('')}</div>`;
}

function promptCard(label: string, text: string): string {
  return `<div class="tg-prompt-card"><small>${escapeHTML(label)}</small><p>${escapeHTML(text)}</p></div>`;
}

function commandButton(command: string, label: string, value: string): string {
  return `<button class="tg-context-wide" type="button" data-command="${escapeHTML(command)}" data-value="${escapeHTML(value)}">${escapeHTML(label)}</button>`;
}

function escapeHTML(value: unknown): string {
  return String(value ?? '').replace(/[&<>'"]/g, char => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', "'":'&#39;', '"':'&quot;' })[char] || char);
}
