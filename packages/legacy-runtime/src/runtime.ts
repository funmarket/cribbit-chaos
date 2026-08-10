// @ts-nocheck
// Phase-1 compatibility runtime extracted verbatim from the approved V4 prototype.
// Migrate command/state logic into packages/game-engine incrementally without changing UX behavior.
(() => {
    'use strict';

    const COLOR_META = {
      lime: { label: 'Acid Lime', css: 'var(--lime)', rgb: '169,255,46' },
      orange: { label: 'Volt Orange', css: 'var(--orange)', rgb: '255,122,24' },
      cyan: { label: 'Ice Cyan', css: 'var(--cyan)', rgb: '54,208,255' },
      purple: { label: 'Plasma Purple', css: 'var(--purple)', rgb: '179,76,255' }
    };

    const FAMILY_META = {
      truth: { title: 'Truth', icon: 'i-truth', accent: 'lime', rule: '<strong>Reveal something real.</strong><br>Answer honestly.', role: 'Social card', resolution: 'Select an eligible Truth prompt, collect an explicit answer, resolve authorship and continue.' },
      dare: { title: 'Dare', icon: 'i-lightning', accent: 'orange', rule: '<strong>Do something bold.</strong><br>Complete the challenge.', role: 'Social card', resolution: 'Select an eligible Dare, run the timer or completion path, register an explicit completion and continue.' },
      paranoia: { title: 'Paranoia', icon: 'i-paranoia', accent: 'purple', rule: '<strong>Trust no one.</strong><br>Choose, guess or suspect.', role: 'Social card', resolution: 'Collect a private explicit choice and reveal only what the prompt contract permits.' },
      chaos: { title: 'Chaos', icon: 'i-spiral', accent: 'magenta', rule: '<strong>Shake things up.</strong><br>Resolve the effect.', role: 'Special card', resolution: 'Resolve one deterministic tested Chaos effect exactly once.' },
      duel: { title: 'Duel', icon: 'i-swords', accent: 'cyan', rule: '<strong>Challenge another player.</strong><br>Resolve the Duel.', role: 'Special card', resolution: 'Run two sequential single-player windows, compare results, log the outcome and resume normal play.' },
      nope: { title: 'Nope', icon: 'i-hand', accent: 'gold', rule: '<strong>Not today.</strong><br>Block an eligible effect.', role: 'Tactical hand card', resolution: 'Consume Nope during a permitted reaction window and block or redirect the eligible effect.' }
    };

    const MODES = {
      duel: { label: 'Duel', min: 2, max: 2, defaultPlayers: 2, timerMultiplier: 1.15, copy: 'Fast head-to-head pacing; Reverse returns the turn.' },
      squad: { label: 'Squad', min: 3, max: 4, defaultPlayers: 4, timerMultiplier: 1.05, copy: 'Balanced social counterplay and easiest format to teach.' },
      party: { label: 'Party', min: 5, max: 7, defaultPlayers: 5, timerMultiplier: 1, copy: 'Primary social format with more reactions and Paranoia.' },
      mayhem: { label: 'Mayhem', min: 8, max: 10, defaultPlayers: 8, timerMultiplier: .7, copy: 'Shorter timers and stronger anti-downtime pacing.' }
    };

    const STAGES = {
      clean: [
        { label: 'Warm Up', ceiling: 0 },
        { label: 'Funny', ceiling: 1 },
        { label: 'Challenge', ceiling: 2 },
        { label: 'Wild', ceiling: 3 },
        { label: 'Final Chaos', ceiling: 4 }
      ],
      adult: [
        { label: 'Warm Up', ceiling: 0 },
        { label: 'Personal', ceiling: 1 },
        { label: 'Bold', ceiling: 2 },
        { label: 'Chaos', ceiling: 3 },
        { label: 'Endgame', ceiling: 4 }
      ]
    };

    const CEILINGS = {
      clean: [
        { value: 0, label: 'Easy' },
        { value: 1, label: 'Funny' },
        { value: 3, label: 'Wild' },
        { value: 4, label: 'Max' }
      ],
      adult: [
        { value: 0, label: 'Chill' },
        { value: 1, label: 'Flirty' },
        { value: 2, label: 'Bold' },
        { value: 3, label: 'Chaos' }
      ]
    };

    const DEMO_CHAOS_EFFECTS = [
      { id: 'swap-hands', title: 'Swap Hands', copy: 'Choose one player. The server swaps both hands atomically.', targeted: true },
      { id: 'forced-roulette', title: 'Forced Roulette', copy: 'The server selects Truth or Dare, then the anonymous wheel visualizes the sealed prompt.', targeted: false },
      { id: 'group-answer', title: 'Group Answer', copy: 'Everyone answers the next eligible question. Bots resolve automatically; the active player uses an explicit answer path.', targeted: false }
    ];

    const BASE_PROMPTS = [
      { id: 'clean-truth-school', type: 'truth', text: 'What is the funniest thing that ever happened to you at school?', world: 'clean', stage: 1, source: 'original', author: 'Cribbit', authorship: 'signed', targeting: 'current', options: [] },
      { id: 'clean-truth-talent', type: 'truth', text: 'What harmless talent would surprise this group the most?', world: 'clean', stage: 0, source: 'community', author: 'Zoe', authorship: 'reveal', targeting: 'current', options: ['A performance', 'A skill', 'A fact about me'] },
      { id: 'clean-truth-game', type: 'truth', text: 'Which game do you become unexpectedly competitive about?', world: 'clean', stage: 1, source: 'house', author: 'House Deck', authorship: 'taboo', targeting: 'current', options: ['Video game', 'Board game', 'Sport'] },
      { id: 'clean-dare-villain', type: 'dare', text: 'Act like a cartoon villain for 20 seconds. The group guesses the type.', world: 'clean', stage: 1, source: 'original', author: 'Cribbit', authorship: 'signed', targeting: 'current', options: [] },
      { id: 'clean-dare-movie', type: 'dare', text: 'Describe a famous movie without character names. The first correct guess ends the Dare.', world: 'clean', stage: 2, source: 'community', author: 'Arjun', authorship: 'reveal', targeting: 'current', options: [] },
      { id: 'clean-dare-pose', type: 'dare', text: 'Hold the weirdest heroic pose you can invent until the next player begins.', world: 'clean', stage: 1, source: 'house', author: 'House Deck', authorship: 'taboo', targeting: 'current', options: [] },
      { id: 'clean-paranoia-detective', type: 'paranoia', text: 'Who here would make the best cartoon detective?', world: 'clean', stage: 1, source: 'original', author: 'Cribbit', authorship: 'signed', targeting: 'specific', options: [] },
      { id: 'clean-duel-countries', type: 'duel', text: 'You each have 15 seconds to name as many African countries as possible.', world: 'clean', stage: 2, source: 'original', author: 'Cribbit', authorship: 'signed', targeting: 'specific', options: [] },
      { id: 'clean-chaos-animal', type: 'chaos', text: 'Everyone has 10 seconds to draw an animal. The active player chooses the funniest.', world: 'clean', stage: 3, source: 'original', author: 'Cribbit', authorship: 'signed', targeting: 'all', options: [] },
      { id: 'adult-truth-assumption', type: 'truth', text: 'What assumption does this group have about you that is completely wrong?', world: 'adult', stage: 1, source: 'original', author: 'Cribbit', authorship: 'signed', targeting: 'current', options: [] },
      { id: 'adult-truth-draft', type: 'truth', text: 'What is a message you drafted and never sent?', world: 'adult', stage: 1, source: 'live', author: 'Mia', authorship: 'reveal', targeting: 'current', options: [] },
      { id: 'adult-truth-choice', type: 'truth', text: 'Which part of your reputation is most misunderstood?', world: 'adult', stage: 1, source: 'community', author: 'Sam', authorship: 'taboo', targeting: 'current', options: ['Too quiet', 'Too confident', 'Too serious'] },
      { id: 'adult-dare-nickname', type: 'dare', text: 'Let the group choose a harmless nickname you answer to until your next turn.', world: 'adult', stage: 2, source: 'original', author: 'Cribbit', authorship: 'signed', targeting: 'current', options: [] },
      { id: 'adult-dare-impression', type: 'dare', text: 'Do your best celebrity impression for 20 seconds.', world: 'adult', stage: 1, source: 'community', author: 'Nina', authorship: 'reveal', targeting: 'current', options: [] },
      { id: 'adult-dare-story', type: 'dare', text: 'Tell a dramatic ten-second story using only three words chosen by the group.', world: 'adult', stage: 2, source: 'house', author: 'House Deck', authorship: 'taboo', targeting: 'current', options: [] },
      { id: 'adult-paranoia-lie', type: 'paranoia', text: 'Choose privately: who here would be hardest to fool in a lie?', world: 'adult', stage: 1, source: 'original', author: 'Cribbit', authorship: 'signed', targeting: 'specific', options: [] },
      { id: 'adult-paranoia-plan', type: 'paranoia', text: 'Who here is most likely to have a secret backup plan?', world: 'adult', stage: 1, source: 'community', author: 'Jordan', authorship: 'reveal', targeting: 'specific', options: [] },
      { id: 'adult-duel-liar', type: 'duel', text: 'You each get 15 seconds to convince the room you are the better liar. The room votes.', world: 'adult', stage: 2, source: 'original', author: 'Cribbit', authorship: 'signed', targeting: 'specific', options: [] },
      { id: 'adult-chaos-reverse', type: 'chaos', text: 'Everyone answers the next eligible question in reverse turn order.', world: 'adult', stage: 3, source: 'original', author: 'Cribbit', authorship: 'signed', targeting: 'all', options: [] }
    ].map((prompt,index) => ({
      ...prompt,
      approved: true,
      saved: Math.floor(420 + ((index + 3) * 337) % 4200),
      plays: Math.floor(1800 + ((index + 5) * 977) % 14500),
      category: prompt.type === 'truth' ? (index % 2 ? 'Friends' : 'Funny') : prompt.type === 'dare' ? (index % 2 ? 'Party' : 'Creativity') : prompt.type === 'paranoia' ? 'Most Likely To' : prompt.type === 'duel' ? 'Challenge' : 'Party',
      tags: [prompt.world, prompt.type, prompt.source],
      minPlayers: prompt.type === 'duel' ? 2 : prompt.type === 'paranoia' ? 3 : 2,
      maxPlayers: 10,
      staffPick: index % 5 === 0,
      legendary: index % 7 === 0,
      createdAt: Date.now() - index * 86400000
    }));

    const BOT_NAMES = ['Maya', 'Leo', 'Nina', 'Jordan', 'Sam', 'Alex', 'Zoe', 'Arjun', 'Dev'];
    const AVATAR_COLORS = ['var(--magenta)','var(--orange)','var(--cyan)','var(--purple)','var(--gold)','var(--lime)','var(--teal)'];
    const PHASES = ['TURN_START','PLAY_DRAW','TRIGGER','ANSWER_RESOLVE','WIN_CHECK','NEXT_TURN'];

    const state = {
      view: 'lobby',
      setup: {
        mode: 'party',
        playerCount: 5,
        world: 'clean',
        ceiling: 3,
        sources: { original: true, community: true, house: true, live: true },
        qaHand: true,
        roomName: 'Night Squad',
        profileName: 'You'
      },
      knobs: {
        startingHand: 7,
        drawPenalty: 2,
        turnTimer: 40,
        stageEvery: 4,
        voluntaryDraw: false,
        socialAlwaysLegal: true,
        finalSocialWin: 'after',
        nopeContract: 'draw-chaos'
      },
      session: null,
      revision: 0,
      commandCounter: 0,
      commandCache: new Map(),
      lastHumanCommand: null,
      connection: 'CONNECTED',
      reconnectDeadline: null,
      reactionDeadline: null,
      timerInterval: null,
      botTimer: null,
      flow: null,
      currentFilter: 'all',
      promptSearch: '',
      prompts: [...BASE_PROMPTS],
      mySaved: new Set(),
      houseSaved: new Set(),
      recentPrompts: [],
      events: [],
      nextChaosEffect: null,
      ecosystem: {
        boardTab: 'all',
        libraryTab: 'my',
        createDestination: 'my',
        liveRoomPool: new Set(),
        submissions: [],
        roomWeights: { original: 50, community: 20, house: 20, live: 10 },
        roomCategories: new Set(['Truth','Dare','Friends','Funny','Party','Most Likely To']),
        roomVibe: { from: 0, to: 2 },
        activityOpen: true,
        notifications: [
          { id:'n1', title:'House Deck ready', copy:'Save standout prompts in Recap to start building group lore.', tone:'orange' },
          { id:'n2', title:'Community moderation', copy:'Suggesting globally is separate from saving privately.', tone:'magenta' },
          { id:'n3', title:'Privacy lock', copy:'Passive call conversation never counts as gameplay input.', tone:'cyan' }
        ]
      },
      renderLock: false
    };

    const $ = (selector, root = document) => root.querySelector(selector);
    const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
    const mod = (value, n) => ((value % n) + n) % n;
    const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
    const escapeHTML = value => String(value ?? '').replace(/[&<>'"]/g, ch => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', "'":'&#39;', '"':'&quot;' }[ch]));
    const icon = id => `<svg class="icon" aria-hidden="true"><use href="#${id}"></use></svg>`;
    const nowTime = () => new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });

    function seededRandom(seed) {
      let t = seed >>> 0;
      return () => {
        t += 0x6D2B79F5;
        let r = Math.imul(t ^ t >>> 15, 1 | t);
        r ^= r + Math.imul(r ^ r >>> 7, 61 | r);
        return ((r ^ r >>> 14) >>> 0) / 4294967296;
      };
    }

    function shuffle(array, random = Math.random) {
      for (let i = array.length - 1; i > 0; i--) {
        const j = Math.floor(random() * (i + 1));
        [array[i], array[j]] = [array[j], array[i]];
      }
      return array;
    }

    function toast(title, message, tone = 'cyan', duration = 3200) {
      const region = $('#toastRegion');
      const color = tone === 'lime' ? 'var(--lime)' : tone === 'magenta' ? 'var(--magenta)' : tone === 'orange' ? 'var(--orange)' : tone === 'gold' ? 'var(--gold)' : tone === 'red' ? 'var(--red)' : 'var(--cyan)';
      const node = document.createElement('div');
      node.className = 'toast';
      node.style.setProperty('--toast-color', color);
      node.innerHTML = `<b>${escapeHTML(title)}</b><p>${escapeHTML(message)}</p>`;
      region.append(node);
      setTimeout(() => node.remove(), duration);
    }

    function announce(message) {
      const node = $('#liveRegion');
      node.textContent = '';
      requestAnimationFrame(() => { node.textContent = message; });
    }

    function addEvent(type, message, tone = 'cyan', data = {}) {
      state.events.unshift({ id: `${Date.now()}-${Math.random()}`, type, message, tone, data, time: nowTime(), revision: state.revision });
      state.events = state.events.slice(0, 60);
    }

    function commandKey(type) {
      state.commandCounter += 1;
      return `client-${type.toLowerCase()}-${state.commandCounter}`;
    }

    function updateSetupFromInputs() {
      state.setup.profileName = ($('#profileName')?.value || 'You').trim() || 'You';
      state.setup.roomName = ($('#roomName')?.value || 'Night Squad').trim() || 'Night Squad';
      state.setup.world = $('#worldSelect')?.value || state.setup.world;
      state.setup.ceiling = Number($('#ceilingSelect')?.value ?? state.setup.ceiling);
      state.setup.playerCount = Number($('#playerCount')?.value ?? state.setup.playerCount);
      state.setup.qaHand = Boolean($('#qaHandToggle')?.checked);
    }

    function updateKnobsFromInputs() {
      state.knobs.startingHand = clamp(Number($('#knobStartingHand')?.value || 7), 1, 12);
      state.knobs.drawPenalty = clamp(Number($('#knobDrawPenalty')?.value || 2), 1, 6);
      state.knobs.turnTimer = clamp(Number($('#knobTurnTimer')?.value || 40), 10, 120);
      state.knobs.stageEvery = clamp(Number($('#knobStageEvery')?.value || 4), 2, 12);
      state.knobs.voluntaryDraw = Boolean($('#knobVoluntaryDraw')?.checked);
      state.knobs.socialAlwaysLegal = Boolean($('#knobSocialAlways')?.checked);
      state.knobs.finalSocialWin = $('#knobFinalSocial')?.value || 'after';
      state.knobs.nopeContract = $('#knobNopeContract')?.value || 'draw-chaos';
    }

    function renderCeilingOptions() {
      const select = $('#ceilingSelect');
      const promptIntensity = $('#promptIntensity');
      const options = CEILINGS[state.setup.world];
      if (select) {
        select.innerHTML = options.map(option => `<option value="${option.value}">${option.label}</option>`).join('');
        const available = options.some(option => option.value === state.setup.ceiling);
        if (!available) state.setup.ceiling = options[options.length - 1].value;
        select.value = String(state.setup.ceiling);
      }
      if (promptIntensity) {
        promptIntensity.innerHTML = STAGES[state.setup.world].map((stage, index) => `<option value="${index}">${stage.label}</option>`).join('');
      }
    }


    /* ---------- Viewport / rail layout controller ---------- */
    const BOARD_SPECS = {
      desktop: { width: 500, height: 780 },
      mobile: { width: 380, height: 700 }
    };

    const layoutState = {
      mode: 'inline',
      leftOpen: true,
      rightOpen: true,
      inlineLeftOpen: true,
      inlineRightOpen: true,
      focus: false,
      previousBeforeFocus: { left: true, right: true },
      resizeObserver: null,
      fitFrame: 0,
      initialized: false
    };

    function readLayoutPreference(key, fallback) {
      try {
        const value = localStorage.getItem(`cribbit-layout-${key}`);
        return value === null ? fallback : value === 'true';
      } catch { return fallback; }
    }

    function saveLayoutPreference(key, value) {
      try { localStorage.setItem(`cribbit-layout-${key}`, String(Boolean(value))); } catch {}
    }

    function resolvedRailMode() {
      const width = window.innerWidth;
      if (width < 620) return 'sheet';
      if (width <= 900) return 'overlay';
      return 'inline';
    }

    function updateLayoutControl(button, open, openLabel, closedLabel) {
      if (!button) return;
      button.setAttribute('aria-expanded', String(open));
      button.title = open ? openLabel : closedLabel;
      const label = button.querySelector('.control-label');
      if (label) label.textContent = (open ? openLabel : closedLabel).replace(/ panel$/,'');
    }

    function applyLayoutState({ fit = true } = {}) {
      const layout = $('#gameLayout');
      if (!layout) return;
      const leftOpen = !layoutState.focus && layoutState.leftOpen;
      const rightOpen = !layoutState.focus && layoutState.rightOpen;
      const drawerOpen = layoutState.mode !== 'inline' && (leftOpen || rightOpen);

      layout.dataset.railMode = layoutState.mode;
      layout.dataset.leftOpen = String(leftOpen);
      layout.dataset.rightOpen = String(rightOpen);
      layout.dataset.drawerOpen = String(drawerOpen);
      document.body.classList.toggle('game-focus', layoutState.focus);

      const left = $('#leftRail');
      const right = $('#rightRail');
      if (left) {
        left.inert = !leftOpen;
        left.setAttribute('aria-hidden', String(!leftOpen));
      }
      if (right) {
        right.inert = !rightOpen;
        right.setAttribute('aria-hidden', String(!rightOpen));
      }

      updateLayoutControl($('#toggleLeftRail'), leftOpen, 'Hide players panel', 'Show players panel');
      updateLayoutControl($('#toggleRightRail'), rightOpen, 'Hide session stats panel', 'Show session stats panel');
      const focusButton = $('#focusModeButton');
      if (focusButton) {
        focusButton.setAttribute('aria-pressed', String(layoutState.focus));
        focusButton.title = layoutState.focus ? 'Exit focus mode' : 'Enter focus mode';
      }

      if (layoutState.mode === 'inline' && !layoutState.focus) {
        layoutState.inlineLeftOpen = leftOpen;
        layoutState.inlineRightOpen = rightOpen;
        saveLayoutPreference('left', leftOpen);
        saveLayoutPreference('right', rightOpen);
      }
      if (fit) scheduleBoardFit();
    }

    function setRailMode(nextMode) {
      if (nextMode === layoutState.mode) return;
      if (layoutState.mode === 'inline') {
        layoutState.inlineLeftOpen = layoutState.leftOpen;
        layoutState.inlineRightOpen = layoutState.rightOpen;
      }
      layoutState.mode = nextMode;
      layoutState.focus = false;
      if (nextMode === 'inline') {
        layoutState.leftOpen = layoutState.inlineLeftOpen;
        layoutState.rightOpen = layoutState.inlineRightOpen;
      } else {
        layoutState.leftOpen = false;
        layoutState.rightOpen = false;
      }
      applyLayoutState();
    }

    function syncRailMode() {
      setRailMode(resolvedRailMode());
      applyLayoutState();
    }

    function toggleGameRail(side) {
      const wasFocus = layoutState.focus;
      const effectiveOpen = !wasFocus && (side === 'left' ? layoutState.leftOpen : layoutState.rightOpen);
      const opening = !effectiveOpen;
      if (wasFocus) {
        layoutState.focus = false;
        layoutState.leftOpen = side === 'left';
        layoutState.rightOpen = side === 'right';
      } else if (layoutState.mode !== 'inline' && opening) {
        layoutState.leftOpen = side === 'left';
        layoutState.rightOpen = side === 'right';
      } else if (side === 'left') {
        layoutState.leftOpen = !layoutState.leftOpen;
      } else {
        layoutState.rightOpen = !layoutState.rightOpen;
      }
      applyLayoutState();
      announce(`${side === 'left' ? 'Players' : 'Session stats'} panel ${opening ? 'opened' : 'closed'}.`);
    }

    function closeRailDrawers() {
      if (layoutState.mode === 'inline') return;
      layoutState.leftOpen = false;
      layoutState.rightOpen = false;
      applyLayoutState();
    }

    function toggleFocusMode() {
      if (!layoutState.focus) {
        layoutState.previousBeforeFocus = { left: layoutState.leftOpen, right: layoutState.rightOpen };
        layoutState.focus = true;
      } else {
        layoutState.focus = false;
        layoutState.leftOpen = layoutState.previousBeforeFocus.left;
        layoutState.rightOpen = layoutState.previousBeforeFocus.right;
      }
      applyLayoutState();
      announce(layoutState.focus ? 'Focus mode enabled.' : 'Focus mode disabled.');
    }

    async function toggleFullscreenMode() {
      try {
        const platform = window.__CRIBBIT_PLATFORM__;
        if (platform) {
          const active = platform.isFullscreen();
          const ok = active ? await platform.exitFullscreen() : await platform.requestFullscreen();
          if (!ok) throw new Error('Fullscreen is not supported by this client or was rejected.');
          syncFullscreenButton();
          return;
        }
        if (!document.fullscreenElement) await document.documentElement.requestFullscreen();
        else await document.exitFullscreen();
      } catch (error) {
        toast('Fullscreen unavailable', error.message || 'The client rejected the fullscreen request.', 'orange');
      }
    }

    function syncFullscreenButton() {
      const button = $('#fullscreenButton');
      if (!button) return;
      const active = window.__CRIBBIT_PLATFORM__?.isFullscreen?.() ?? Boolean(document.fullscreenElement);
      button.setAttribute('aria-pressed', String(active));
      button.title = active ? 'Exit fullscreen' : 'Enter fullscreen';
      const use = button.querySelector('use');
      if (use) use.setAttribute('href', active ? '#i-collapse' : '#i-expand');
      const label = button.querySelector('.control-label');
      if (label) label.textContent = active ? 'Exit' : 'Fullscreen';
      scheduleBoardFit();
    }

    function scheduleBoardFit() {
      cancelAnimationFrame(layoutState.fitFrame);
      layoutState.fitFrame = requestAnimationFrame(fitGameBoard);
    }

    function fitGameBoard() {
      if (state.view !== 'game') return;
      const stage = $('#gameStage');
      const hand = $('#handScroll');
      const handZone = document.querySelector('.hand-zone');
      const tableZone = document.querySelector('.table-zone');
      if (!stage || !hand || !handZone) return;

      const count = Math.max(1, humanPlayer()?.hand.length || hand.children.length || 1);
      const handRect = handZone.getBoundingClientRect();
      const availableHandWidth = Math.max(120, hand.clientWidth - 12);
      const availableHandHeight = Math.max(72, handRect.height - 24);
      const gap = 4;
      const widthFromHeight = availableHandHeight * (5 / 7);
      const widthFromRow = count <= 7
        ? (availableHandWidth - gap * Math.max(0,count - 1)) / count
        : Math.min(96, widthFromHeight);
      const minimum = window.innerWidth < 620 ? 58 : 66;
      const maximum = window.innerHeight < 680 ? 88 : 116;
      const cardWidth = clamp(Math.min(widthFromHeight,widthFromRow,maximum),minimum,maximum) * .85;
      document.documentElement.style.setProperty('--runtime-card-width', `${cardWidth.toFixed(1)}px`);

      if (tableZone) {
        const rect = tableZone.getBoundingClientRect();
        const usableHeight = Math.max(84, rect.height - 38);
        const usableWidth = Math.max(120, rect.width - 18);
        const tableWidth = clamp(Math.min(usableHeight * (5/7), usableWidth / 2 - 4, 190) * .85,54,168);
        document.documentElement.style.setProperty('--table-card-width', `${tableWidth.toFixed(1)}px`);
      }

      const height = stage.getBoundingClientRect().height;
      stage.dataset.density = height < 500 ? 'compact' : height < 650 ? 'balanced' : 'comfortable';
    }

    function initializeNavigationMenus() {
      const clusters = $$('.nav-cluster');
      let closeTimer = 0;
      const closeAll = except => clusters.forEach(cluster => {
        if (cluster === except) return;
        cluster.classList.remove('is-open');
        const trigger = cluster.querySelector(':scope > .nav-button');
        if (trigger) trigger.setAttribute('aria-expanded','false');
      });
      const open = cluster => {
        clearTimeout(closeTimer);
        closeAll(cluster);
        cluster.classList.add('is-open');
        const trigger = cluster.querySelector(':scope > .nav-button');
        if (trigger) trigger.setAttribute('aria-expanded','true');
      };
      const scheduleClose = cluster => {
        clearTimeout(closeTimer);
        closeTimer = window.setTimeout(() => {
          if (cluster.matches(':hover') || cluster.contains(document.activeElement)) return;
          cluster.classList.remove('is-open');
          const trigger = cluster.querySelector(':scope > .nav-button');
          if (trigger) trigger.setAttribute('aria-expanded','false');
        },180);
      };

      clusters.forEach(cluster => {
        const trigger = cluster.querySelector(':scope > .nav-button');
        const popover = cluster.querySelector(':scope > .nav-popover');
        if (!trigger || !popover) return;
        trigger.setAttribute('aria-haspopup','menu');
        trigger.setAttribute('aria-expanded','false');
        cluster.addEventListener('pointerenter', () => open(cluster));
        cluster.addEventListener('pointerleave', () => scheduleClose(cluster));
        cluster.addEventListener('focusin', () => open(cluster));
        cluster.addEventListener('focusout', event => { if (!cluster.contains(event.relatedTarget)) scheduleClose(cluster); });
        trigger.addEventListener('click', event => {
          event.preventDefault();
          event.stopPropagation();
          const next = !cluster.classList.contains('is-open');
          closeAll();
          if (next) open(cluster);
        });
      });
      document.addEventListener('pointerdown', event => {
        if (!event.target.closest('.nav-cluster')) closeAll();
      });
      document.addEventListener('keydown', event => {
        if (event.key === 'Escape') closeAll();
      });
    }

    function auditInteractiveControls() {
      const knownActions = new Set(['toggle-left-rail','toggle-right-rail','toggle-focus-mode','toggle-fullscreen','close-rail-drawers','simulate-disconnect','reset-demo','reconnect-now','join-room','open-mobile-nav','open-global-search','open-notifications','open-profile','save-profile','toggle-activity','apply-room-config','add-to-room','remove-from-room','advance-submission','prompt-detail','draw-card','play-card','card-detail','choose-wild','spin-roulette','publish-prompt','answer-mode','finish-speak','review-typed-answer','review-choice-answer','review-live-answer','submit-answer','edit-answer','complete-flow','safety-pass','safety-rewind','safety-flag','use-nope','nope-reaction','paranoia-choice','duel-target','duel-vote','chaos-target','resolve-chaos','save-prompt','focus-create-prompt','lab-add-card','lab-one-card','lab-human-turn','lab-trigger-draw','lab-queue-chaos','retry-last-command','force-recap','clear-log','flow-close-request','play-again','share-recap','cycle-fixture']);
      const missing = [...document.querySelectorAll('[data-action]')].map(node => node.dataset.action).filter(action => action && !knownActions.has(action));
      if (missing.length) console.error('Unregistered data-action controls:', [...new Set(missing)]);
      return missing;
    }

    function initializeLayoutController() {
      if (layoutState.initialized) return;
      layoutState.initialized = true;
      // A fresh desktop session always starts with both compact rails visible.
      // Hiding a rail is an explicit user action for the current demo session.
      layoutState.inlineLeftOpen = true;
      layoutState.inlineRightOpen = true;
      layoutState.leftOpen = layoutState.inlineLeftOpen;
      layoutState.rightOpen = layoutState.inlineRightOpen;
      layoutState.mode = resolvedRailMode();
      if (layoutState.mode !== 'inline') {
        layoutState.leftOpen = false;
        layoutState.rightOpen = false;
      }
      const stage = $('#gameStage');
      if (stage && 'ResizeObserver' in window) {
        layoutState.resizeObserver = new ResizeObserver(scheduleBoardFit);
        layoutState.resizeObserver.observe(stage);
      }
      window.addEventListener('resize', syncRailMode, { passive:true });
      document.addEventListener('fullscreenchange', syncFullscreenButton);
    window.addEventListener('cribbit:fullscreenchange', syncFullscreenButton);
      applyLayoutState();
      syncFullscreenButton();
    }

    function animateCardCommit(node, commit) {
      if (!node || node.dataset.committing === 'true') return;
      node.dataset.committing = 'true';
      node.classList.add('is-committing');
      const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
      if (reduced || !node.animate) return commit();
      node.animate([
        { transform:'translateY(0) scale(1)', opacity:1 },
        { transform:'translateY(-22px) scale(1.045)', opacity:1, offset:.62 },
        { transform:'translateY(-46px) scale(.92)', opacity:.05 }
      ], { duration:210, easing:'cubic-bezier(.2,.78,.2,1)', fill:'forwards' });
      setTimeout(commit, 165);
    }

    function resetViewScroll() {
      const root = document.documentElement;
      const previous = root.style.scrollBehavior;
      root.style.scrollBehavior = 'auto';
      root.scrollTop = 0;
      document.body.scrollTop = 0;
      window.scrollTo(0,0);
      requestAnimationFrame(() => {
        root.scrollTop = 0;
        document.body.scrollTop = 0;
        window.scrollTo(0,0);
        root.style.scrollBehavior = previous;
      });
    }

    function showView(view) {
      const allowed = ['lobby','rooms','game','board','library','create','call','lab','recap'];
      if (!allowed.includes(view)) return;
      if ((view === 'game' || view === 'recap') && !state.session) {
        toast('No active session', 'Start a simulated game from the lobby first.', 'orange');
        view = 'lobby';
      }
      state.view = view;
      document.body.classList.toggle('is-game-view', view === 'game');
      $$('.view').forEach(section => section.classList.toggle('is-active', section.dataset.view === view));
      $$('[data-nav]').forEach(button => button.setAttribute('aria-current', button.dataset.nav === view ? 'page' : 'false'));
      if (view === 'rooms') renderRooms();
      if (view === 'board') renderBoard();
      if (view === 'library') renderLibrary();
      if (view === 'create') renderCreate();
      if (view === 'call') renderCallMode();
      if (view === 'lab') renderLab();
      if (view === 'game') {
        renderGame();
        requestAnimationFrame(() => { syncRailMode(); scheduleBoardFit(); });
      }
      if (view === 'recap') renderRecap();
      resetViewScroll();
    }

    function syncHeader() {
      const pill = $('#connectionPill');
      if (pill) {
        pill.dataset.state = state.connection.toLowerCase();
        const label = state.connection === 'CONNECTED' ? 'Connected' : state.connection === 'LOST' ? 'Connection lost' : 'Timed out';
        pill.querySelector('span').textContent = label;
      }
      const fixtureMeta = visualWindow.__CRIBBIT_VISUAL_FIXTURE_META__ || null;
      $('#revisionLabel').textContent = fixtureMeta ? `Server rev ${state.revision} · ${fixtureMeta.label}` : `Server rev ${state.revision}`;
      syncFixtureBadge();
    }

    function serverCommand(type, payload = {}, options = {}) {
      const key = options.key || commandKey(type);
      if (state.commandCache.has(key)) {
        const cached = state.commandCache.get(key);
        addEvent('IDEMPOTENT_RETRY', `${type} retried with key ${key}; cached revision ${cached.revision} returned.`, 'cyan', { key });
        toast('Idempotent retry', `No effect was applied twice. Returned revision ${cached.revision}.`, 'cyan');
        renderAll();
        return cached;
      }

      let result;
      try {
        result = executeCommand(type, payload, key);
      } catch (error) {
        result = { ok: false, error: error.message, key, revision: state.revision };
        addEvent('COMMAND_REJECTED', `${type}: ${error.message}`, 'red', { key });
        toast('Server rejected command', error.message, 'red');
      }

      if (result?.mutated) state.revision += 1;
      const finalResult = { ...result, key, revision: state.revision };
      state.commandCache.set(key, finalResult);
      if (options.human !== false) state.lastHumanCommand = { type, payload: structuredClone(payload), key };
      syncHeader();
      renderAll();
      return finalResult;
    }

    function executeCommand(type, payload, key) {
      switch (type) {
        case 'START_GAME': return commandStartGame(payload, key);
        case 'PLAY_CARD': return commandPlayCard(payload, key);
        case 'DRAW_CARD': return commandDrawCard(payload, key);
        case 'CHOOSE_WILD': return commandChooseWild(payload, key);
        case 'REVEAL_PROMPT': return commandRevealPrompt(payload, key);
        case 'PUBLISH_PROMPT': return commandPublishPrompt(payload, key);
        case 'REWIND_PROMPT': return commandRewindPrompt(payload, key);
        case 'PASS_PROMPT': return commandPassPrompt(payload, key);
        case 'FLAG_PROMPT': return commandFlagPrompt(payload, key);
        case 'SELECT_ANSWER_MODE': return commandSelectAnswerMode(payload, key);
        case 'REVIEW_ANSWER': return commandReviewAnswer(payload, key);
        case 'SUBMIT_ANSWER': return commandSubmitAnswer(payload, key);
        case 'PARANOIA_CHOICE': return commandParanoiaChoice(payload, key);
        case 'DUEL_TARGET': return commandDuelTarget(payload, key);
        case 'DUEL_VOTE': return commandDuelVote(payload, key);
        case 'CHAOS_TARGET': return commandChaosTarget(payload, key);
        case 'NOPE_REACTION': return commandNopeReaction(payload, key);
        case 'TIMEOUT_TURN': return commandTimeoutTurn(payload, key);
        case 'TIMEOUT_SOCIAL': return commandTimeoutSocial(payload, key);
        case 'ADD_PROMPT': return commandAddPrompt(payload, key);
        case 'CREATE_PROMPT': return commandCreatePrompt(payload, key);
        case 'SAVE_PROMPT': return commandSavePrompt(payload, key);
        case 'ADD_TO_ROOM_POOL': return commandAddToRoomPool(payload, key);
        case 'REMOVE_FROM_ROOM_POOL': return commandRemoveFromRoomPool(payload, key);
        case 'ADVANCE_SUBMISSION': return commandAdvanceSubmission(payload, key);
        case 'LAB_ADD_CARD': return commandLabAddCard(payload, key);
        case 'LAB_ONE_CARD': return commandLabOneCard(payload, key);
        case 'LAB_HUMAN_TURN': return commandLabHumanTurn(payload, key);
        case 'LAB_TRIGGER_DRAW': return commandLabTriggerDraw(payload, key);
        case 'COMPLETE_FLOW': return commandCompleteFlow(payload, key);
        case 'FORCE_RECAP': return commandForceRecap(payload, key);
        default: throw new Error(`Unknown command ${type}.`);
      }
    }

    /* ---------- Card/deck model ---------- */
    let entityCounter = 0;
    const uid = prefix => `${prefix}-${Date.now().toString(36)}-${(++entityCounter).toString(36)}`;

    function createCard(kind, options = {}) {
      const card = {
        id: options.id || uid('card'),
        kind,
        color: options.color || null,
        value: options.value ?? null,
        symbol: options.symbol || (options.value != null ? String(options.value) : kind),
        label: options.label || null
      };
      return card;
    }

    function cardMeta(card) {
      if (!card) return { title: 'Card', icon: 'i-card', accent: 'cyan', rule: '' };
      if (FAMILY_META[card.kind]) return FAMILY_META[card.kind];
      if (card.kind === 'wild') return { title: 'Wild', icon: 'i-palette', accent: 'wild', rule: '<strong>Choose the active color.</strong><br>Server validates the choice.', role: 'Classic action', resolution: 'Choose or change the active color under the configured rule.' };
      if (card.kind === 'skip') return { title: 'Skip', icon: 'i-skip', accent: card.color, rule: '<strong>Tempo control.</strong><br>Next player loses a turn.', role: 'Classic action', resolution: 'Advance past the next player exactly once.' };
      if (card.kind === 'reverse') return { title: 'Reverse', icon: 'i-reverse', accent: card.color, rule: '<strong>Change direction.</strong><br>Two-player mode returns the turn.', role: 'Classic action', resolution: 'Invert direction; in Duel mode use the canonical bounce-back behavior.' };
      if (card.kind === 'draw') return { title: 'Draw', icon: 'i-draw', accent: card.color, rule: `<strong>Pressure card.</strong><br>Next player draws ${state.knobs.drawPenalty}.`, role: 'Classic action', resolution: 'The next player draws the configured balancing-knob amount.' };
      if (card.kind === 'number') return { title: String(card.value), icon: null, accent: card.color, rule: '<strong>Match color or value.</strong><br>Fast hand-management play.', role: 'Color/value card', resolution: 'Move from the player hand to discard if color or value matches.' };
      return { title: card.label || card.kind, icon: 'i-card', accent: card.color || 'cyan', rule: '' };
    }

    function cardSymbol(card) {
      if (card.kind === 'number') return String(card.value);
      return card.kind;
    }

    function buildDeck(seed = Date.now()) {
      const deck = [];
      const colors = Object.keys(COLOR_META);
      colors.forEach(color => {
        deck.push(createCard('number', { color, value: 0, symbol: '0' }));
        for (let value = 1; value <= 9; value += 1) {
          deck.push(createCard('number', { color, value, symbol: String(value) }));
          deck.push(createCard('number', { color, value, symbol: String(value) }));
        }
        ['skip','reverse','draw'].forEach(kind => {
          deck.push(createCard(kind, { color, symbol: kind }));
          deck.push(createCard(kind, { color, symbol: kind }));
        });
      });
      for (let i = 0; i < 4; i += 1) deck.push(createCard('wild', { symbol: 'wild' }));
      const socialCounts = { truth: 5, dare: 5, paranoia: 4, chaos: 4, duel: 3, nope: 3 };
      Object.entries(socialCounts).forEach(([kind, count]) => {
        for (let i = 0; i < count; i += 1) deck.push(createCard(kind, { symbol: kind }));
      });
      return shuffle(deck, seededRandom(seed));
    }

    function drawFromDeck(session, count = 1) {
      const cards = [];
      for (let i = 0; i < count; i += 1) {
        if (!session.deck.length) recycleDiscard(session);
        const card = session.deck.pop();
        if (card) cards.push(card);
      }
      return cards;
    }

    function recycleDiscard(session) {
      if (session.discard.length <= 1) return;
      const top = session.discard.pop();
      session.deck = shuffle(session.discard.splice(0), seededRandom(state.revision + Date.now()));
      session.discard.push(top);
      session.lastDiscardId = top.id;
      addEvent('DECK_RECYCLED', 'Discard pile recycled while preserving the active card.', 'cyan');
    }

    function makePlayers(count, humanName, ceiling) {
      const players = [];
      for (let index = 0; index < count; index += 1) {
        const isHuman = index === 0;
        players.push({
          id: `p${index}`,
          name: isHuman ? humanName : BOT_NAMES[index - 1] || `Player ${index + 1}`,
          isHuman,
          color: AVATAR_COLORS[index % AVATAR_COLORS.length],
          hand: [],
          ceiling: isHuman ? ceiling : Math.max(0, ceiling),
          rewindAvailable: true,
          connected: true,
          stats: { cardsPlayed: 0, truths: 0, dares: 0, paranoia: 0, duels: 0, duelWins: 0, chaos: 0, nopes: 0, passes: 0, rewinds: 0, flags: 0, draws: 0, targeted: 0 }
        });
      }
      return players;
    }

    function findPlayer(playerId) {
      return state.session?.players.find(player => player.id === playerId) || null;
    }

    function humanPlayer() {
      return state.session?.players.find(player => player.isHuman) || null;
    }

    function currentPlayer() {
      return state.session ? state.session.players[state.session.currentIndex] : null;
    }

    function nextPlayerIndex(fromIndex = state.session.currentIndex, steps = 1) {
      const session = state.session;
      return mod(fromIndex + session.direction * steps, session.players.length);
    }

    function topDiscard() {
      return state.session?.discard.at(-1) || null;
    }

    function isSocialCard(card) {
      return ['truth','dare','paranoia','chaos','duel'].includes(card?.kind);
    }

    function isClassicAction(card) {
      return ['skip','reverse','draw','wild'].includes(card?.kind);
    }

    function isLegalCard(card, playerId = currentPlayer()?.id) {
      const session = state.session;
      if (!session || !card || session.phase !== 'PLAY_DRAW' || currentPlayer()?.id !== playerId) return false;
      if (card.kind === 'nope') return false;
      if (card.kind === 'wild') return true;
      if (isSocialCard(card)) {
        if (!state.knobs.socialAlwaysLegal) return false;
        if (['truth','dare','paranoia','duel'].includes(card.kind)) return hasEligiblePrompt(card.kind, playerId);
        return true;
      }
      if (card.color && card.color === session.activeColor) return true;
      if (cardSymbol(card) === session.activeSymbol) return true;
      return false;
    }

    function legalCardsFor(player) {
      return player ? player.hand.filter(card => isLegalCard(card, player.id)) : [];
    }

    function renderCard(card, { size = '', interactive = false, legal = false, info = false, ariaLabel = '' } = {}) {
      const meta = cardMeta(card);
      const sizeClass = size ? ` game-card--${size}` : '';
      const kindAttr = card.kind === 'number' || ['skip','reverse','draw'].includes(card.kind) ? '' : ` data-kind="${escapeHTML(card.kind)}"`;
      const colorAttr = card.color ? ` data-color="${escapeHTML(card.color)}"` : '';
      const tagIcon = meta.icon || 'i-card';
      const central = card.kind === 'number'
        ? `<span class="game-card__icon is-number">${escapeHTML(card.value)}</span>`
        : `<svg class="game-card__icon icon" aria-hidden="true"><use href="#${tagIcon}"></use></svg>`;
      const element = interactive ? 'button' : 'div';
      const actionAttrs = interactive ? ` type="button" data-action="play-card" data-card-id="${escapeHTML(card.id)}" aria-disabled="${legal ? 'false' : 'true'}"` : '';
      const label = ariaLabel || `${meta.title} card${legal ? ', legal to play' : ''}`;
      return `<div style="position:relative;display:inline-grid;place-items:center">
        <${element} class="game-card${sizeClass}"${kindAttr}${colorAttr}${actionAttrs} data-legal="${legal ? 'true' : 'false'}" aria-label="${escapeHTML(label)}">
          <span class="game-card__tab"><svg class="icon" aria-hidden="true"><use href="#${tagIcon}"></use></svg></span>
          <strong class="game-card__title">${escapeHTML(meta.title)}</strong>
          ${central}
          <p class="game-card__rule">${meta.rule}</p>
          <svg class="frog-seal icon" aria-hidden="true"><use href="#i-frog"></use></svg>
        </${element}>
        ${info ? `<button class="card-info icon-button" data-action="card-detail" data-card-id="${escapeHTML(card.id)}" aria-label="View ${escapeHTML(meta.title)} card details" type="button">${icon('i-info')}</button>` : ''}
      </div>`;
    }

    function starterCardFromDeck(session) {
      let index = session.deck.findIndex(card => card.kind === 'number');
      if (index < 0) index = session.deck.length - 1;
      const [starter] = session.deck.splice(index, 1);
      return starter;
    }

    function ensureDemoPromptCoverage() {
      const coverage = [
        { id:'demo-clean-truth', type:'truth', text:'What tiny skill are you unexpectedly proud of?', world:'clean', stage:0, source:'original', author:'Cribbit', authorship:'signed', targeting:'current', options:['A performance','A practical skill','A strange talent'] },
        { id:'demo-clean-dare', type:'dare', text:'Act like a cartoon villain for 20 seconds. The group guesses the type.', world:'clean', stage:0, source:'original', author:'Cribbit', authorship:'signed', targeting:'current', options:[] },
        { id:'demo-clean-dare-alt', type:'dare', text:'Give a ten-second weather report about the mood in this room.', world:'clean', stage:0, source:'community', author:'Community QA', authorship:'reveal', targeting:'current', options:[] },
        { id:'demo-adult-truth', type:'truth', text:'What assumption does this group have about you that is completely wrong?', world:'adult', stage:0, source:'original', author:'Cribbit', authorship:'signed', targeting:'current', options:[] },
        { id:'demo-adult-truth-alt', type:'truth', text:'What harmless opinion do you defend more strongly than necessary?', world:'adult', stage:0, source:'community', author:'Community QA', authorship:'reveal', targeting:'current', options:[] },
        { id:'demo-adult-dare', type:'dare', text:'Let the group choose a harmless nickname you answer to until your next turn.', world:'adult', stage:0, source:'original', author:'Cribbit', authorship:'signed', targeting:'current', options:[] },
        { id:'demo-adult-dare-alt', type:'dare', text:'Deliver a dramatic acceptance speech for an award the group invents.', world:'adult', stage:0, source:'community', author:'Community QA', authorship:'reveal', targeting:'current', options:[] },
        { id:'demo-clean-paranoia', type:'paranoia', text:'Who here would make the best cartoon detective?', world:'clean', stage:0, source:'original', author:'Cribbit', authorship:'signed', targeting:'specific', options:[] },
        { id:'demo-clean-duel', type:'duel', text:'You each have 15 seconds to name as many African countries as possible.', world:'clean', stage:0, source:'original', author:'Cribbit', authorship:'signed', targeting:'specific', options:[] },
        { id:'demo-clean-chaos', type:'chaos', text:'Everyone has 10 seconds to draw an animal. The active player chooses the funniest.', world:'clean', stage:0, source:'original', author:'Cribbit', authorship:'signed', targeting:'all', options:[] },
        { id:'demo-adult-paranoia', type:'paranoia', text:'Choose privately: who here would be hardest to fool in a lie?', world:'adult', stage:0, source:'original', author:'Cribbit', authorship:'signed', targeting:'specific', options:[] },
        { id:'demo-adult-duel', type:'duel', text:'You each get 15 seconds to convince the room you are the better liar. The room votes.', world:'adult', stage:0, source:'original', author:'Cribbit', authorship:'signed', targeting:'specific', options:[] },
        { id:'demo-adult-chaos', type:'chaos', text:'Everyone answers the next eligible question in reverse turn order.', world:'adult', stage:0, source:'original', author:'Cribbit', authorship:'signed', targeting:'all', options:[] }
      ];
      coverage.forEach(prompt => {
        if (!state.prompts.some(item => item.id === prompt.id)) state.prompts.push({ ...prompt, approved:true, saved:75 });
      });
    }

    /* ---------- Session and authoritative turn engine ---------- */
    function commandStartGame() {
      updateSetupFromInputs();
      updateKnobsFromInputs();
      const mode = MODES[state.setup.mode];
      if (!mode) throw new Error('Choose a valid room mode.');
      if (state.setup.playerCount < mode.min || state.setup.playerCount > mode.max) throw new Error(`${mode.label} requires ${mode.min}${mode.max !== mode.min ? `-${mode.max}` : ''} players.`);
      ensureDemoPromptCoverage();
      clearTimeout(state.botTimer);
      state.flow = null;
      state.connection = 'CONNECTED';
      state.reconnectDeadline = null;
      state.reactionDeadline = null;
      state.commandCache.clear();
      state.events = [];
      const players = makePlayers(state.setup.playerCount, state.setup.profileName, state.setup.ceiling);
      const session = {
        id: uid('session'),
        roomName: state.setup.roomName,
        mode: state.setup.mode,
        world: state.setup.world,
        players,
        deck: buildDeck(Date.now()),
        discard: [],
        lastDiscardId: null,
        activeColor: null,
        activeSymbol: null,
        direction: 1,
        currentIndex: 0,
        phase: 'TURN_START',
        round: 1,
        completedTurns: 0,
        stage: 0,
        winnerId: null,
        pendingWinCandidate: null,
        deadline: null,
        turnStartedAt: null,
        sources: { ...state.setup.sources },
        usedPromptIds: [],
        resolvedPrompts: [],
        pendingEffect: null,
        stats: { totalPlays:0, totalDraws:0, socialResolved:0, rouletteSpins:0, flags:0, passes:0, rewinds:0, nopes:0, duels:0, chaos:0 }
      };
      state.session = session;
      const handSize = state.knobs.startingHand;
      if (state.setup.qaHand) {
        const qaKinds = ['truth','dare','paranoia','chaos','duel','nope','wild'];
        const qaCards = qaKinds.slice(0, handSize).map(kind => createCard(kind, { symbol:kind }));
        players[0].hand.push(...qaCards);
        while (players[0].hand.length < handSize) players[0].hand.push(...drawFromDeck(session, 1));
      } else {
        players[0].hand.push(...drawFromDeck(session, handSize));
      }
      players.slice(1).forEach(player => player.hand.push(...drawFromDeck(session, handSize)));
      const starter = starterCardFromDeck(session);
      session.discard.push(starter);
      session.activeColor = starter.color;
      session.activeSymbol = cardSymbol(starter);
      addEvent('SESSION_CREATED', `${session.roomName} created in ${mode.label} mode with ${players.length} players.`, 'lime');
      addEvent('CARDS_DEALT', `${handSize} starting cards dealt. Starter card establishes ${COLOR_META[session.activeColor]?.label || session.activeColor} / ${session.activeSymbol}.`, 'cyan');
      beginTurn();
      showView('game');
      announce(`Game started. ${currentPlayer().name}'s turn.`);
      return { ok:true, mutated:true };
    }

    function turnSeconds() {
      const mode = MODES[state.session?.mode || state.setup.mode];
      return Math.max(8, Math.round(state.knobs.turnTimer * mode.timerMultiplier));
    }

    function beginTurn() {
      const session = state.session;
      if (!session || session.winnerId) return;
      session.phase = 'TURN_START';
      session.turnStartedAt = Date.now();
      session.deadline = Date.now() + turnSeconds() * 1000;
      const player = currentPlayer();
      session.phase = 'PLAY_DRAW';
      const legalCount = legalCardsFor(player).length;
      addEvent('TURN_START', `${player.name} is active. Server surfaced ${legalCount} legal card${legalCount === 1 ? '' : 's'}.`, player.isHuman ? 'lime' : 'purple');
      scheduleBotTurn();
    }

    function advanceTurn(steps = 1) {
      const session = state.session;
      if (!session || session.winnerId) return;
      session.phase = 'NEXT_TURN';
      session.completedTurns += 1;
      const maxStage = STAGES[session.world].length - 1;
      session.stage = Math.min(maxStage, Math.floor(session.completedTurns / state.knobs.stageEvery));
      session.currentIndex = nextPlayerIndex(session.currentIndex, steps);
      if (session.currentIndex === 0) session.round += 1;
      session.pendingEffect = null;
      state.flow = null;
      session.pendingWinCandidate = null;
      beginTurn();
    }

    function removeCardFromHand(player, cardId) {
      const index = player.hand.findIndex(card => card.id === cardId);
      if (index < 0) throw new Error('The server cannot find that card in the current player hand.');
      return player.hand.splice(index, 1)[0];
    }

    function placeCardOnDiscard(card) {
      const session = state.session;
      session.discard.push(card);
      session.lastDiscardId = card.id;
      if (card.color) session.activeColor = card.color;
      session.activeSymbol = cardSymbol(card);
    }

    function checkWin(player, { afterSocial = false } = {}) {
      const session = state.session;
      if (!session || player.hand.length !== 0) return false;
      if (isSocialCard(topDiscard()) && state.knobs.finalSocialWin === 'after' && !afterSocial) {
        session.pendingWinCandidate = player.id;
        addEvent('WIN_PENDING', `${player.name} has zero cards; the required social effect must resolve before the configured demo win check.`, 'gold');
        return false;
      }
      session.phase = 'WIN_CHECK';
      session.winnerId = player.id;
      session.deadline = null;
      state.flow = null;
      clearTimeout(state.botTimer);
      addEvent('WINNER_CONFIRMED', `${player.name} legally reached zero cards and is the CHAOS Champ.`, 'gold');
      announce(`${player.name} wins by legally emptying their hand.`);
      showView('recap');
      return true;
    }

    function finishResolvedTurn(player, { steps = 1, afterSocial = false } = {}) {
      const session = state.session;
      if (!session || session.winnerId) return;
      session.phase = 'WIN_CHECK';
      if (checkWin(player, { afterSocial })) return;
      advanceTurn(steps);
    }

    function commandPlayCard({ cardId, playerId = currentPlayer()?.id } = {}) {
      const session = state.session;
      if (!session) throw new Error('No active session.');
      if (state.connection !== 'CONNECTED') throw new Error('Connection is lost; the server snapshot is held during the grace window.');
      if (session.phase !== 'PLAY_DRAW') throw new Error('The authoritative phase does not accept a card play.');
      const player = findPlayer(playerId);
      if (!player || player.id !== currentPlayer()?.id) throw new Error('It is not that player’s turn.');
      const card = player.hand.find(item => item.id === cardId);
      if (!card) throw new Error('Card ownership validation failed.');
      if (!isLegalCard(card, player.id)) throw new Error('Card is not legal under the active color, symbol, or effect contract.');
      session.phase = 'TRIGGER';
      removeCardFromHand(player, card.id);
      placeCardOnDiscard(card);
      player.stats.cardsPlayed += 1;
      session.stats.totalPlays += 1;
      addEvent('CARD_PLAYED', `${player.name} played ${cardMeta(card).title}.`, FAMILY_META[card.kind]?.accent || card.color || 'cyan', { cardId:card.id, kind:card.kind });

      if (card.kind === 'number') {
        finishResolvedTurn(player);
      } else if (card.kind === 'skip') {
        const skipped = session.players[nextPlayerIndex()];
        addEvent('SKIP_RESOLVED', `${skipped.name} loses the next turn.`, card.color || 'cyan');
        finishResolvedTurn(player, { steps:2 });
      } else if (card.kind === 'reverse') {
        session.direction *= -1;
        addEvent('REVERSE_RESOLVED', `Direction changed to ${session.direction === 1 ? 'clockwise' : 'counterclockwise'}.`, card.color || 'cyan');
        finishResolvedTurn(player, { steps:session.players.length === 2 ? 2 : 1 });
      } else if (card.kind === 'draw') {
        openDrawEffect(player, card);
      } else if (card.kind === 'wild') {
        state.flow = { type:'wild', actorId:player.id, cardId:card.id, step:'choose-color' };
        session.phase = 'ANSWER_RESOLVE';
      } else if (isSocialCard(card)) {
        if (state.knobs.finalSocialWin === 'immediate' && player.hand.length === 0) {
          checkWin(player, { afterSocial:true });
        } else {
          triggerSocialCard(card, player);
        }
      }
      return { ok:true, mutated:true };
    }

    function commandDrawCard({ playerId = currentPlayer()?.id } = {}) {
      const session = state.session;
      if (!session) throw new Error('No active session.');
      if (state.connection !== 'CONNECTED') throw new Error('Connection is lost.');
      if (session.phase !== 'PLAY_DRAW') throw new Error('Draw is not available in the current phase.');
      const player = findPlayer(playerId);
      if (!player || player.id !== currentPlayer()?.id) throw new Error('It is not that player’s turn.');
      const legal = legalCardsFor(player);
      if (legal.length && !state.knobs.voluntaryDraw) throw new Error('This demo configuration allows Draw only when no legal card is held. Voluntary draw remains an open rule detail.');
      const [card] = drawFromDeck(session, 1);
      if (!card) throw new Error('No cards are available to draw.');
      player.hand.push(card);
      player.stats.draws += 1;
      session.stats.totalDraws += 1;
      addEvent('CARD_DRAWN', `${player.name} drew one card.`, 'cyan');
      finishResolvedTurn(player);
      return { ok:true, mutated:true, cardId:card.id };
    }

    function commandChooseWild({ color } = {}) {
      const session = state.session;
      const flow = state.flow;
      if (!session || flow?.type !== 'wild') throw new Error('No Wild color choice is awaiting resolution.');
      if (!COLOR_META[color]) throw new Error('Choose one of the four engine colors.');
      session.activeColor = color;
      session.activeSymbol = 'wild';
      const player = findPlayer(flow.actorId);
      addEvent('WILD_RESOLVED', `${player.name} changed the active color to ${COLOR_META[color].label}.`, color);
      state.flow = null;
      finishResolvedTurn(player);
      return { ok:true, mutated:true };
    }

    function openDrawEffect(actor, card) {
      const session = state.session;
      const targetIndex = nextPlayerIndex();
      const target = session.players[targetIndex];
      const hasNope = target.hand.some(item => item.kind === 'nope');
      session.pendingEffect = { type:'draw', actorId:actor.id, targetId:target.id, amount:state.knobs.drawPenalty, cardId:card.id };
      if (hasNope && target.isHuman) {
        state.flow = { type:'reaction', effect:'draw', actorId:actor.id, targetId:target.id, amount:state.knobs.drawPenalty, step:'offer-nope', deadline:Date.now() + 10000 };
        state.reactionDeadline = state.flow.deadline;
        session.phase = 'ANSWER_RESOLVE';
        addEvent('NOPE_WINDOW_OPEN', `${target.name} may play Nope against the configured Draw effect.`, 'gold');
      } else if (hasNope && !target.isHuman && seededRandom(state.revision + target.hand.length)() > .65) {
        const nope = target.hand.find(item => item.kind === 'nope');
        target.hand.splice(target.hand.indexOf(nope), 1);
        session.discard.push(nope);
        target.stats.nopes += 1;
        session.stats.nopes += 1;
        addEvent('NOPE_PLAYED', `${target.name} blocked the Draw effect with Nope.`, 'gold');
        finishResolvedTurn(actor);
      } else {
        resolveDrawEffect(actor, target, state.knobs.drawPenalty, false);
      }
    }

    function resolveDrawEffect(actor, target, amount, blocked) {
      const session = state.session;
      if (!blocked) {
        const cards = drawFromDeck(session, amount);
        target.hand.push(...cards);
        target.stats.draws += cards.length;
        session.stats.totalDraws += cards.length;
        addEvent('DRAW_EFFECT_RESOLVED', `${target.name} drew ${cards.length} configured card${cards.length === 1 ? '' : 's'}.`, 'orange');
      }
      state.flow = null;
      state.reactionDeadline = null;
      finishResolvedTurn(actor);
    }

    /* ---------- Prompt eligibility, Roulette and social resolution ---------- */
    function sourceEnabled(source) {
      const sources = state.session?.sources || state.setup.sources;
      return Boolean(sources[source]);
    }

    function promptEligible(prompt, family, targetId, { exclude = [], excludeTexts = [] } = {}) {
      const session = state.session;
      const target = findPlayer(targetId) || currentPlayer();
      if (!session || !prompt?.approved) return false;
      if (prompt.type !== family || prompt.world !== session.world) return false;
      if (!sourceEnabled(prompt.source)) return false;
      if (exclude.includes(prompt.id)) return false;
      const normalizedText = String(prompt.text || '').trim().toLowerCase().replace(/\s+/g,' ');
      if (excludeTexts.some(text => String(text || '').trim().toLowerCase().replace(/\s+/g,' ') === normalizedText)) return false;
      if (prompt.stage > session.stage) return false;
      if (prompt.stage > Number(target?.ceiling ?? 0)) return false;
      if (session.usedPromptIds.slice(-5).includes(prompt.id)) return false;
      return true;
    }

    function hasEligiblePrompt(family, targetId, options = {}) {
      return state.prompts.some(prompt => promptEligible(prompt, family, targetId, options));
    }

    function selectEligiblePrompt(family, targetId, options = {}) {
      const session = state.session;
      const pool = state.prompts.filter(prompt => promptEligible(prompt, family, targetId, options));
      if (!pool.length) throw new Error(`No approved ${family} prompt fits the active room profile, stage, ceiling and enabled sources.`);
      const random = seededRandom((state.revision + 1) * 9301 + session.completedTurns * 49297 + family.length * 233);
      const prompt = pool[Math.floor(random() * pool.length)];
      return structuredClone(prompt);
    }

    function promptAuthorLabel(prompt, resolved = false) {
      if (!prompt) return '';
      if (prompt.authorship === 'taboo') return 'Taboo · author never shown';
      if (prompt.authorship === 'reveal' && !resolved) return 'Reveal After · author sealed';
      return `Submitted by ${prompt.author}`;
    }

    function triggerSocialCard(card, actor) {
      const session = state.session;
      session.phase = 'ANSWER_RESOLVE';
      const family = card.kind;
      const targetId = actor.id;
      if (family === 'truth' || family === 'dare') {
        const prompt = selectEligiblePrompt(family, targetId);
        state.flow = {
          type:'social', family, originFamily:family, actorId:actor.id, targetId,
          cardId:card.id, prompt, step:'roulette-ready', serverSelectedAt:Date.now(),
          answerState:'WAITING_FOR_PLAYER', deadline:Date.now() + 45000,
          rouletteRotation:0, flags:[]
        };
        addEvent('PROMPT_PRESELECTED', `Server selected a sealed eligible ${family} prompt before the wheel animation.`, family === 'truth' ? 'lime' : 'orange');
      } else if (family === 'paranoia') {
        const prompt = selectEligiblePrompt('paranoia', targetId);
        state.flow = { type:'paranoia', family, originFamily:family, actorId:actor.id, targetId, cardId:card.id, prompt, step:'paranoia-choice', deadline:Date.now()+45000, flags:[] };
        addEvent('PARANOIA_OPENED', 'Private Choose UI opened; ambient spoken names are ignored.', 'purple');
      } else if (family === 'duel') {
        state.flow = { type:'duel', family, originFamily:family, actorId:actor.id, targetId:null, cardId:card.id, prompt:null, step:'duel-target', deadline:Date.now()+45000, flags:[], answerState:'WAITING_FOR_PLAYER' };
        addEvent('DUEL_TARGET_REQUIRED', `${actor.name} must select an eligible opponent.`, 'cyan');
      } else if (family === 'chaos') {
        const effect = state.nextChaosEffect || DEMO_CHAOS_EFFECTS[(session.completedTurns + state.revision) % DEMO_CHAOS_EFFECTS.length];
        state.nextChaosEffect = null;
        state.flow = { type:'chaos', family, originFamily:family, actorId:actor.id, targetId:null, cardId:card.id, effect:structuredClone(effect), step:effect.targeted ? 'chaos-target' : 'chaos-confirm', deadline:Date.now()+45000, flags:[] };
        addEvent('CHAOS_EFFECT_SELECTED', `Server selected deterministic effect: ${effect.title}.`, 'magenta');
      }
      if (!actor.isHuman) scheduleBotSocialResolution();
    }

    function commandRevealPrompt() {
      const flow = state.flow;
      if (!flow || flow.type !== 'social' || !['roulette-ready','roulette-spinning'].includes(flow.step)) throw new Error('No sealed Truth/Dare prompt is ready to reveal.');
      flow.step = 'private-preview';
      flow.answerState = 'WAITING_FOR_PLAYER';
      flow.deadline = Date.now() + 45000;
      state.session.stats.rouletteSpins += 1;
      addEvent('PROMPT_PRIVATE_PREVIEW', `${findPlayer(flow.targetId).name} received the selected prompt without hidden-author leakage.`, flow.family === 'truth' ? 'lime' : 'orange');
      return { ok:true, mutated:true };
    }

    function commandRewindPrompt() {
      const flow = state.flow;
      if (!flow || flow.type !== 'social' || !['truth','dare'].includes(flow.family) || flow.step !== 'private-preview') throw new Error('Rewind is defined only for a current Truth/Dare before public reveal.');
      const target = findPlayer(flow.targetId);
      if (!target?.rewindAvailable) throw new Error('This player has already used the once-per-session Rewind.');
      const replacement = selectEligiblePrompt(flow.family, flow.targetId, { exclude:[flow.prompt.id], excludeTexts:[flow.prompt.text] });
      target.rewindAvailable = false;
      target.stats.rewinds += 1;
      state.session.stats.rewinds += 1;
      addEvent('PROMPT_REWOUND', `${target.name} privately replaced the prompt at the same eligible level.`, 'cyan');
      flow.prompt = replacement;
      flow.step = 'private-preview';
      flow.deadline = Date.now()+45000;
      return { ok:true, mutated:true };
    }

    function commandPassPrompt() {
      const flow = state.flow;
      if (!flow || !['social','paranoia','duel','chaos'].includes(flow.type)) throw new Error('Pass is available only when a prompt is directed at a player.');
      const target = findPlayer(flow.targetId || flow.actorId);
      if (target) target.stats.passes += 1;
      state.session.stats.passes += 1;
      addEvent('PROMPT_PASSED', `${target?.name || 'Player'} passed privately. The prompt was not globally removed.`, 'lime');
      state.flow = { ...flow, step:'passed', resolved:true, outcome:'Turn passed with dignity.' };
      return { ok:true, mutated:true };
    }

    function commandFlagPrompt() {
      const flow = state.flow;
      if (!flow?.prompt) throw new Error('No displayed prompt is available to report.');
      flow.flags = flow.flags || [];
      if (flow.flags.includes(flow.prompt.id)) throw new Error('This prompt is already flagged in the current turn.');
      flow.flags.push(flow.prompt.id);
      const target = findPlayer(flow.targetId || flow.actorId);
      if (target) target.stats.flags += 1;
      state.session.stats.flags += 1;
      addEvent('PROMPT_FLAGGED', 'Private report entered moderation logic. The prompt was not automatically deleted.', 'magenta', { promptId:flow.prompt.id });
      toast('Report received', 'Flag is moderation, not a veto or personal Pass.', 'magenta');
      return { ok:true, mutated:true };
    }

    function commandSelectAnswerMode({ mode } = {}) {
      const flow = state.flow;
      if (!flow || !['social','chaos','duel'].includes(flow.type)) throw new Error('No active prompt accepts an answer method.');
      if (!['speak','type','choose','live'].includes(mode)) throw new Error('Choose Speak, Type, Choose or Answered Live.');
      if (mode === 'choose' && !(flow.prompt?.options?.length)) throw new Error('This prompt does not provide curated Choose options. Use Speak, Type or Answered Live.');
      flow.answerMode = mode;
      flow.answerState = 'ANSWER_MODE_SELECTED';
      flow.step = mode === 'speak' ? 'answer-capturing' : mode === 'type' ? 'answer-input' : mode === 'choose' ? 'answer-choose' : 'answer-live';
      flow.deadline = Date.now()+45000;
      addEvent('ANSWER_MODE_SELECTED', `${mode === 'live' ? 'Answered Live' : mode} selected explicitly.`, mode === 'speak' ? 'lime' : mode === 'type' ? 'cyan' : mode === 'choose' ? 'gold' : 'magenta');
      return { ok:true, mutated:true };
    }

    function commandReviewAnswer({ value = '', choice = '', completionOnly = false } = {}) {
      const flow = state.flow;
      if (!flow || !flow.answerMode) throw new Error('Select an answer method before review.');
      const mode = flow.answerMode;
      if (mode === 'type' && !String(value).trim()) throw new Error('Enter an answer before review.');
      if (mode === 'choose' && !choice) throw new Error('Choose one explicit option.');
      flow.answerState = 'REVIEW';
      flow.step = 'answer-review';
      flow.answerDraft = {
        method:mode,
        text: mode === 'type' || mode === 'speak' ? String(value || (mode === 'speak' ? 'Demo voice transcript - editable before submission.' : '')).trim() : null,
        choice: mode === 'choose' ? choice : null,
        completionOnly: mode === 'live' || Boolean(completionOnly)
      };
      addEvent('ANSWER_REVIEW_OPENED', 'Explicit input captured; the player may review or edit before submission.', 'cyan');
      return { ok:true, mutated:true };
    }

    function commandSubmitAnswer() {
      const flow = state.flow;
      if (!flow || flow.step !== 'answer-review' || !flow.answerDraft) throw new Error('No reviewed answer is ready to submit.');
      const actor = findPlayer(flow.actorId);
      const target = findPlayer(flow.targetId || flow.actorId);
      flow.answerState = 'ANSWER_REGISTERED';
      flow.answer = { ...flow.answerDraft, submittedAt:Date.now() };
      addEvent('ANSWER_REGISTERED', `${target?.name || actor.name} submitted via ${flow.answer.method === 'live' ? 'Answered Live (completion only)' : flow.answer.method}.`, 'lime');

      if (flow.type === 'duel' && flow.duelPhase === 'active-answer') {
        flow.activeResult = flow.answer;
        flow.answer = null;
        flow.answerDraft = null;
        flow.answerMode = null;
        flow.answerState = 'WAITING_FOR_PLAYER';
        flow.duelPhase = 'opponent-answer';
        flow.step = 'duel-opponent';
        setTimeout(() => {
          if (state.flow !== flow) return;
          flow.opponentResult = { method:'live', completionOnly:true, submittedAt:Date.now() };
          flow.step = 'duel-vote';
          flow.duelPhase = 'vote';
          addEvent('DUEL_SECOND_WINDOW_RESOLVED', `${findPlayer(flow.opponentId).name} completed the separate opponent window.`, 'cyan');
          state.revision += 1;
          renderAll();
        }, 700);
        return { ok:true, mutated:true };
      }

      resolvePromptStats(flow);
      flow.step = 'resolved';
      flow.resolved = true;
      flow.outcome = 'Answer registered. The room may now react.';
      registerResolvedPrompt(flow);
      return { ok:true, mutated:true };
    }

    function resolvePromptStats(flow) {
      const actor = findPlayer(flow.actorId);
      const session = state.session;
      const family = flow.originFamily || flow.family;
      if (!actor || !session) return;
      if (family === 'truth') actor.stats.truths += 1;
      if (family === 'dare') actor.stats.dares += 1;
      if (family === 'paranoia') actor.stats.paranoia += 1;
      if (family === 'chaos') { actor.stats.chaos += 1; session.stats.chaos += 1; }
      if (family === 'duel') { actor.stats.duels += 1; session.stats.duels += 1; }
      session.stats.socialResolved += 1;
    }

    function registerResolvedPrompt(flow) {
      const prompt = flow.prompt;
      if (!prompt) return;
      const session = state.session;
      session.usedPromptIds.push(prompt.id);
      session.resolvedPrompts.push({ promptId:prompt.id, family:flow.family, actorId:flow.actorId, author:prompt.authorship === 'taboo' ? null : prompt.author, authorship:prompt.authorship, resolvedAt:Date.now(), saved:false });
      state.recentPrompts.push(prompt.id);
      state.recentPrompts = state.recentPrompts.slice(-12);
    }

    function commandParanoiaChoice({ targetId } = {}) {
      const flow = state.flow;
      if (!flow || flow.type !== 'paranoia' || flow.step !== 'paranoia-choice') throw new Error('No Paranoia choice is awaiting private input.');
      const target = findPlayer(targetId);
      if (!target || target.id === flow.actorId) throw new Error('Choose another eligible player.');
      flow.choiceTargetId = target.id;
      flow.step = 'resolved';
      flow.resolved = true;
      flow.outcome = `${findPlayer(flow.actorId).name} privately chose ${target.name}. The reveal follows only the prompt contract.`;
      target.stats.targeted += 1;
      resolvePromptStats(flow);
      registerResolvedPrompt(flow);
      addEvent('PARANOIA_CHOICE_REGISTERED', 'Private player choice recorded explicitly and resolved once.', 'purple');
      return { ok:true, mutated:true };
    }

    function commandDuelTarget({ targetId } = {}) {
      const flow = state.flow;
      if (!flow || flow.type !== 'duel' || flow.step !== 'duel-target') throw new Error('No Duel target is awaiting selection.');
      const opponent = findPlayer(targetId);
      if (!opponent || opponent.id === flow.actorId) throw new Error('Choose another eligible player for the Duel.');
      flow.targetId = flow.actorId;
      flow.opponentId = opponent.id;
      flow.prompt = selectEligiblePrompt('duel', flow.actorId);
      flow.step = 'duel-active';
      flow.duelPhase = 'active-answer';
      flow.answerState = 'WAITING_FOR_PLAYER';
      opponent.stats.targeted += 1;
      addEvent('DUEL_OPPONENT_SELECTED', `${findPlayer(flow.actorId).name} challenged ${opponent.name}. Two sequential resolution windows will run.`, 'cyan');
      return { ok:true, mutated:true };
    }

    function commandDuelVote({ winnerId } = {}) {
      const flow = state.flow;
      if (!flow || flow.type !== 'duel' || flow.step !== 'duel-vote') throw new Error('The Duel is not ready for its result.');
      if (![flow.actorId, flow.opponentId].includes(winnerId)) throw new Error('Choose one of the two Duel participants.');
      const winner = findPlayer(winnerId);
      winner.stats.duelWins += 1;
      resolvePromptStats(flow);
      registerResolvedPrompt(flow);
      flow.winnerId = winnerId;
      flow.step = 'resolved';
      flow.resolved = true;
      flow.outcome = `${winner.name} won the local Duel result. Empty-hand victory remains unchanged.`;
      addEvent('DUEL_RESOLVED', `${winner.name} won the Duel. This is recap metadata, not the primary win condition.`, 'cyan');
      return { ok:true, mutated:true };
    }

    function commandChaosTarget({ targetId } = {}) {
      const flow = state.flow;
      if (!flow || flow.type !== 'chaos' || flow.step !== 'chaos-target') throw new Error('No targeted Chaos effect is awaiting a player.');
      const target = findPlayer(targetId);
      if (!target || target.id === flow.actorId) throw new Error('Choose another eligible player.');
      flow.targetId = target.id;
      target.stats.targeted += 1;
      if (flow.effect.id === 'swap-hands') {
        const canNope = state.knobs.nopeContract === 'draw-chaos' && target.hand.some(card => card.kind === 'nope');
        if (target.isHuman && canNope) {
          flow.type = 'reaction';
          flow.effectType = 'chaos-swap';
          flow.step = 'offer-nope';
          flow.deadline = Date.now()+10000;
          state.reactionDeadline = flow.deadline;
          addEvent('NOPE_WINDOW_OPEN', `${target.name} may play Nope against the targeted hand-swap demo contract.`, 'gold');
        } else {
          resolveSwapEffect(flow.actorId, target.id, false, flow);
        }
      }
      return { ok:true, mutated:true };
    }

    function resolveSwapEffect(actorId, targetId, blocked, flowRef = state.flow) {
      const actor = findPlayer(actorId);
      const target = findPlayer(targetId);
      if (!blocked) {
        [actor.hand, target.hand] = [target.hand, actor.hand];
        addEvent('CHAOS_SWAP_RESOLVED', `${actor.name} and ${target.name} swapped hands atomically.`, 'magenta');
      }
      resolvePromptStats({ originFamily:'chaos', actorId });
      flowRef.step = 'resolved';
      flowRef.resolved = true;
      flowRef.outcome = blocked ? 'The targeted Chaos effect was blocked by Nope.' : 'Both hand-ownership sets changed in one authoritative transaction.';
      state.reactionDeadline = null;
    }

    function resolveChaosConfirm() {
      const flow = state.flow;
      if (!flow || flow.type !== 'chaos' || flow.step !== 'chaos-confirm') return;
      const actor = findPlayer(flow.actorId);
      if (flow.effect.id === 'forced-roulette') {
        const family = seededRandom(state.revision + state.session.completedTurns)() > .5 ? 'truth' : 'dare';
        const prompt = selectEligiblePrompt(family, actor.id);
        state.flow = { type:'social', family, originFamily:'chaos', actorId:actor.id, targetId:actor.id, cardId:flow.cardId, prompt, step:'roulette-ready', serverSelectedAt:Date.now(), answerState:'WAITING_FOR_PLAYER', deadline:Date.now()+45000, flags:[] };
        addEvent('FORCED_ROULETTE_PRESELECTED', `Chaos forced a sealed ${family} selection before wheel animation.`, 'magenta');
      } else if (flow.effect.id === 'group-answer') {
        const prompt = selectEligiblePrompt('truth', actor.id);
        flow.prompt = prompt;
        flow.family = 'truth';
        flow.targetId = actor.id;
        flow.step = 'public-prompt';
        flow.answerState = 'WAITING_FOR_PLAYER';
        addEvent('GROUP_ANSWER_OPENED', 'Bots resolved automatically; active player must use an explicit answer path.', 'magenta');
      }
    }

    function commandNopeReaction({ useNope = false } = {}) {
      const flow = state.flow;
      if (!flow || flow.type !== 'reaction' || flow.step !== 'offer-nope') throw new Error('No permitted Nope reaction window is open.');
      const target = findPlayer(flow.targetId);
      let blocked = false;
      if (useNope) {
        const index = target.hand.findIndex(card => card.kind === 'nope');
        if (index < 0) throw new Error('The reacting player does not hold a Nope card.');
        const [nope] = target.hand.splice(index, 1);
        state.session.discard.push(nope);
        target.stats.nopes += 1;
        state.session.stats.nopes += 1;
        blocked = true;
        addEvent('NOPE_PLAYED', `${target.name} used a visible tactical card to block the eligible effect.`, 'gold');
      } else {
        addEvent('NOPE_DECLINED', `${target.name} allowed the eligible effect to resolve.`, 'cyan');
      }
      if (flow.effect === 'draw') {
        const actor = findPlayer(flow.actorId);
        resolveDrawEffect(actor, target, flow.amount, blocked);
      } else if (flow.effectType === 'chaos-swap') {
        const actorId = flow.actorId;
        resolveSwapEffect(actorId, target.id, blocked, flow);
      }
      state.reactionDeadline = null;
      return { ok:true, mutated:true };
    }

    function commandCompleteFlow() {
      const flow = state.flow;
      if (!flow || !['resolved','passed'].includes(flow.step)) throw new Error('The current effect is not ready to close.');
      const actor = findPlayer(flow.actorId);
      state.flow = null;
      state.session.phase = 'WIN_CHECK';
      finishResolvedTurn(actor, { afterSocial:true });
      return { ok:true, mutated:true };
    }

    /* ---------- Bots, timeout and reconnect simulation ---------- */
    function scheduleBotTurn() {
      clearTimeout(state.botTimer);
      const session = state.session;
      const player = currentPlayer();
      if (!session || session.winnerId || state.flow || state.connection !== 'CONNECTED' || !player || player.isHuman || session.phase !== 'PLAY_DRAW') return;
      state.botTimer = setTimeout(() => botTakeTurn(player.id), 720);
    }

    function botTakeTurn(playerId) {
      const session = state.session;
      const player = findPlayer(playerId);
      if (!session || currentPlayer()?.id !== playerId || session.phase !== 'PLAY_DRAW' || state.flow) return;
      const legal = legalCardsFor(player);
      const baseline = legal.filter(card => card.kind === 'number' || isClassicAction(card));
      const choice = baseline[0] || legal[0];
      if (choice) {
        serverCommand('PLAY_CARD', { cardId:choice.id, playerId }, { human:false, key:`bot-play-${session.id}-${session.completedTurns}-${choice.id}` });
      } else {
        serverCommand('DRAW_CARD', { playerId }, { human:false, key:`bot-draw-${session.id}-${session.completedTurns}-${playerId}` });
      }
    }

    function scheduleBotSocialResolution() {
      clearTimeout(state.botTimer);
      state.botTimer = setTimeout(botResolveCurrentFlow, 650);
    }

    function botResolveCurrentFlow() {
      const flow = state.flow;
      if (!flow || !state.session || state.session.winnerId) return;
      const actor = findPlayer(flow.actorId);
      if (actor?.isHuman) return;
      if (['resolved','passed'].includes(flow.step)) return serverCommand('COMPLETE_FLOW', {}, { human:false, key:`bot-generic-complete-${flow.cardId || flow.actorId}` });
      if (flow.type === 'social') {
        if (flow.step === 'roulette-ready') {
          serverCommand('REVEAL_PROMPT', {}, { human:false, key:`bot-reveal-${flow.cardId}` });
          return scheduleBotSocialResolution();
        }
        if (flow.step === 'private-preview') {
          flow.step = 'public-prompt';
          flow.answerState = 'WAITING_FOR_PLAYER';
          state.revision += 1;
          addEvent('PROMPT_REVEALED', `${actor.name} received the public ${flow.family} prompt.`, flow.family === 'truth' ? 'lime' : 'orange');
          renderAll();
          return scheduleBotSocialResolution();
        }
        if (flow.step === 'public-prompt') {
          serverCommand('SELECT_ANSWER_MODE', { mode:'live' }, { human:false, key:`bot-mode-${flow.cardId}` });
          serverCommand('REVIEW_ANSWER', { completionOnly:true }, { human:false, key:`bot-review-${flow.cardId}` });
          serverCommand('SUBMIT_ANSWER', {}, { human:false, key:`bot-submit-${flow.cardId}` });
          return scheduleBotSocialResolution();
        }
        if (flow.step === 'resolved' || flow.step === 'passed') {
          return serverCommand('COMPLETE_FLOW', {}, { human:false, key:`bot-complete-${flow.cardId}` });
        }
      }
      if (flow.type === 'paranoia' && flow.step === 'paranoia-choice') {
        const target = state.session.players.find(player => player.id !== flow.actorId);
        serverCommand('PARANOIA_CHOICE', { targetId:target.id }, { human:false, key:`bot-paranoia-${flow.cardId}` });
        return scheduleBotSocialResolution();
      }
      if (flow.type === 'duel') {
        if (flow.step === 'duel-target') {
          const target = state.session.players.find(player => player.id !== flow.actorId);
          serverCommand('DUEL_TARGET', { targetId:target.id }, { human:false, key:`bot-duel-target-${flow.cardId}` });
          return scheduleBotSocialResolution();
        }
        if (flow.step === 'duel-active') {
          flow.answerMode = 'live';
          flow.answerDraft = { method:'live', text:null, choice:null, completionOnly:true };
          flow.step = 'answer-review';
          state.revision += 1;
          renderAll();
          serverCommand('SUBMIT_ANSWER', {}, { human:false, key:`bot-duel-submit-${flow.cardId}` });
          return setTimeout(() => {
            if (state.flow?.step === 'duel-vote') {
              serverCommand('DUEL_VOTE', { winnerId:flow.actorId }, { human:false, key:`bot-duel-vote-${flow.cardId}` });
              scheduleBotSocialResolution();
            }
          }, 1000);
        }
        if (flow.step === 'resolved') return serverCommand('COMPLETE_FLOW', {}, { human:false, key:`bot-duel-complete-${flow.cardId}` });
      }
      if (flow.type === 'chaos') {
        if (flow.step === 'chaos-target') {
          const target = state.session.players.find(player => player.id !== flow.actorId);
          serverCommand('CHAOS_TARGET', { targetId:target.id }, { human:false, key:`bot-chaos-target-${flow.cardId}` });
          if (state.flow?.type === 'reaction' && findPlayer(state.flow.targetId)?.isHuman) return;
          return scheduleBotSocialResolution();
        }
        if (flow.step === 'chaos-confirm') {
          resolveChaosConfirm();
          state.revision += 1;
          renderAll();
          return scheduleBotSocialResolution();
        }
        if (flow.step === 'public-prompt') {
          flow.answerMode = 'live';
          flow.answerDraft = { method:'live', text:null, choice:null, completionOnly:true };
          flow.step = 'answer-review';
          state.revision += 1;
          serverCommand('SUBMIT_ANSWER', {}, { human:false, key:`bot-chaos-answer-${flow.cardId}` });
          return scheduleBotSocialResolution();
        }
        if (flow.step === 'resolved') return serverCommand('COMPLETE_FLOW', {}, { human:false, key:`bot-chaos-complete-${flow.cardId}` });
      }
    }

    function commandTimeoutTurn() {
      const session = state.session;
      if (!session || session.phase !== 'PLAY_DRAW') return { ok:false, mutated:false };
      const player = currentPlayer();
      addEvent('TURN_TIMED_OUT', `${player.name} timed out. Demo fallback advances the turn without inventing a permanent penalty.`, 'orange');
      session.phase = 'WIN_CHECK';
      advanceTurn();
      return { ok:true, mutated:true };
    }

    function commandTimeoutSocial() {
      const flow = state.flow;
      if (!flow) return { ok:false, mutated:false };
      const player = findPlayer(flow.targetId || flow.actorId);
      addEvent('SOCIAL_TIMED_OUT', `${player?.name || 'Player'} reached the deterministic timeout state.`, 'orange');
      flow.step = 'passed';
      flow.resolved = true;
      flow.outcome = 'Timed out. The demo preserves the table and advances without public shaming.';
      return { ok:true, mutated:true };
    }

    function simulateDisconnect() {
      if (!state.session) return toast('No active session', 'Start a game before testing reconnect.', 'orange');
      if (state.connection === 'LOST') return;
      state.connection = 'LOST';
      state.reconnectDeadline = Date.now() + 12000;
      clearTimeout(state.botTimer);
      addEvent('CONNECTION_LOST', 'Client connection dropped; server holds the authoritative snapshot.', 'orange');
      syncHeader();
      renderReconnectDialog();
    }

    function reconnectNow() {
      if (state.connection !== 'LOST') return;
      state.connection = 'CONNECTED';
      state.reconnectDeadline = null;
      addEvent('CONNECTION_RESUMED', 'Authoritative snapshot restored. No local turn reconstruction or duplicate submission occurred.', 'cyan');
      $('#reconnectDialog')?.close();
      syncHeader();
      renderAll();
      scheduleBotTurn();
    }

    function tick() {
      const now = Date.now();
      if (state.connection === 'LOST' && state.reconnectDeadline) {
        if (now >= state.reconnectDeadline) {
          state.connection = 'TIMED_OUT';
          state.reconnectDeadline = null;
          addEvent('RECONNECT_TIMED_OUT', 'Grace window expired. The table remains live from the authoritative server state.', 'red');
          syncHeader();
          renderReconnectDialog();
        } else renderReconnectDialog();
        return;
      }
      const session = state.session;
      if (!session || session.winnerId || state.connection !== 'CONNECTED') return;
      if (session.phase === 'PLAY_DRAW' && session.deadline && now >= session.deadline) {
        serverCommand('TIMEOUT_TURN', {}, { human:false, key:`timeout-turn-${session.id}-${session.completedTurns}` });
        return;
      }
      if (state.flow?.deadline && ['answer-capturing','answer-input','answer-choose','answer-live','public-prompt','private-preview','paranoia-choice','duel-target','duel-active'].includes(state.flow.step) && now >= state.flow.deadline) {
        serverCommand('TIMEOUT_SOCIAL', {}, { human:false, key:`timeout-social-${state.flow.cardId}-${state.flow.step}` });
        return;
      }
      if (state.flow?.type === 'reaction' && state.flow.deadline && now >= state.flow.deadline) {
        serverCommand('NOPE_REACTION', { useNope:false }, { human:false, key:`reaction-timeout-${state.flow.cardId || state.flow.effect}` });
        return;
      }
      renderTimerOnly();
    }

    /* ---------- Board, libraries and production QA ---------- */
    function commandAddPrompt({ type, text, authorship, targeting, stage } = {}) {
      if (!['truth','dare'].includes(type)) throw new Error('Book II player-created content supports Truth or Dare prompts before play.');
      const cleanText = String(text || '').trim();
      if (cleanText.length < 10) throw new Error('Write a clear playable prompt of at least 10 characters.');
      if (cleanText.length > 280) throw new Error('Prompt is too long for the phone play surface.');
      if (!['signed','reveal','taboo'].includes(authorship)) throw new Error('Choose Signed, Reveal After or Taboo.');
      const blockedPattern = /(self[- ]?harm|illegal weapon|coerc|hate crime)/i;
      const approved = !blockedPattern.test(cleanText);
      const prompt = {
        id:uid('prompt'), type, text:cleanText, world:state.setup.world, stage:clamp(Number(stage || 0),0,4),
        source:'live', author:state.setup.profileName || 'You', authorship, targeting:targeting || 'current', options:[],
        approved, moderationStatus:approved ? 'accepted' : 'review', saved:0
      };
      state.prompts.unshift(prompt);
      addEvent('PROMPT_SUBMITTED', approved ? 'Prompt passed the demo moderation check and entered the live eligible pool.' : 'Prompt entered REVIEW and remains ineligible.', approved ? 'lime' : 'orange', { promptId:prompt.id });
      toast(approved ? 'Added to this game' : 'Pending review', approved ? 'The prompt is eligible according to profile and stage rules.' : 'The prompt is not eligible until approved.', approved ? 'lime' : 'orange');
      return { ok:true, mutated:true, promptId:prompt.id };
    }

    function commandSavePrompt({ promptId, destination = 'my' } = {}) {
      const prompt = state.prompts.find(item => item.id === promptId);
      if (!prompt) throw new Error('Prompt not found.');
      if (destination === 'my') {
        state.mySaved.add(promptId);
        prompt.saved = Number(prompt.saved || 0) + 1;
        addEvent('PROMPT_SAVED_PRIVATE','My Saved Deck stored the prompt instantly and privately.','cyan',{promptId});
      } else if (destination === 'house') {
        state.houseSaved.add(promptId);
        addEvent('PROMPT_SAVED_HOUSE','House Deck stored the prompt for the recurring group.','orange',{promptId});
      } else if (destination === 'room') {
        return commandAddToRoomPool({promptId});
      } else if (destination === 'community') {
        const submission = {id:uid('submission'),promptId,text:prompt.text,status:'submitted',createdAt:Date.now()};
        state.ecosystem.submissions.unshift(submission);
        addEvent('CHAOS_BOARD_SUBMITTED','Resolved prompt suggested to the CHAOS Board moderation queue.','magenta',{promptId,submissionId:submission.id});
      }
      return { ok:true, mutated:true };
    }

    function commandCreatePrompt(payload = {}) {
      const type = payload.type;
      const textValue = String(payload.text || '').trim();
      const destination = payload.destination || 'my';
      if (!['truth','dare'].includes(type)) throw new Error('Player-created content supports Truth or Dare prompts.');
      if (textValue.length < 10 || textValue.length > 280) throw new Error('Write a clear prompt between 10 and 280 characters.');
      if (!['signed','reveal','taboo'].includes(payload.authorship)) throw new Error('Choose Signed, Reveal After or Taboo.');
      const world = payload.world === 'adult' ? 'adult' : 'clean';
      const blockedPattern = /(self[- ]?harm|illegal weapon|coerc|hate crime)/i;
      const passesDemoModeration = !blockedPattern.test(textValue);
      const prompt = {
        id:uid('prompt'),type,text:textValue,world,stage:clamp(Number(payload.stage || 0),0,4),
        source: destination === 'house' ? 'house' : destination === 'live' ? 'live' : destination === 'community' ? 'community-pending' : 'personal',
        author:state.setup.profileName || 'You',authorship:payload.authorship,targeting:payload.targeting || 'current',options:[],
        category:payload.category || 'Friends',tags:String(payload.tags||'').split(',').map(tag=>tag.trim()).filter(Boolean),
        minPlayers:clamp(Number(payload.minPlayers || 2),2,10),maxPlayers:clamp(Number(payload.maxPlayers || 10),2,10),
        attribution:payload.attribution || 'profile',approved:destination !== 'community' && passesDemoModeration,
        moderationStatus: destination === 'community' ? 'submitted' : passesDemoModeration ? 'accepted' : 'review',
        saved:0,plays:0,createdAt:Date.now(),staffPick:false,legendary:false
      };
      if (prompt.maxPlayers < prompt.minPlayers) throw new Error('Maximum players must be at least the minimum players.');
      state.prompts.unshift(prompt);
      if (destination === 'my') {
        state.mySaved.add(prompt.id);
        addEvent('PROMPT_SAVED_PRIVATE','Prompt saved instantly to My Saved Deck. It was not submitted publicly.','cyan',{promptId:prompt.id});
        toast('Saved privately','The prompt is only in My Saved Deck.','cyan');
      } else if (destination === 'house') {
        state.houseSaved.add(prompt.id);
        addEvent('PROMPT_SAVED_HOUSE','Prompt saved to the private House Deck. It was not published globally.','orange',{promptId:prompt.id});
        toast('Added to House Deck','The recurring group can use this prompt.','orange');
      } else if (destination === 'live') {
        if (passesDemoModeration) state.ecosystem.liveRoomPool.add(prompt.id);
        addEvent('PROMPT_SUBMITTED_LIVE',passesDemoModeration?'Prompt passed room moderation and entered tonight’s sealed pool.':'Prompt entered review and remains ineligible.',passesDemoModeration?'lime':'orange',{promptId:prompt.id});
        toast(passesDemoModeration?'Added to current game':'Pending review',passesDemoModeration?'The prompt is in tonight’s Live Room Pool.':'It remains ineligible until approved.',passesDemoModeration?'lime':'orange');
      } else {
        const submission = { id:uid('submission'),promptId:prompt.id,text:prompt.text,status:'submitted',createdAt:Date.now() };
        state.ecosystem.submissions.unshift(submission);
        addEvent('CHAOS_BOARD_SUBMITTED','Prompt submitted to moderation. Private saving and global suggestion remain separate actions.','magenta',{promptId:prompt.id,submissionId:submission.id});
        toast('Submitted to moderation','Duplicate and quality checks come next.','magenta');
      }
      return {ok:true,mutated:true,promptId:prompt.id};
    }

    function commandAddToRoomPool({ promptId } = {}) {
      const prompt = state.prompts.find(item=>item.id===promptId);
      if (!prompt || !prompt.approved) throw new Error('Only approved prompts can enter the Live Room Pool.');
      state.ecosystem.liveRoomPool.add(promptId);
      addEvent('PROMPT_ADDED_TO_ROOM','Approved prompt added to tonight’s Live Room Pool.','lime',{promptId});
      return {ok:true,mutated:true};
    }

    function commandRemoveFromRoomPool({ promptId } = {}) {
      state.ecosystem.liveRoomPool.delete(promptId);
      addEvent('PROMPT_REMOVED_FROM_ROOM','Prompt removed from tonight’s Live Room Pool without deleting it from its source library.','orange',{promptId});
      return {ok:true,mutated:true};
    }

    function commandAdvanceSubmission({ submissionId } = {}) {
      const submission = state.ecosystem.submissions.find(item=>item.id===submissionId);
      if (!submission) throw new Error('Submission not found.');
      const prompt = state.prompts.find(item=>item.id===submission.promptId);
      const order = ['submitted','automated','duplicate','quality','approved'];
      const index = order.indexOf(submission.status);
      if (index < 0 || index >= order.length-1) return {ok:true,mutated:false};
      submission.status = order[index+1];
      if (submission.status === 'approved') {
        prompt.source = 'community';
        prompt.approved = true;
        prompt.moderationStatus = 'approved';
        prompt.plays = 0;
        addEvent('COMMUNITY_PROMPT_APPROVED','Submission approved and published in Community CHAOS.','lime',{promptId:prompt.id});
        toast('Community prompt approved','It now appears separately from Cribbit Originals.','lime');
      } else {
        addEvent('MODERATION_STEP_COMPLETED',`Submission advanced to ${submission.status}.`,'magenta',{submissionId});
      }
      return {ok:true,mutated:true};
    }

    function commandLabAddCard({ kind } = {}) {
      const player = humanPlayer();
      if (!state.session || !player) throw new Error('Start a session first.');
      const color = state.session.activeColor || 'lime';
      let card;
      if (kind === 'number') card = createCard('number', { color, value:Number(state.session.activeSymbol) || 7 });
      else if (['skip','reverse','draw'].includes(kind)) card = createCard(kind, { color });
      else card = createCard(kind, { symbol:kind });
      player.hand.push(card);
      addEvent('LAB_CARD_ADDED', `Demo lab added ${cardMeta(card).title} to the human hand.`, 'orange');
      return { ok:true, mutated:true };
    }

    function commandLabOneCard() {
      const player = humanPlayer();
      if (!state.session || !player) throw new Error('Start a session first.');
      const value = Number(state.session.activeSymbol);
      player.hand = [createCard('number', { color:state.session.activeColor || 'lime', value:Number.isFinite(value) ? value : 7 })];
      addEvent('LAB_HAND_SET', 'Human hand set to one legal card for empty-hand win testing.', 'orange');
      return { ok:true, mutated:true };
    }

    function commandLabHumanTurn() {
      const session = state.session;
      if (!session) throw new Error('Start a session first.');
      clearTimeout(state.botTimer);
      session.currentIndex = session.players.findIndex(player => player.isHuman);
      session.phase = 'PLAY_DRAW';
      session.deadline = Date.now()+turnSeconds()*1000;
      state.flow = null;
      addEvent('LAB_TURN_OVERRIDE', 'Demo lab moved the authoritative current player to the human seat.', 'orange');
      return { ok:true, mutated:true };
    }

    function commandLabTriggerDraw() {
      const session = state.session;
      const target = humanPlayer();
      if (!session || !target) throw new Error('Start a session first.');
      clearTimeout(state.botTimer);
      if (!target.hand.some(card => card.kind === 'nope')) target.hand.push(createCard('nope', { symbol:'nope' }));
      const targetIndex = session.players.findIndex(player => player.id === target.id);
      const actorIndex = mod(targetIndex - session.direction, session.players.length);
      const actor = session.players[actorIndex];
      session.currentIndex = actorIndex;
      session.phase = 'ANSWER_RESOLVE';
      const drawCard = createCard('draw', { color:session.activeColor || 'lime', symbol:'draw' });
      session.discard.push(drawCard);
      session.activeColor = drawCard.color;
      session.activeSymbol = 'draw';
      session.pendingEffect = { type:'draw', actorId:actor.id, targetId:target.id, amount:state.knobs.drawPenalty, cardId:drawCard.id };
      state.flow = { type:'reaction', effect:'draw', actorId:actor.id, targetId:target.id, amount:state.knobs.drawPenalty, cardId:drawCard.id, step:'offer-nope', deadline:Date.now()+10000 };
      state.reactionDeadline = state.flow.deadline;
      addEvent('LAB_DRAW_TARGETED', `${actor.name} played a configured Draw effect against ${target.name}; Nope reaction window opened.`, 'orange');
      return { ok:true, mutated:true };
    }

    function commandForceRecap() {
      const session = state.session;
      const player = humanPlayer();
      if (!session || !player) throw new Error('Start a session first.');
      player.hand = [];
      session.winnerId = player.id;
      session.phase = 'WIN_CHECK';
      session.deadline = null;
      state.flow = null;
      clearTimeout(state.botTimer);
      addEvent('LAB_WIN_CONFIRMED', 'Demo lab forced a legal zero-card snapshot for recap QA.', 'gold');
      showView('recap');
      return { ok:true, mutated:true };
    }

    function commandPublishPrompt() {
      const flow = state.flow;
      if (!flow || flow.type !== 'social' || flow.step !== 'private-preview') throw new Error('No privately previewed prompt is ready for public reveal.');
      flow.step = 'public-prompt';
      flow.answerState = 'WAITING_FOR_PLAYER';
      flow.deadline = Date.now()+45000;
      addEvent('PROMPT_REVEALED', `${findPlayer(flow.targetId).name} received the public ${flow.family} prompt. Hidden authorship remains sealed as required.`, flow.family === 'truth' ? 'lime' : 'orange');
      return { ok:true, mutated:true };
    }

    /* ---------- Rendering ---------- */
    function renderAll() {
      if (state.renderLock) return;
      state.renderLock = true;
      try {
        syncHeader();
        renderSetup();
        if (state.session) {
          renderGame();
          renderCallMode();
          renderLab();
          if (state.session.winnerId || state.view === 'recap') renderRecap();
        } else {
          renderNoSessionSurfaces();
          renderLab();
        }
        if (state.view === 'rooms') renderRooms();
        if (state.view === 'board') renderBoard();
        if (state.view === 'library') renderLibrary();
        if (state.view === 'create') renderCreate();
        renderFlowDialog();
      } finally {
        state.renderLock = false;
      }
    }

    function renderSetup() {
      const mode = MODES[state.setup.mode];
      $$('.mode-card').forEach(button => button.setAttribute('aria-pressed', String(button.dataset.mode === state.setup.mode)));
      $$('.source-toggle').forEach(button => button.setAttribute('aria-pressed', String(Boolean(state.setup.sources[button.dataset.source]))));
      const range = $('#playerCount');
      if (range && mode) {
        range.min = String(mode.min);
        range.max = String(mode.max);
        state.setup.playerCount = clamp(state.setup.playerCount, mode.min, mode.max);
        range.value = String(state.setup.playerCount);
        $('#playerCountValue').value = String(state.setup.playerCount);
        $('#playerCountValue').textContent = String(state.setup.playerCount);
      }
      if ($('#worldSelect')) $('#worldSelect').value = state.setup.world;
      renderCeilingOptions();
    }

    function renderNoSessionSurfaces() {
      if ($('#playerList')) $('#playerList').innerHTML = `<div class="empty-state">${icon('i-users')}<h3>No active room</h3><p>Start a simulated game in the Lobby.</p></div>`;
      if ($('#handScroll')) $('#handScroll').innerHTML = '';
      if ($('#discardSlot')) $('#discardSlot').innerHTML = `<span class="tag">Starter card appears here</span>`;
      if ($('#drawPileCount')) $('#drawPileCount').textContent = '0 left';
      if ($('#statsGrid')) $('#statsGrid').innerHTML = '';
      if ($('#eventList')) $('#eventList').innerHTML = `<div class="empty-state">${icon('i-wave')}<h3>No events yet</h3></div>`;
      renderCallMode();
    }

    function renderGame() {
      const session = state.session;
      if (!session) return;
      const fixtureMeta = visualWindow.__CRIBBIT_VISUAL_FIXTURE_META__ || null;
      const current = currentPlayer();
      const human = humanPlayer();
      $('#modeBadge').textContent = fixtureMeta ? `${MODES[session.mode].label} · ${fixtureMeta.label}` : MODES[session.mode].label;
      $('#modeBadge').dataset.tone = session.mode === 'mayhem' ? 'magenta' : session.mode === 'duel' ? 'cyan' : 'lime';
      $('#gameRoomName').textContent = session.roomName;
      $('#gameRoomMeta').textContent = fixtureMeta ? `${session.players.length} players • ${MODES[session.mode].label} • Round ${session.round} • ${fixtureMeta.label}` : `${session.players.length} players • ${MODES[session.mode].label} • Round ${session.round}`;
      $('#stageChip').textContent = STAGES[session.world][session.stage]?.label || 'Warm Up';
      $('#currentTurnName').textContent = current?.name || '-';
      $('#activeColorLabel').textContent = COLOR_META[session.activeColor]?.label || session.activeColor || '-';
      $('#activeColorLabel').style.color = COLOR_META[session.activeColor]?.css || 'var(--text)';
      $('#activeSymbolLabel').textContent = String(session.activeSymbol || '-').toUpperCase();
      $('#directionLabel').textContent = session.direction === 1 ? 'Clockwise' : 'Counterclockwise';
      $('#phoneRevision').textContent = String(state.revision);
      if ($('#boardPhaseLabel')) $('#boardPhaseLabel').textContent = session.phase.replaceAll('_',' / ');
      $('#handCount').textContent = `${human?.hand.length || 0} card${human?.hand.length === 1 ? '' : 's'}`;
      $('#authorityCopy').textContent = `JavaScript state owns current player, ${session.activeColor} / ${session.activeSymbol}, hand ownership, prompt eligibility, winner and revision ${state.revision}. Client highlights are hints.`;
      renderPhaseTrack();
      renderPlayers();
      renderDiscard();
      renderHand();
      renderStats();
      renderEvents();
      renderActivePanel();
      renderInlineFlowControls();
      renderTimerOnly();
      const canDraw = current?.isHuman && session.phase === 'PLAY_DRAW' && (state.knobs.voluntaryDraw || legalCardsFor(human).length === 0) && state.connection === 'CONNECTED';
      $$('[data-draw-control]').forEach(drawControl => {
        drawControl.disabled = !canDraw;
        drawControl.title = canDraw ? 'Draw one card under the current demo contract.' : 'Draw is unavailable while a legal card is held under this demo configuration.';
      });
      if ($('#drawPileCount')) $('#drawPileCount').textContent = `${session.deck.length} left`;
      scheduleBoardFit();
    }

    function renderPhaseTrack() {
      const session = state.session;
      const labels = { TURN_START:'Turn start', PLAY_DRAW:'Play / draw', TRIGGER:'Trigger', ANSWER_RESOLVE:'Answer / resolve', WIN_CHECK:'Win check', NEXT_TURN:'Next turn' };
      $('#phaseTrack').innerHTML = PHASES.map(phase => `<span class="phase-chip${session.phase === phase ? ' is-active' : ''}">${labels[phase]}</span>`).join('');
    }

    function renderPlayers() {
      const session = state.session;
      const current = currentPlayer();
      $('#playerList').innerHTML = session.players.map(player => `<div class="player-row${player.id === current.id ? ' is-current' : ''}${player.isHuman ? ' is-you' : ''}">
        <span class="avatar" style="--avatar:${player.color}">${escapeHTML(player.name.slice(0,1).toUpperCase())}</span>
        <span class="player-meta"><b>${escapeHTML(player.name)}</b><span>${player.connected ? 'Connected' : 'Lost'} · ceiling ${escapeHTML(CEILINGS[session.world].find(item => item.value === player.ceiling)?.label || String(player.ceiling))}</span></span>
        <strong class="card-count">${player.hand.length}</strong>
      </div>`).join('');
    }

    function renderDiscard() {
      const slot = $('#discardSlot');
      const session = state.session;
      if (!slot || !session) return;
      const pile = session.discard.slice(-5);
      if (!pile.length) {
        slot.innerHTML = '<span class="tag">No card</span>';
        return;
      }
      const stack = pile.length >= 4 ? pile.slice(-4) : [...Array(4 - pile.length).fill(pile[0]), ...pile];
      const layers = stack.map((card, index) => {
        const isTop = index === stack.length - 1;
        const layerIndex = index - (stack.length - 1);
        const dx = isTop ? '0px' : `${layerIndex * 5}px`;
        const dy = isTop ? '0px' : `${Math.max(0, -layerIndex) * 2}px`;
        const rot = isTop ? '0deg' : `${layerIndex * 1.5}deg`;
        const scale = isTop ? '1' : `${1 - Math.min(0.04, (stack.length - index - 1) * 0.01)}`;
        const op = isTop ? '1' : `${0.12 + index * 0.12}`;
        const topClass = isTop ? ' is-top' : '';
        return `<div class="discard-layer${topClass}" style="--dx:${dx};--dy:${dy};--rot:${rot};--scale:${scale};--op:${op};--z:${index + 1}">${renderCard(card, { size:'mini' })}</div>`;
      }).join('');
      slot.innerHTML = `<div class="discard-stack" aria-label="Discard pile stack">${layers}</div>`;
    }

    function renderHand() {
      const player = humanPlayer();
      if (!player) return;
      $('#handScroll').innerHTML = player.hand.map(card => {
        const legal = isLegalCard(card, player.id);
        return renderCard(card, { size:'mini', interactive:true, legal, info:true, ariaLabel:`${cardMeta(card).title}. ${legal ? 'Legal to play.' : 'Not legal in the current state.'}` });
      }).join('') || `<div class="empty-state"><h3>Empty hand</h3><p>Awaiting authoritative win check.</p></div>`;
    }

    function renderStats() {
      const session = state.session;
      const human = humanPlayer();
      const stats = [
        ['Cards left',human.hand.length,'lime'],['Truths',human.stats.truths,'lime'],['Dares',human.stats.dares,'orange'],['Paranoia',human.stats.paranoia,'purple'],['Duels won',human.stats.duelWins,'cyan'],['Nopes used',human.stats.nopes,'gold'],['Passes',human.stats.passes,'cyan'],['Flags',human.stats.flags,'magenta']
      ];
      $('#statsGrid').innerHTML = stats.map(([label,value,tone]) => `<div class="stat-card"><span>${label}</span><b style="--stat:var(--${tone})">${value}</b></div>`).join('');
    }

    function renderEvents() {
      const color = tone => tone === 'lime' ? 'var(--lime)' : tone === 'orange' ? 'var(--orange)' : tone === 'purple' ? 'var(--purple)' : tone === 'magenta' ? 'var(--magenta)' : tone === 'gold' ? 'var(--gold)' : tone === 'red' ? 'var(--red)' : 'var(--cyan)';
      if ($('#eventList')) $('#eventList').innerHTML = state.events.slice(0,24).map(event => `<article class="event-item" style="--event-color:${color(event.tone)}"><div class="event-item__top"><b>${escapeHTML(event.type.replaceAll('_',' '))}</b><time>${escapeHTML(event.time)}</time></div><p>${escapeHTML(event.message)}</p></article>`).join('') || `<div class="empty-state">${icon('i-wave')}<h3>No events</h3></div>`;
      if ($('#promptHistoryList')) {
        const resolved = state.session?.resolvedPrompts || [];
        $('#promptHistoryList').innerHTML = resolved.slice(-10).reverse().map(item=>{ const prompt=state.prompts.find(p=>p.id===item.promptId); return prompt ? `<article class="prompt-history-item" style="--history:${promptAccent(prompt)}"><b>${escapeHTML(prompt.type)} · ${escapeHTML(prompt.source)}</b><p>${escapeHTML(prompt.text)}</p></article>` : ''; }).join('') || `<div class="empty-state">${icon('i-bookmark')}<h3>No resolved prompts</h3><p>Social moments appear here after resolution.</p></div>`;
      }
    }

    function renderActivePanel() {
      const session = state.session;
      const flow = state.flow;
      let title = 'Play or draw';
      let copy = 'Match the active color or symbol, use an eligible special, or draw under the current demo rules.';
      if (session.winnerId) { title = 'Game over'; copy = `${findPlayer(session.winnerId).name} legally reached zero cards.`; }
      else if (state.connection === 'LOST') { title = 'Connection lost'; copy = 'The server holds the authoritative snapshot during the grace window.'; }
      else if (flow) {
        title = flow.type === 'reaction' ? 'Nope reaction' : flow.type === 'wild' ? 'Choose a color' : `${flow.family || flow.type} resolution`;
        copy = flow.prompt?.text || flow.effect?.copy || 'Complete the active authoritative flow.';
      } else if (!currentPlayer()?.isHuman) {
        title = `${currentPlayer().name}'s turn`;
        copy = 'Bot actions use the same simulated server validation and event log.';
      }
      $('#activeChallengeTitle').textContent = title;
      $('#activeChallengeCopy').textContent = copy;
    }

    function renderInlineFlowControls() {
      const host = $('#inlineFlowControls');
      const stage = $('#gameStage');
      if (!host) return;
      const flow = state.flow;
      if (stage) stage.dataset.flow = flow?.type || 'none';
      if (!flow || flow.type !== 'wild') {
        host.innerHTML = '';
        return;
      }
      host.innerHTML = `<div class="inline-flow-title">Choose active color</div><div class="inline-wild-grid">${Object.entries(COLOR_META).map(([key,meta]) => `<button class="inline-color-choice" data-action="choose-wild" data-color="${key}" style="--choice:${meta.css}" type="button"><i aria-hidden="true"></i><b>${escapeHTML(meta.label)}</b><span>Activate</span></button>`).join('')}</div>`;
    }

    function renderTimerOnly() {
      const session = state.session;
      if (!session || !$('#timerValue')) return;
      const deadline = state.connection === 'LOST' ? state.reconnectDeadline : state.flow?.deadline || session.deadline;
      const total = state.connection === 'LOST' ? 12 : state.flow ? 45 : turnSeconds();
      const remaining = deadline ? Math.max(0, Math.ceil((deadline-Date.now())/1000)) : 0;
      $('#timerValue').textContent = String(remaining);
      const pct = deadline ? clamp(((deadline-Date.now())/(total*1000))*100,0,100) : 0;
      $('#timerProgress').style.width = `${pct}%`;
    }

    function findCardById(cardId) {
      const session = state.session;
      if (!session) return null;
      for (const player of session.players) {
        const card = player.hand.find(item => item.id === cardId);
        if (card) return { card, owner:player };
      }
      const card = [...session.deck,...session.discard].find(item => item.id === cardId);
      return card ? { card, owner:null } : null;
    }

    function openCardDetail(cardId) {
      const found = findCardById(cardId);
      if (!found) return;
      const { card, owner } = found;
      const meta = cardMeta(card);
      const legal = owner ? isLegalCard(card, owner.id) : false;
      $('#cardDialogBody').innerHTML = `<div class="flow-layout">${renderCard(card,{size:'large'})}<div>
        <p class="eyebrow">${escapeHTML(meta.role || 'Card')}</p><h3 style="font:900 34px/1 var(--font-display);text-transform:uppercase;margin:8px 0">${escapeHTML(meta.title)}</h3>
        <div class="authority-box"><b>Canonical resolution</b><p>${escapeHTML(meta.resolution || '')}</p></div>
        <div class="stats-grid" style="margin-top:12px"><div class="stat-card"><span>Owner</span><b style="font-size:15px">${escapeHTML(owner?.name || 'Deck / discard')}</b></div><div class="stat-card"><span>Current legality</span><b style="font-size:15px;color:${legal?'var(--lime)':'var(--faint)'}">${legal?'Legal':'Not legal'}</b></div><div class="stat-card"><span>Color</span><b style="font-size:15px">${escapeHTML(COLOR_META[card.color]?.label || 'Family / wild')}</b></div><div class="stat-card"><span>Symbol</span><b style="font-size:15px">${escapeHTML(cardSymbol(card))}</b></div></div>
        <p class="demo-note" style="margin-top:14px">Client legality is only a visual hint. The simulated server validates ownership, current turn and active state before mutating the session.</p>
      </div></div>`;
      $('#cardDialog').showModal();
    }

    function flowAccent(flow) {
      const family = flow?.family || flow?.originFamily;
      return family === 'truth' ? 'var(--lime)' : family === 'dare' ? 'var(--orange)' : family === 'paranoia' ? 'var(--purple)' : family === 'duel' ? 'var(--cyan)' : family === 'chaos' ? 'var(--magenta)' : flow?.type === 'reaction' ? 'var(--gold)' : 'var(--cyan)';
    }

    function promptTags(prompt, { resolved = false } = {}) {
      if (!prompt) return '';
      const stageLabel = STAGES[prompt.world]?.[prompt.stage]?.label || `Stage ${prompt.stage}`;
      const source = prompt.source === 'original' ? 'Cribbit Original' : prompt.source === 'community' ? 'Community CHAOS' : prompt.source === 'house' ? 'House Deck' : 'Live submission';
      return `<div class="prompt-display__meta"><span class="tag" data-tone="${prompt.type === 'truth' ? 'lime' : prompt.type === 'dare' ? 'orange' : prompt.type === 'paranoia' ? 'purple' : prompt.type === 'duel' ? 'cyan' : 'magenta'}">${escapeHTML(prompt.type)}</span><span class="tag">${escapeHTML(source)}</span><span class="tag">${escapeHTML(stageLabel)}</span><span class="tag" data-tone="purple">${escapeHTML(promptAuthorLabel(prompt,resolved))}</span></div>`;
    }

    function answerMethodsHTML(flow) {
      const disabledChoose = !flow.prompt?.options?.length;
      return `<div class="answer-methods">
        <button class="answer-tile" data-action="answer-mode" data-mode="speak" style="--answer:var(--lime)" type="button">${icon('i-mic')}<b>Speak</b><span>Explicit mic session for this answer only.</span></button>
        <button class="answer-tile" data-action="answer-mode" data-mode="type" style="--answer:var(--cyan)" type="button">${icon('i-chat')}<b>Type</b><span>Direct text input with review.</span></button>
        <button class="answer-tile" data-action="answer-mode" data-mode="choose" style="--answer:var(--gold)" type="button" ${disabledChoose ? 'disabled title="No curated choices on this prompt"' : ''}>${icon('i-choice')}<b>Choose</b><span>${disabledChoose ? 'No curated choices for this prompt.' : 'Pick one explicit curated option.'}</span></button>
        <button class="answer-tile" data-action="answer-mode" data-mode="live" style="--answer:var(--magenta)" type="button">${icon('i-wave')}<b>Answered Live</b><span>Store completion only; never what was said.</span></button>
      </div>`;
    }

    function targetGridHTML(action, { exclude = [] } = {}) {
      return `<div class="target-grid">${state.session.players.filter(player => !exclude.includes(player.id)).map(player => `<button class="target-option" data-action="${action}" data-target-id="${player.id}" type="button"><span class="avatar" style="--avatar:${player.color}">${escapeHTML(player.name[0])}</span><span><b>${escapeHTML(player.name)}</b><small style="display:block;color:var(--muted);margin-top:3px">${player.hand.length} cards</small></span></button>`).join('')}</div>`;
    }

    function renderFlowDialog() {
      const dialog = $('#flowDialog');
      const flow = state.flow;
      if (!dialog) return;
      if (!flow) {
        if (dialog.open) dialog.close();
        return;
      }
      if (flow.type === 'wild') {
        if (dialog.open) dialog.close();
        return;
      }
      const flowActor = findPlayer(flow.actorId);
      const humanReaction = flow.type === 'reaction' && findPlayer(flow.targetId)?.isHuman;
      if (flowActor && !flowActor.isHuman && !humanReaction) {
        if (dialog.open) dialog.close();
        return;
      }
      let title = 'Resolve effect';
      let subtitle = 'The simulated server owns the transition.';
      let html = '';
      const accent = flowAccent(flow);

      if (flow.type === 'wild') {
        title = 'Wild · choose active color';
        subtitle = 'The client presents four choices; authoritative state changes only after validation.';
        html = `<div class="color-grid">${Object.entries(COLOR_META).map(([key,meta]) => `<button class="color-choice" data-action="choose-wild" data-color="${key}" style="--choice:${meta.css}" type="button">${escapeHTML(meta.label)}</button>`).join('')}</div>`;
      } else if (flow.type === 'reaction') {
        title = 'Nope reaction window';
        subtitle = 'Nope is a visible tactical hand-card action, not a safety control.';
        const target = findPlayer(flow.targetId);
        const count = Math.max(0,Math.ceil((flow.deadline-Date.now())/1000));
        html = `<div style="text-align:center"><div class="reaction-count">${count}</div><h3 style="font:900 28px/1 var(--font-display);text-transform:uppercase">${escapeHTML(target.name)}, respond?</h3><p class="view-lead" style="font-size:13px">${flow.effect === 'draw' ? `A configured Draw ${flow.amount} effect targets you.` : 'A targeted Chaos hand-swap effect targets you.'}</p><div class="prompt-controls" style="justify-content:center"><button class="button button--gold" data-action="nope-reaction" data-use="true" type="button">Play Nope</button><button class="button" data-action="nope-reaction" data-use="false" type="button">Allow effect</button></div></div>`;
      } else if (flow.type === 'social') {
        const meta = FAMILY_META[flow.family];
        title = `${meta.title} resolution`;
        subtitle = flow.originFamily === 'chaos' ? 'Chaos opened this explicit prompt path.' : `${meta.role}; hidden authorship follows the selected contract.`;
        if (flow.step === 'roulette-ready' || flow.step === 'roulette-spinning') {
          const spinning = flow.step === 'roulette-spinning';
          html = `<div class="flow-layout"><div class="wheel-wrap"><div class="wheel-pointer"></div><div class="roulette-wheel${spinning ? ' is-spinning' : ''}" style="--wheel-accent:${accent};--wheel-turn:${flow.rouletteRotation || 1500}deg">${[1,2,3,4,5,6,7,8].map((n,i)=>`<span class="wheel-label" style="--a:${i*45}deg">${String(n).padStart(2,'0')}</span>`).join('')}<span class="wheel-hub">${icon('i-frog')}</span></div></div><div><div class="private-banner">${icon('i-shield')}<span><b>Server result already selected.</b><br>The anonymous wheel is visualization only. No author name, avatar or author-linked color appears.</span></div><h3 style="font:900 32px/1.05 var(--font-display);text-transform:uppercase;margin:20px 0 8px">${flow.family === 'truth' ? 'Truth Question Roulette' : 'Dare Challenge Roulette'}</h3><p class="view-lead" style="font-size:12px">Eligible ${escapeHTML(flow.family)} ${flow.family === 'truth' ? 'question' : 'challenge'} selected from the room profile, stage, player ceiling, source mix, cooldown and moderation state.</p><div class="prompt-controls"><button class="button button--primary" data-action="spin-roulette" type="button" ${spinning?'disabled':''}>${spinning?'Spinning…':'Spin Roulette'}</button></div></div></div>`;
        } else if (flow.step === 'private-preview') {
          const target = findPlayer(flow.targetId);
          html = `<div class="private-banner">${icon('i-lock')}<span><b>Private preview for ${escapeHTML(target.name)}.</b><br>Rewind is available only here for Truth/Dare, before public reveal.</span></div><div class="prompt-display" style="--flow-accent:${accent};margin-top:14px">${promptTags(flow.prompt)}<h3>${escapeHTML(flow.prompt.text)}</h3><p>Authorship remains sealed according to ${escapeHTML(flow.prompt.authorship === 'reveal' ? 'Reveal After' : flow.prompt.authorship)}.</p><div class="prompt-controls"><button class="button button--primary" data-action="publish-prompt" type="button">Reveal prompt to room</button><button class="button" data-action="safety-rewind" type="button" ${target.rewindAvailable?'':'disabled'}>Rewind${target.rewindAvailable?'':' used'}</button><button class="button" data-action="safety-pass" type="button">Pass / Not for Me</button><button class="button button--danger" data-action="safety-flag" type="button">Flag</button></div></div>`;
        } else if (flow.step === 'public-prompt') {
          html = `<div class="prompt-display" style="--flow-accent:${accent}">${promptTags(flow.prompt)}<h3>${escapeHTML(flow.prompt.text)}</h3><p>${flow.prompt.authorship === 'signed' ? escapeHTML(promptAuthorLabel(flow.prompt)) : 'Hidden authorship is still protected until the contract permits a reveal.'}</p>${answerMethodsHTML(flow)}<div class="prompt-controls"><button class="button" data-action="safety-pass" type="button">Pass / Not for Me</button><button class="button button--danger" data-action="safety-flag" type="button">Flag for review</button></div></div>`;
        } else if (flow.step.startsWith('answer-')) {
          html = renderAnswerStep(flow, accent);
        } else if (flow.step === 'resolved' || flow.step === 'passed') {
          html = resolvedFlowHTML(flow, accent);
        }
      } else if (flow.type === 'paranoia') {
        title = 'Paranoia · private choice';
        subtitle = 'Explicit Choose input replaces spoken names or ambient-audio assumptions.';
        if (flow.step === 'paranoia-choice') html = `<div class="prompt-display" style="--flow-accent:${accent}">${promptTags(flow.prompt)}<h3>${escapeHTML(flow.prompt.text)}</h3><p>Your target choice is collected privately. Only the designed result is revealed.</p>${targetGridHTML('paranoia-choice',{exclude:[flow.actorId]})}<div class="prompt-controls"><button class="button" data-action="safety-pass" type="button">Pass</button><button class="button button--danger" data-action="safety-flag" type="button">Flag</button></div></div>`;
        else html = resolvedFlowHTML(flow,accent);
      } else if (flow.type === 'duel') {
        title = 'Duel · sequential windows';
        subtitle = 'Two single-player turns resolve in sequence; local Duel scoring never replaces empty-hand victory.';
        if (flow.step === 'duel-target') html = `<h3 style="font:900 30px/1 var(--font-display);text-transform:uppercase">Choose an opponent</h3>${targetGridHTML('duel-target',{exclude:[flow.actorId]})}`;
        else if (flow.step === 'duel-active') html = `<div class="prompt-display" style="--flow-accent:${accent}">${promptTags(flow.prompt)}<h3>${escapeHTML(flow.prompt.text)}</h3><p>Window 1 of 2: ${escapeHTML(findPlayer(flow.actorId).name)} responds first.</p>${answerMethodsHTML(flow)}</div>`;
        else if (flow.step.startsWith('answer-')) html = renderAnswerStep(flow,accent);
        else if (flow.step === 'duel-opponent') html = `<div class="empty-state">${icon('i-clock')}<h3>Opponent window</h3><p>${escapeHTML(findPlayer(flow.opponentId).name)} is completing the separate resolution window.</p></div>`;
        else if (flow.step === 'duel-vote') html = `<div class="prompt-display" style="--flow-accent:${accent}"><h3>Resolve the Duel</h3><p>Choose the local Duel winner. This result is recap metadata only.</p><div class="target-grid">${[flow.actorId,flow.opponentId].map(id=>{const p=findPlayer(id);return `<button class="target-option" data-action="duel-vote" data-winner-id="${p.id}" type="button"><span class="avatar" style="--avatar:${p.color}">${escapeHTML(p.name[0])}</span><span><b>${escapeHTML(p.name)}</b><small style="display:block;color:var(--muted);margin-top:3px">Vote as Duel winner</small></span></button>`}).join('')}</div></div>`;
        else html = resolvedFlowHTML(flow,accent);
      } else if (flow.type === 'chaos') {
        title = `Chaos · ${flow.effect?.title || 'effect'}`;
        subtitle = 'The selected deterministic effect resolves exactly once.';
        if (flow.step === 'chaos-target') html = `<div class="prompt-display" style="--flow-accent:${accent}"><h3>${escapeHTML(flow.effect.title)}</h3><p>${escapeHTML(flow.effect.copy)}</p>${targetGridHTML('chaos-target',{exclude:[flow.actorId]})}</div>`;
        else if (flow.step === 'chaos-confirm') html = `<div class="prompt-display" style="--flow-accent:${accent}"><h3>${escapeHTML(flow.effect.title)}</h3><p>${escapeHTML(flow.effect.copy)}</p><div class="prompt-controls"><button class="button button--magenta" data-action="resolve-chaos" type="button">Resolve deterministic effect</button></div></div>`;
        else if (flow.step === 'public-prompt') html = `<div class="prompt-display" style="--flow-accent:${accent}">${promptTags(flow.prompt)}<h3>${escapeHTML(flow.prompt.text)}</h3><p>Group Answer: bots resolve automatically; the active player uses an explicit method.</p>${answerMethodsHTML(flow)}</div>`;
        else if (flow.step.startsWith('answer-')) html = renderAnswerStep(flow,accent);
        else html = resolvedFlowHTML(flow,accent);
      }

      $('#flowDialogTitle').textContent = title;
      $('#flowDialogSubtitle').textContent = subtitle;
      $('#flowDialogBody').innerHTML = html;
      if (!dialog.open) dialog.showModal();
    }

    function renderAnswerStep(flow, accent) {
      const prompt = flow.prompt;
      if (flow.step === 'answer-capturing') return `<div class="prompt-display" style="--flow-accent:${accent}">${promptTags(prompt)}<h3>Explicit voice capture active</h3><p>The game microphone is available for this answer only. This browser demo does not capture real audio.</p><div class="call-orb is-active" style="margin:20px auto">${icon('i-mic')}</div><div class="prompt-controls"><button class="button button--primary" data-action="finish-speak" type="button">Stop and review transcript</button><button class="button" data-action="edit-answer" type="button">Cancel mode</button></div></div>`;
      if (flow.step === 'answer-input') return `<div class="prompt-display" style="--flow-accent:${accent}">${promptTags(prompt)}<h3>${escapeHTML(prompt.text)}</h3><div class="field" style="margin-top:16px"><label for="answerText">Type your answer</label><textarea class="textarea" id="answerText" placeholder="Your explicit answer…">${escapeHTML(flow.answerDraft?.text || '')}</textarea></div><div class="prompt-controls"><button class="button button--primary" data-action="review-typed-answer" type="button">Review answer</button><button class="button" data-action="edit-answer" type="button">Choose another method</button></div></div>`;
      if (flow.step === 'answer-choose') return `<div class="prompt-display" style="--flow-accent:${accent}">${promptTags(prompt)}<h3>${escapeHTML(prompt.text)}</h3><div class="target-grid">${prompt.options.map(option=>`<button class="target-option" data-action="review-choice-answer" data-choice="${escapeHTML(option)}" type="button"><span class="avatar" style="--avatar:var(--gold)">${icon('i-check')}</span><span><b>${escapeHTML(option)}</b></span></button>`).join('')}</div><div class="prompt-controls"><button class="button" data-action="edit-answer" type="button">Choose another method</button></div></div>`;
      if (flow.step === 'answer-live') return `<div class="prompt-display" style="--flow-accent:${accent}">${promptTags(prompt)}<h3>Answered Live</h3><p>Speak to the room, then explicitly confirm completion. The game stores completion only—not what was said.</p><div class="prompt-controls"><button class="button button--magenta" data-action="review-live-answer" type="button">I answered live</button><button class="button" data-action="edit-answer" type="button">Choose another method</button></div></div>`;
      if (flow.step === 'answer-review') {
        const draft = flow.answerDraft || {};
        const display = draft.completionOnly ? 'Completion only — spoken content is not stored.' : draft.choice ? `Choice: ${draft.choice}` : draft.text || 'No content';
        return `<div class="prompt-display" style="--flow-accent:${accent}">${promptTags(prompt)}<h3>Review before submit</h3><div class="review-box"><small>${escapeHTML(draft.method || 'answer')}</small><p>${escapeHTML(display)}</p></div><div class="prompt-controls"><button class="button button--primary" data-action="submit-answer" type="button">Submit answer</button><button class="button" data-action="edit-answer" type="button">Edit / choose method</button></div></div>`;
      }
      return '';
    }

    function resolvedFlowHTML(flow, accent) {
      const prompt = flow.prompt;
      const author = prompt ? promptAuthorLabel(prompt,true) : '';
      return `<div class="prompt-display" style="--flow-accent:${accent}">${prompt ? promptTags(prompt,{resolved:true}) : ''}<h3>${escapeHTML(flow.step === 'passed' ? 'Turn passed' : flow.outcome || 'Effect resolved')}</h3><p>${prompt && prompt.authorship === 'reveal' ? escapeHTML(`Submitted by ${prompt.author} — revealed only after resolution.`) : prompt && prompt.authorship === 'taboo' ? 'Taboo authorship remains hidden from every player.' : escapeHTML(author)}</p><div class="prompt-controls"><button class="button button--primary" data-action="complete-flow" type="button">Continue to win check</button></div></div>`;
    }

    const ROOM_CATEGORIES = ['Truth','Dare','Paranoia','Duel','Icebreakers','Funny','Friends','Couples','Dorm','Party','Bold','Clean','Movies','School','Work','Travel','Creativity','Most Likely To'];
    const BOARD_TABS = [
      ['all','Discover All'],['original','Cribbit Originals'],['community','Community CHAOS'],['trending','Trending'],['saved','Most Saved'],['new','New'],['staff','Staff Pick'],['legendary','Legendary']
    ];

    function promptAccent(prompt) {
      return prompt.type === 'truth' ? 'var(--lime)' : prompt.type === 'dare' ? 'var(--orange)' : prompt.type === 'paranoia' ? 'var(--purple)' : prompt.type === 'duel' ? 'var(--cyan)' : prompt.type === 'nope' ? 'var(--gold)' : 'var(--magenta)';
    }

    function promptTone(prompt) {
      return prompt.type === 'truth' ? 'lime' : prompt.type === 'dare' ? 'orange' : prompt.type === 'paranoia' ? 'purple' : prompt.type === 'duel' ? 'cyan' : prompt.type === 'nope' ? 'gold' : 'magenta';
    }

    function boardPromptHTML(prompt) {
      const inMy = state.mySaved.has(prompt.id);
      const inRoom = state.ecosystem.liveRoomPool.has(prompt.id);
      const official = prompt.source === 'original';
      const sourceLabel = official ? 'CRIBBIT ORIGINAL ✓' : 'COMMUNITY CHAOS 🔥';
      const sourceColor = official ? 'var(--lime)' : 'var(--magenta)';
      return `<article class="prompt-card" style="--prompt-accent:${promptAccent(prompt)}"><div class="prompt-card__top"><span class="tag" data-tone="${promptTone(prompt)}">${escapeHTML(prompt.type)}</span><span class="content-badge" style="--badge-color:${sourceColor}">${sourceLabel}</span></div><h3>${escapeHTML(prompt.text)}</h3><div class="prompt-card__meta"><span class="tag">${escapeHTML(prompt.category || 'Friends')}</span><span class="tag">${escapeHTML(prompt.world)}</span><span class="tag">${prompt.minPlayers || 2}–${prompt.maxPlayers || 10} players</span></div><div class="prompt-card__signals"><span>★ ${Number(prompt.saved || 0).toLocaleString()} saved</span><span>🔥 ${Number(prompt.plays || 0).toLocaleString()} plays</span>${prompt.staffPick?'<span>✓ Staff Pick</span>':''}${prompt.legendary?'<span>♛ Legendary</span>':''}</div><div class="prompt-card__actions prompt-card__actions--three"><button class="button" data-action="save-prompt" data-prompt-id="${prompt.id}" data-destination="my" type="button" ${inMy?'disabled':''}>${inMy?'Saved':'♡ Save'}</button><button class="button" data-action="add-to-room" data-prompt-id="${prompt.id}" type="button" ${inRoom?'disabled':''}>${inRoom?'In Room':'+ Add to Room'}</button><button class="button" data-action="prompt-detail" data-prompt-id="${prompt.id}" type="button">Details</button></div></article>`;
    }

    function renderBoard() {
      const search = state.promptSearch.trim().toLowerCase();
      const world = state.session?.world || state.setup.world;
      let filtered = state.prompts.filter(prompt => {
        if (!prompt.approved || prompt.world !== world) return false;
        if (!['original','community'].includes(prompt.source)) return false;
        if (state.currentFilter !== 'all' && prompt.type !== state.currentFilter) return false;
        if (search && !`${prompt.text} ${prompt.source} ${prompt.author} ${prompt.category} ${(prompt.tags||[]).join(' ')}`.toLowerCase().includes(search)) return false;
        const tab = state.ecosystem.boardTab;
        if (tab === 'original' && prompt.source !== 'original') return false;
        if (tab === 'community' && prompt.source !== 'community') return false;
        if (tab === 'staff' && !prompt.staffPick) return false;
        if (tab === 'legendary' && !prompt.legendary) return false;
        return true;
      });
      if (state.ecosystem.boardTab === 'trending') filtered.sort((a,b)=>(b.plays+b.saved)-(a.plays+a.saved));
      if (state.ecosystem.boardTab === 'saved') filtered.sort((a,b)=>b.saved-a.saved);
      if (state.ecosystem.boardTab === 'new') filtered.sort((a,b)=>b.createdAt-a.createdAt);
      $('#boardTabs').innerHTML = BOARD_TABS.map(([id,label])=>`<button class="seg-button" data-board-tab="${id}" aria-pressed="${state.ecosystem.boardTab===id}" type="button">${label}</button>`).join('');
      $('#boardResultMeta').textContent = `${filtered.length} ${world === 'clean' ? 'Clean' : 'Adult'} prompt${filtered.length === 1 ? '' : 's'} · official and approved community content.`;
      $('#promptList').innerHTML = filtered.map(boardPromptHTML).join('') || `<div class="empty-state">${icon('i-search')}<h3>No matching prompts</h3><p>Change the discovery tab, family filter, search text or content world.</p></div>`;
      $$('#familyFilters .chip-button').forEach(button => button.setAttribute('aria-pressed', String(button.dataset.filter === state.currentFilter)));
    }

    function roomEligiblePrompts() {
      const world = state.session?.world || state.setup.world;
      const categories = state.ecosystem.roomCategories;
      return state.prompts.filter(prompt => prompt.approved && prompt.world === world && (categories.has(prompt.category) || categories.has(prompt.type[0].toUpperCase()+prompt.type.slice(1))) && Boolean(state.setup.sources[prompt.source] ?? (prompt.source === 'community')));
    }

    function renderRooms() {
      const weights = state.ecosystem.roomWeights;
      for (const source of ['Original','Community','House','Live']) {
        const key = source.toLowerCase();
        const input = $(`#roomWeight${source}`);
        const output = $(`#roomWeight${source}Value`);
        if (input) input.value = String(weights[key]);
        if (output) output.textContent = `${weights[key]}%`;
      }
      const total = Object.values(weights).reduce((sum,value)=>sum+Number(value),0);
      $('#roomMixTotal').textContent = `${total}%`;
      $('#roomMixTotal').style.color = total === 100 ? 'var(--lime)' : 'var(--orange)';
      const world = state.session?.world || state.setup.world;
      const stages = STAGES[world];
      $('#roomVibeStart').innerHTML = stages.map((stage,index)=>`<option value="${index}" ${state.ecosystem.roomVibe.from===index?'selected':''}>${escapeHTML(stage.label)}</option>`).join('');
      $('#roomVibeEnd').innerHTML = stages.map((stage,index)=>`<option value="${index}" ${state.ecosystem.roomVibe.to===index?'selected':''}>${escapeHTML(stage.label)}</option>`).join('');
      $('#roomCategoryGrid').innerHTML = ROOM_CATEGORIES.map(category=>`<button class="category-chip" data-room-category="${escapeHTML(category)}" aria-pressed="${state.ecosystem.roomCategories.has(category)}" type="button">${escapeHTML(category)}</button>`).join('');
      const eligible = roomEligiblePrompts();
      const counts = { original:0,community:0,house:0,live:0 };
      eligible.forEach(prompt=>{ if (counts[prompt.source] != null) counts[prompt.source] += 1; });
      $('#roomMetricOriginal').textContent = counts.original;
      $('#roomMetricCommunity').textContent = counts.community;
      $('#roomMetricHouse').textContent = counts.house;
      $('#roomMetricLive').textContent = counts.live;
      $('#roomPoolMeta').textContent = `${eligible.length} currently eligible prompts · source mix ${total}%`;
      $('#roomPoolPreview').innerHTML = eligible.slice(0,12).map(prompt=>`<article class="room-preview-item" style="--preview:${promptAccent(prompt)}">${icon(FAMILY_META[prompt.type]?.icon || 'i-card')}<span><b>${escapeHTML(prompt.text)}</b><span>${escapeHTML(prompt.source)} · ${escapeHTML(prompt.category || prompt.type)}</span></span><button class="icon-button" data-action="add-to-room" data-prompt-id="${prompt.id}" type="button" aria-label="Add prompt to room" ${state.ecosystem.liveRoomPool.has(prompt.id)?'disabled':''}>${icon('i-check')}</button></article>`).join('') || `<div class="empty-state">${icon('i-cards')}<h3>No eligible prompts</h3><p>Enable a source or category.</p></div>`;
    }

    function libraryPrompts(tab) {
      if (tab === 'my') return [...state.mySaved].map(id=>state.prompts.find(prompt=>prompt.id===id)).filter(Boolean);
      if (tab === 'house') return [...state.houseSaved].map(id=>state.prompts.find(prompt=>prompt.id===id)).filter(Boolean);
      if (tab === 'live') return [...state.ecosystem.liveRoomPool].map(id=>state.prompts.find(prompt=>prompt.id===id)).filter(Boolean);
      if (tab === 'history') return (state.session?.resolvedPrompts || []).map(item=>state.prompts.find(prompt=>prompt.id===item.promptId)).filter(Boolean).reverse();
      return [];
    }

    function renderLibrary() {
      const tabs = [['my','My Saved Deck'],['house','House Deck'],['live','Live Room Pool'],['history','Resolved Moments']];
      $('#libraryTabs').innerHTML = tabs.map(([id,label])=>`<button class="seg-button" data-library-tab="${id}" aria-pressed="${state.ecosystem.libraryTab===id}" type="button">${label}</button>`).join('');
      $('#libraryMetricMy').textContent = state.mySaved.size;
      $('#libraryMetricHouse').textContent = state.houseSaved.size;
      $('#libraryMetricLive').textContent = state.ecosystem.liveRoomPool.size;
      $('#libraryMetricHistory').textContent = state.session?.resolvedPrompts.length || 0;
      const meta = { my:['My Saved Deck','Private favorites for future games.'],house:['House Deck','Private recurring prompts and group lore.'],live:['Live Room Pool','The exact prompts eligible tonight.'],history:['Resolved Moments','Prompts that landed during played sessions.'] }[state.ecosystem.libraryTab];
      $('#libraryPanelTitle').textContent = meta[0];
      $('#libraryPanelCopy').textContent = meta[1];
      const prompts = libraryPrompts(state.ecosystem.libraryTab);
      $('#libraryPageList').innerHTML = prompts.map(prompt=>`<article class="library-prompt-card" style="border-color:color-mix(in srgb,${promptAccent(prompt)} 32%,var(--line))"><div class="prompt-card__top"><span class="tag" data-tone="${promptTone(prompt)}">${escapeHTML(prompt.type)}</span><span class="tag">${escapeHTML(prompt.source)}</span></div><h3>${escapeHTML(prompt.text)}</h3><p>${escapeHTML(prompt.category || 'Friends')} · ${escapeHTML(prompt.world)} · ${prompt.minPlayers || 2}–${prompt.maxPlayers || 10} players</p><div class="library-prompt-card__actions">${state.ecosystem.libraryTab!=='live'?`<button class="button" data-action="add-to-room" data-prompt-id="${prompt.id}" type="button" ${state.ecosystem.liveRoomPool.has(prompt.id)?'disabled':''}>${state.ecosystem.liveRoomPool.has(prompt.id)?'In Room':'Add to Room'}</button>`:`<button class="button" data-action="remove-from-room" data-prompt-id="${prompt.id}" type="button">Remove</button>`}<button class="button" data-action="prompt-detail" data-prompt-id="${prompt.id}" type="button">Details</button></div></article>`).join('') || `<div class="empty-state">${icon('i-bookmark')}<h3>${escapeHTML(meta[0])} is empty</h3><p>Browse the CHAOS Board or create a prompt.</p></div>`;
    }

    function destinationMeta(destination) {
      return {
        my:{label:'My Saved Deck',color:'var(--cyan)',copy:'This prompt will be saved instantly and privately to My Saved Deck.'},
        house:{label:'House Deck',color:'var(--orange)',copy:'This prompt will be stored privately for the recurring room or household.'},
        live:{label:'Current Game',color:'var(--lime)',copy:'This prompt will be moderated for tonight and, if accepted, enter the sealed Live Room Pool.'},
        community:{label:'Suggest to CHAOS Board',color:'var(--magenta)',copy:'This prompt will enter moderation, duplicate and quality checks before Community CHAOS approval.'}
      }[destination];
    }

    function renderCreate() {
      const destination = state.ecosystem.createDestination;
      const meta = destinationMeta(destination);
      $$('#destinationGrid [data-create-destination]').forEach(button=>button.setAttribute('aria-pressed',String(button.dataset.createDestination===destination)));
      $('#createDestinationSummary').textContent = meta.copy;
      $('#createDestinationSummary').style.setProperty('--destination',meta.color);
      $('#currentDestinationLabel').textContent = `Destination: ${meta.label}`;
      $('#communityFields').hidden = destination !== 'community';
      $('#promptWorld').value = state.session?.world || state.setup.world;
      const stages = STAGES[$('#promptWorld').value];
      $('#promptIntensity').innerHTML = stages.map((stage,index)=>`<option value="${index}">${escapeHTML(stage.label)}</option>`).join('');
      const submissions = state.ecosystem.submissions;
      $('#submissionList').innerHTML = submissions.length ? submissions.map(sub=>{ const stepIndex={submitted:0,automated:1,duplicate:2,quality:3,approved:4,rejected:4}[sub.status] ?? 0; return `<article class="submission-item" style="--submission:${sub.status==='approved'?'var(--lime)':sub.status==='rejected'?'var(--red)':'var(--magenta)'}"><div class="submission-item__top"><span class="tag" data-tone="${sub.status==='approved'?'lime':sub.status==='rejected'?'magenta':'orange'}">${escapeHTML(sub.status)}</span><button class="button button--sm" data-action="advance-submission" data-submission-id="${sub.id}" type="button" ${['approved','rejected'].includes(sub.status)?'disabled':''}>Run next check</button></div><p>${escapeHTML(sub.text)}</p><div class="submission-stepper">${[0,1,2,3,4].map(i=>`<span class="submission-step${i<=stepIndex?' is-complete':''}"></span>`).join('')}</div></article>`; }).join('') : `<div class="empty-state">${icon('i-send')}<h3>No global submissions</h3><p>Choose Suggest to CHAOS Board to test the moderation pipeline.</p></div>`;
    }

    function renderCallMode() {
      const session = state.session;
      const roster = $('#callRoster');
      if (!roster) return;
      if (!session) {
        $('#callRosterMeta').textContent = 'Start a session to populate the roster.';
        roster.innerHTML = `<div class="empty-state">${icon('i-users')}<h3>No active call</h3></div>`;
        $('#callStateCopy').textContent = 'No active social prompt. Return to the Lobby and start a session.';
        $('#callPrompt').innerHTML = '<small>Prompt</small><h3>No active prompt</h3>';
        return;
      }
      $('#callRosterMeta').textContent = `${session.players.length} participants · ${session.roomName}`;
      roster.innerHTML = session.players.map(player => `<div class="call-person${player.id === currentPlayer().id ? ' is-current' : ''}"><span class="avatar" style="--avatar:${player.color}">${escapeHTML(player.name[0])}</span><b>${escapeHTML(player.name)}</b><span>${player.id === currentPlayer().id ? 'Your turn' : 'In call'}</span></div>`).join('');
      const flow = state.flow;
      const hasPrompt = flow?.prompt && ['public-prompt','answer-capturing','answer-input','answer-choose','answer-live','answer-review','duel-active'].includes(flow.step);
      $('#callStateCopy').textContent = hasPrompt ? 'An explicit answer path is active. Passive call conversation is still ignored.' : 'No active public prompt. Play a social card in the Game view to test the answer engine.';
      $('#callPrompt').innerHTML = hasPrompt ? `<small>${escapeHTML(flow.family || flow.type)} prompt</small><h3>${escapeHTML(flow.prompt.text)}</h3>` : '<small>Prompt</small><h3>No active prompt</h3>';
      $('#callOrb').classList.toggle('is-active', flow?.step === 'answer-capturing');
      $$('[data-call-mode]').forEach(button => {
        button.disabled = !hasPrompt || flow.step !== 'public-prompt' && flow.step !== 'duel-active';
      });
    }

    function renderLab() {
      const session = state.session;
      const table = $('#stateTable');
      if (!table) return;
      if (!session) {
        table.innerHTML = `<tr><th>Field</th><th>Authoritative value</th></tr><tr><td>Session</td><td>Not started</td></tr><tr><td>Revision</td><td>${state.revision}</td></tr><tr><td>Connection</td><td>${state.connection}</td></tr>`;
        return;
      }
      const rows = [
        ['Session ID',session.id],['Mode',MODES[session.mode].label],['World',session.world],['Phase',session.phase],['Current player',currentPlayer()?.name],['Direction',session.direction],['Active color',session.activeColor],['Active symbol',session.activeSymbol],['Stage',STAGES[session.world][session.stage]?.label],['Deck / discard',`${session.deck.length} / ${session.discard.length}`],['Winner',session.winnerId ? findPlayer(session.winnerId)?.name : 'None'],['Flow',state.flow ? `${state.flow.type} / ${state.flow.step}` : 'None'],['Revision',state.revision],['Connection',state.connection]
      ];
      table.innerHTML = `<tr><th>Field</th><th>Authoritative value</th></tr>${rows.map(([field,value])=>`<tr><td>${escapeHTML(field)}</td><td>${escapeHTML(value)}</td></tr>`).join('')}`;
    }

    function renderRecap() {
      const session = state.session;
      if (!session || !session.winnerId) {
        $('#champPanel').innerHTML = `<div class="empty-state">${icon('i-trophy')}<h3>No winner yet</h3><p>The first player to legally empty their hand becomes CHAOS Champ.</p></div>`;
        $('#saveThatList').innerHTML = '';
        return;
      }
      const winner = findPlayer(session.winnerId);
      const totalTruths = session.players.reduce((sum,p)=>sum+p.stats.truths,0);
      const totalDares = session.players.reduce((sum,p)=>sum+p.stats.dares,0);
      const totalDuels = session.players.reduce((sum,p)=>sum+p.stats.duels,0);
      $('#champPanel').innerHTML = `${icon('i-trophy').replace('class="icon"','class="champ-crown icon"')}<h2><span>Chaos Champ</span>${escapeHTML(winner.name)}</h2><p>First player to legally reach zero cards. Points and social stats remain recap flavor only.</p><div class="recap-stats"><div class="recap-stat"><span>Cards played</span><b>${winner.stats.cardsPlayed}</b></div><div class="recap-stat"><span>Truths</span><b>${totalTruths}</b></div><div class="recap-stat"><span>Dares</span><b>${totalDares}</b></div><div class="recap-stat"><span>Duels</span><b>${totalDuels}</b></div><div class="recap-stat"><span>Nopes</span><b>${session.stats.nopes}</b></div><div class="recap-stat"><span>Rounds</span><b>${session.round}</b></div></div>`;
      const resolved = session.resolvedPrompts.slice(-8).reverse();
      $('#saveThatList').innerHTML = resolved.length ? resolved.map(item => {
        const prompt = state.prompts.find(p=>p.id===item.promptId);
        if (!prompt) return '';
        return `<article class="save-item"><div class="save-item__top"><span class="tag" data-tone="${prompt.type === 'truth'?'lime':prompt.type === 'dare'?'orange':'purple'}">${escapeHTML(prompt.type)}</span><span class="tag">${escapeHTML(prompt.source)}</span></div><h3>${escapeHTML(prompt.text)}</h3><p>Resolved during this session · ${escapeHTML(prompt.authorship === 'taboo' ? 'Taboo author remains hidden' : promptAuthorLabel(prompt,true))}</p><div class="save-item__actions"><button class="button" data-action="save-prompt" data-prompt-id="${prompt.id}" data-destination="my" type="button" ${state.mySaved.has(prompt.id)?'disabled':''}>My Saved Deck</button><button class="button" data-action="save-prompt" data-prompt-id="${prompt.id}" data-destination="house" type="button" ${state.houseSaved.has(prompt.id)?'disabled':''}>House Deck</button><button class="button" data-action="save-prompt" data-prompt-id="${prompt.id}" data-destination="community" type="button">Suggest to Board</button></div></article>`;
      }).join('') : `<div class="empty-state">${icon('i-bookmark')}<h3>No resolved prompts</h3><p>Play social cards to populate Save That.</p></div>`;
    }

    function renderReconnectDialog() {
      const dialog = $('#reconnectDialog');
      if (!dialog || !state.session) return;
      if (state.connection === 'CONNECTED') { if (dialog.open) dialog.close(); return; }
      const remaining = state.reconnectDeadline ? Math.max(0,Math.ceil((state.reconnectDeadline-Date.now())/1000)) : 0;
      $('#reconnectBody').innerHTML = `<div class="reconnect-steps"><span class="reconnect-step">Connected</span><span>→</span><span class="reconnect-step is-active">Lost</span><span>→</span><span class="reconnect-step is-active">Grace window</span><span>→</span><span class="reconnect-step">Resume / timed out</span></div><div class="authority-box"><b>Server snapshot held</b><p>Current player: ${escapeHTML(currentPlayer()?.name)} · phase: ${escapeHTML(state.session.phase)} · revision: ${state.revision}. Local UI does not invent a missing turn.</p></div><div style="text-align:center;margin-top:18px"><div class="reaction-count">${remaining}</div><p class="view-lead" style="font-size:12px">${state.connection === 'TIMED_OUT' ? 'The grace window expired. The table remains authoritative and can still resync for this demo.' : 'Reconnect before the grace window expires.'}</p><button class="button button--primary" data-action="reconnect-now" type="button">Restore authoritative snapshot</button></div>`;
      if (!dialog.open) dialog.showModal();
    }

    function startRouletteSpin() {
      const flow = state.flow;
      if (!flow || flow.type !== 'social' || flow.step !== 'roulette-ready') return;
      flow.step = 'roulette-spinning';
      flow.rouletteRotation = 1440 + ((state.revision + state.session.completedTurns) % 8) * 45;
      addEvent('ROULETTE_ANIMATION_STARTED', 'Wheel animation visualizes the server-selected prompt; it does not decide the result.', 'purple');
      renderAll();
      setTimeout(() => {
        if (state.flow === flow && flow.step === 'roulette-spinning') serverCommand('REVEAL_PROMPT', {}, { key:`reveal-${flow.cardId}-${flow.serverSelectedAt}` });
      }, 1700);
    }

    function editAnswerMode() {
      const flow = state.flow;
      if (!flow) return;
      flow.answerState = 'WAITING_FOR_PLAYER';
      flow.answerMode = null;
      flow.answerDraft = null;
      if (flow.type === 'duel') flow.step = 'duel-active';
      else flow.step = 'public-prompt';
      state.revision += 1;
      addEvent('ANSWER_EDITED', 'Answer mode returned to explicit selection before submission.', 'cyan');
      renderAll();
    }

    function setMode(modeId) {
      if (!MODES[modeId]) return;
      state.setup.mode = modeId;
      state.setup.playerCount = MODES[modeId].defaultPlayers;
      renderSetup();
    }

    function resetDemo() {
      if (!confirm('Reset the playable demo and clear the current local session?')) return;
      location.reload();
    }

    document.addEventListener('click', event => {
      const nav = event.target.closest('[data-nav]');
      if (nav) {
        event.preventDefault();
        if (nav.dataset.boardTab) state.ecosystem.boardTab = nav.dataset.boardTab;
        if (nav.dataset.libraryTab) state.ecosystem.libraryTab = nav.dataset.libraryTab;
        if (nav.dataset.createDestination) state.ecosystem.createDestination = nav.dataset.createDestination;
        nav.closest('dialog[open]')?.close();
        showView(nav.dataset.nav);
        if (nav.dataset.nav === 'game') document.activeElement?.blur();
        if (nav.dataset.roomAnchor) requestAnimationFrame(() => document.getElementById(nav.dataset.roomAnchor)?.scrollIntoView({ block:'start', behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' }));
        return;
      }
      const boardTabButton = event.target.closest('[data-board-tab]');
      if (boardTabButton) {
        state.ecosystem.boardTab = boardTabButton.dataset.boardTab;
        if (state.view !== 'board') showView('board'); else renderBoard();
        return;
      }
      const libraryTabButton = event.target.closest('[data-library-tab]');
      if (libraryTabButton) {
        state.ecosystem.libraryTab = libraryTabButton.dataset.libraryTab;
        if (state.view !== 'library') showView('library'); else renderLibrary();
        return;
      }
      const destinationButton = event.target.closest('[data-create-destination]');
      if (destinationButton) {
        state.ecosystem.createDestination = destinationButton.dataset.createDestination;
        if (state.view !== 'create') showView('create'); else renderCreate();
        return;
      }
      const categoryButton = event.target.closest('[data-room-category]');
      if (categoryButton) {
        const category = categoryButton.dataset.roomCategory;
        if (state.ecosystem.roomCategories.has(category)) state.ecosystem.roomCategories.delete(category); else state.ecosystem.roomCategories.add(category);
        if (!state.ecosystem.roomCategories.size) state.ecosystem.roomCategories.add('Truth');
        renderRooms();
        return;
      }
      const modeButton = event.target.closest('.mode-card[data-mode]');
      if (modeButton) return setMode(modeButton.dataset.mode);
      const sourceButton = event.target.closest('[data-source]');
      if (sourceButton) {
        const source = sourceButton.dataset.source;
        state.setup.sources[source] = !state.setup.sources[source];
        if (!Object.values(state.setup.sources).some(Boolean)) state.setup.sources.original = true;
        renderSetup();
        return;
      }
      const filterButton = event.target.closest('[data-filter]');
      if (filterButton) {
        state.currentFilter = filterButton.dataset.filter;
        renderBoard();
        return;
      }
      const closeDialog = event.target.closest('[data-close-dialog]');
      if (closeDialog) {
        $(`#${closeDialog.dataset.closeDialog}`)?.close();
        return;
      }
      const actionButton = event.target.closest('[data-action]');
      if (!actionButton) return;
      const action = actionButton.dataset.action;
      if (action === 'toggle-left-rail') return toggleGameRail('left');
      if (action === 'toggle-right-rail') return toggleGameRail('right');
      if (action === 'toggle-focus-mode') return toggleFocusMode();
      if (action === 'toggle-fullscreen') return toggleFullscreenMode();
      if (action === 'close-rail-drawers') return closeRailDrawers();
      if (action === 'simulate-disconnect') return simulateDisconnect();
      if (action === 'reset-demo') return resetDemo();
      if (action === 'cycle-fixture') return cycleVisualFixture();
      if (action === 'reconnect-now') return reconnectNow();
      if (action === 'join-room') {
        const code = ($('#joinCode')?.value || '').trim().toUpperCase();
        if (!/^[A-Z0-9]{4,8}$/.test(code)) return toast('Invalid room code', 'Use 4-8 letters or numbers for the simulated join flow.', 'orange');
        state.setup.roomName = `Room ${code}`;
        $('#roomName').value = state.setup.roomName;
        toast('Lobby joined', `${state.setup.profileName || 'You'} joined simulated room ${code}.`, 'lime');
        addEvent('LOBBY_JOINED', `Simulated room code ${code} loaded without changing canonical game rules.`, 'lime');
        return;
      }
      if (action === 'open-mobile-nav') { $('#mobileNavDialog').showModal(); return; }
      if (action === 'open-global-search') { renderGlobalSearch(''); $('#searchDialog').showModal(); setTimeout(()=>$('#globalSearchInput')?.focus(),50); return; }
      if (action === 'open-notifications') { renderNotifications(); $('#notificationsDialog').showModal(); return; }
      if (action === 'open-profile') { $('#profileDialogName').value=state.setup.profileName; $('#profileDialogWorld').value=state.setup.world; $('#profileDialog').showModal(); return; }
      if (action === 'save-profile') { state.setup.profileName=$('#profileDialogName').value.trim()||'You'; state.setup.world=$('#profileDialogWorld').value; $('#profileName').value=state.setup.profileName; $('#profileDialog').close(); renderAll(); toast('Profile updated','Personal settings applied to future eligibility checks.','lime'); return; }
      if (action === 'toggle-activity') { state.ecosystem.activityOpen=!state.ecosystem.activityOpen; const dock=$('#activityDock'); if(dock){dock.dataset.open=String(state.ecosystem.activityOpen); actionButton.textContent=state.ecosystem.activityOpen?'Collapse':'Expand';} return; }
      if (action === 'apply-room-config') { const total=Object.values(state.ecosystem.roomWeights).reduce((a,b)=>a+Number(b),0); if(total!==100) return toast('Source mix must equal 100%','Adjust the four source weights before applying the room.','orange'); toast('Room setup applied',`${roomEligiblePrompts().length} prompts are currently eligible for tonight.`,'lime'); addEvent('ROOM_CONFIG_APPLIED','Host applied vibe, category and source-mix settings.','lime'); renderAll(); return; }
      if (action === 'add-to-room') return serverCommand('ADD_TO_ROOM_POOL',{promptId:actionButton.dataset.promptId});
      if (action === 'remove-from-room') return serverCommand('REMOVE_FROM_ROOM_POOL',{promptId:actionButton.dataset.promptId});
      if (action === 'advance-submission') return serverCommand('ADVANCE_SUBMISSION',{submissionId:actionButton.dataset.submissionId});
      if (action === 'prompt-detail') { const prompt=state.prompts.find(item=>item.id===actionButton.dataset.promptId); if(!prompt)return; $('#cardDialogBody').innerHTML=`<div class="prompt-display" style="--flow-accent:${promptAccent(prompt)}"><div class="prompt-display__meta"><span class="tag" data-tone="${promptTone(prompt)}">${escapeHTML(prompt.type)}</span><span class="tag">${escapeHTML(prompt.source)}</span><span class="tag">${escapeHTML(prompt.category||'Friends')}</span></div><h3>${escapeHTML(prompt.text)}</h3><p>${escapeHTML(promptAuthorLabel(prompt,false))} · ${prompt.minPlayers||2}–${prompt.maxPlayers||10} players · ${Number(prompt.saved||0).toLocaleString()} saves · ${Number(prompt.plays||0).toLocaleString()} plays</p></div>`; $('#cardDialog').showModal(); return; }
      if (action === 'draw-card') return serverCommand('DRAW_CARD');
      if (action === 'play-card') {
        if (actionButton.getAttribute('aria-disabled') === 'true') return toast('Illegal card', 'Client hint says this card does not match; the server would reject it.', 'orange');
        return animateCardCommit(actionButton, () => serverCommand('PLAY_CARD', { cardId:actionButton.dataset.cardId }));
      }
      if (action === 'card-detail') return openCardDetail(actionButton.dataset.cardId);
      if (action === 'choose-wild') return serverCommand('CHOOSE_WILD', { color:actionButton.dataset.color });
      if (action === 'spin-roulette') return startRouletteSpin();
      if (action === 'publish-prompt') return serverCommand('PUBLISH_PROMPT');
      if (action === 'answer-mode') return serverCommand('SELECT_ANSWER_MODE', { mode:actionButton.dataset.mode });
      if (action === 'finish-speak') return serverCommand('REVIEW_ANSWER', { value:'Demo voice transcript — editable before submission.' });
      if (action === 'review-typed-answer') return serverCommand('REVIEW_ANSWER', { value:$('#answerText')?.value || '' });
      if (action === 'review-choice-answer') return serverCommand('REVIEW_ANSWER', { choice:actionButton.dataset.choice });
      if (action === 'review-live-answer') return serverCommand('REVIEW_ANSWER', { completionOnly:true });
      if (action === 'submit-answer') return serverCommand('SUBMIT_ANSWER');
      if (action === 'edit-answer') return editAnswerMode();
      if (action === 'complete-flow') return serverCommand('COMPLETE_FLOW');
      if (action === 'safety-pass') {
        if (!state.flow) return toast('Pass is a prompt control', 'No prompt is currently directed at you.', 'cyan');
        return serverCommand('PASS_PROMPT');
      }
      if (action === 'safety-rewind') {
        if (!state.flow) return toast('Rewind is private', 'Rewind appears only on a Truth/Dare before public reveal.', 'cyan');
        return serverCommand('REWIND_PROMPT');
      }
      if (action === 'safety-flag') {
        if (!state.flow?.prompt) return toast('Flag is moderation', 'No displayed prompt is available to report.', 'magenta');
        return serverCommand('FLAG_PROMPT');
      }
      if (action === 'use-nope') {
        if (state.flow?.type === 'reaction') return serverCommand('NOPE_REACTION', { useNope:true });
        return toast('No reaction window', 'Nope is playable only when held and an eligible effect opens a reaction window.', 'gold');
      }
      if (action === 'nope-reaction') return serverCommand('NOPE_REACTION', { useNope:actionButton.dataset.use === 'true' });
      if (action === 'paranoia-choice') return serverCommand('PARANOIA_CHOICE', { targetId:actionButton.dataset.targetId });
      if (action === 'duel-target') return serverCommand('DUEL_TARGET', { targetId:actionButton.dataset.targetId });
      if (action === 'duel-vote') return serverCommand('DUEL_VOTE', { winnerId:actionButton.dataset.winnerId });
      if (action === 'chaos-target') return serverCommand('CHAOS_TARGET', { targetId:actionButton.dataset.targetId });
      if (action === 'resolve-chaos') {
        resolveChaosConfirm();
        state.revision += 1;
        renderAll();
        return;
      }
      if (action === 'save-prompt') return serverCommand('SAVE_PROMPT', { promptId:actionButton.dataset.promptId, destination:actionButton.dataset.destination || 'my' });
      if (action === 'focus-create-prompt') return $('#createPromptPanel')?.scrollIntoView({ behavior:'smooth', block:'center' });
      if (action === 'lab-add-card') return serverCommand('LAB_ADD_CARD', { kind:$('#labCardSelect').value });
      if (action === 'lab-one-card') return serverCommand('LAB_ONE_CARD');
      if (action === 'lab-human-turn') return serverCommand('LAB_HUMAN_TURN');
      if (action === 'lab-trigger-draw') return serverCommand('LAB_TRIGGER_DRAW');
      if (action === 'lab-queue-chaos') {
        const current = state.nextChaosEffect;
        const index = current ? (DEMO_CHAOS_EFFECTS.findIndex(item=>item.id===current.id)+1)%DEMO_CHAOS_EFFECTS.length : 0;
        state.nextChaosEffect = DEMO_CHAOS_EFFECTS[index];
        toast('Chaos effect queued', `${state.nextChaosEffect.title} will be selected by the next Chaos card.`, 'magenta');
        renderLab();
        return;
      }
      if (action === 'retry-last-command') {
        const last = state.lastHumanCommand;
        if (!last) return toast('Nothing to retry', 'Perform a mutating action first.', 'orange');
        return serverCommand(last.type, structuredClone(last.payload), { key:last.key });
      }
      if (action === 'force-recap') return serverCommand('FORCE_RECAP');
      if (action === 'clear-log') { state.events=[]; renderEvents(); return; }
      if (action === 'flow-close-request') return toast('Resolution required', 'The active authoritative flow cannot be dismissed. Resolve, Pass, Rewind or Flag as available.', 'orange');
      if (action === 'play-again') {
        state.session = null; state.flow = null; clearTimeout(state.botTimer); showView('lobby'); renderAll(); return;
      }
      if (action === 'share-recap') {
        const winner = state.session?.winnerId ? findPlayer(state.session.winnerId)?.name : 'CHAOS Champ';
        const text = `${winner} won ${state.session?.roomName || 'Cribbit CHAOS'} by emptying their hand.`;
        navigator.clipboard?.writeText(text).then(()=>toast('Recap copied', 'Sharing remains voluntary.', 'lime')).catch(()=>toast('Share recap', text, 'lime'));
        return;
      }
    });



    document.addEventListener('keydown', event => {
      if (state.view !== 'game') return;
      const editable = event.target.closest('input, textarea, select, [contenteditable="true"]');
      if (editable || document.querySelector('dialog[open]')) return;
      if (event.key === '[') { event.preventDefault(); toggleGameRail('left'); }
      if (event.key === ']') { event.preventDefault(); toggleGameRail('right'); }
      if (event.key.toLowerCase() === 'f') { event.preventDefault(); toggleFocusMode(); }
      if (event.key === 'Escape' && layoutState.mode !== 'inline' && (layoutState.leftOpen || layoutState.rightOpen)) {
        event.preventDefault(); closeRailDrawers();
      }
    });

    document.addEventListener('submit', event => {
      if (event.target.id !== 'ecosystemPromptForm') return;
      event.preventDefault();
      const result = serverCommand('CREATE_PROMPT', {
        destination:state.ecosystem.createDestination,
        type:$('#promptType').value,
        text:$('#promptText').value,
        authorship:$('#promptAuthorship').value,
        targeting:$('#promptTargeting').value,
        category:$('#promptCategory').value,
        world:$('#promptWorld').value,
        stage:Number($('#promptIntensity').value),
        minPlayers:Number($('#promptMinPlayers').value),
        maxPlayers:Number($('#promptMaxPlayers').value),
        tags:$('#promptTags').value,
        attribution:$('#promptAttribution').value
      });
      if (result.ok) { event.target.reset(); renderCreate(); renderBoard(); renderLibrary(); renderRooms(); }
    });

    $('#startGameButton').addEventListener('click', () => serverCommand('START_GAME'));
    $('#playerCount').addEventListener('input', event => { state.setup.playerCount=Number(event.target.value); $('#playerCountValue').textContent=event.target.value; });
    $('#worldSelect').addEventListener('change', event => { state.setup.world=event.target.value; state.setup.ceiling=CEILINGS[state.setup.world].at(-1).value; renderCeilingOptions(); renderBoard(); });
    $('#ceilingSelect').addEventListener('change', event => { state.setup.ceiling=Number(event.target.value); });
    $('#promptSearch').addEventListener('input', event => { state.promptSearch=event.target.value; renderBoard(); });
    $$('[id^="knob"]').forEach(control => control.addEventListener('change', () => { updateKnobsFromInputs(); renderAll(); }));
    ['Original','Community','House','Live'].forEach(source => {
      const input = $(`#roomWeight${source}`);
      input?.addEventListener('input', event => { state.ecosystem.roomWeights[source.toLowerCase()] = Number(event.target.value); renderRooms(); });
    });
    $('#roomVibeStart')?.addEventListener('change', event => { state.ecosystem.roomVibe.from=Number(event.target.value); renderRooms(); });
    $('#roomVibeEnd')?.addEventListener('change', event => { state.ecosystem.roomVibe.to=Number(event.target.value); renderRooms(); });
    $('#promptWorld')?.addEventListener('change', () => renderCreate());
    $('#globalSearchInput')?.addEventListener('input', event => renderGlobalSearch(event.target.value));
    $$('[data-call-mode]').forEach(button => button.addEventListener('click', () => {
      if (!state.flow) return toast('No active prompt', 'Play a social card before choosing a Call Mode answer path.', 'orange');
      serverCommand('SELECT_ANSWER_MODE', { mode:button.dataset.callMode });
      showView('game');
    }));

    $('#flowDialog').addEventListener('cancel', event => {
      if (state.flow) { event.preventDefault(); toast('Resolution required', 'The authoritative effect remains active.', 'orange'); }
    });

    function renderGlobalSearch(query='') {
      const q = String(query).trim().toLowerCase();
      const routes = [
        {label:'Lobby',copy:'Create or join a room.',view:'lobby',icon:'i-home',tone:'var(--lime)'},
        {label:'Tonight’s CHAOS',copy:'Configure vibe, categories and source mix.',view:'rooms',icon:'i-users',tone:'var(--orange)'},
        {label:'CHAOS Board',copy:'Browse official and community prompts.',view:'board',icon:'i-globe',tone:'var(--magenta)'},
        {label:'My Saved Deck',copy:'Private favorites.',view:'library',icon:'i-bookmark',tone:'var(--cyan)'},
        {label:'Create Prompt',copy:'Choose a destination first.',view:'create',icon:'i-send',tone:'var(--lime)'},
        {label:'Rules & Lab',copy:'Inspect contracts and balancing knobs.',view:'lab',icon:'i-info',tone:'var(--gold)'}
      ];
      const routeResults = routes.filter(item=>!q || `${item.label} ${item.copy}`.toLowerCase().includes(q));
      const promptResults = state.prompts.filter(prompt=>prompt.approved && (!q || `${prompt.type} ${prompt.text} ${prompt.category} ${prompt.source} ${prompt.tags || ''}`.toLowerCase().includes(q))).slice(0,7);
      $('#globalSearchResults').innerHTML = routeResults.map(item=>`<button class="utility-result" data-nav="${item.view}" type="button" style="--result:${item.tone}">${icon(item.icon)}<span><b>${escapeHTML(item.label)}</b><span>${escapeHTML(item.copy)}</span></span><small>Page</small></button>`).join('') + promptResults.map(prompt=>`<button class="utility-result" data-nav="board" data-board-tab="${prompt.source==='original'?'original':'community'}" type="button" style="--result:${promptAccent(prompt)}">${icon(FAMILY_META[prompt.type]?.icon||'i-card')}<span><b>${escapeHTML(prompt.text)}</b><span>${escapeHTML(prompt.category||prompt.type)} · ${escapeHTML(prompt.source)}</span></span><small>Prompt</small></button>`).join('') || `<div class="empty-state">${icon('i-search')}<h3>No results</h3></div>`;
    }

    function renderNotifications() {
      $('#notificationList').innerHTML = state.ecosystem.notifications.map(note=>`<article class="utility-result" style="--result:var(--${note.tone})">${icon(note.tone==='orange'?'i-home':note.tone==='magenta'?'i-globe':'i-shield')}<span><b>${escapeHTML(note.title)}</b><span>${escapeHTML(note.copy)}</span></span><small>New</small></article>`).join('');
    }

    const VISUAL_FIXTURE_ORDER = ['standard', 'social', 'paranoia', 'duel', 'chaos', 'mobile'];
    const VISUAL_FIXTURE_DURATION_MS = 10 * 60 * 1000;
    const visualWindow = window;

    function setInputValue(id, value) {
      const node = document.getElementById(id) as HTMLInputElement | HTMLSelectElement | null;
      if (!node) return;
      node.value = String(value);
    }

    function setInputChecked(id, checked) {
      const node = document.getElementById(id) as HTMLInputElement | null;
      if (!node) return;
      node.checked = Boolean(checked);
    }

    function syncFixtureBadge() {
      const pill = $('#fixturePill');
      const label = $('#fixtureLabel');
      const fixture = visualWindow.__CRIBBIT_VISUAL_FIXTURE__ || null;
      const meta = visualWindow.__CRIBBIT_VISUAL_FIXTURE_META__ || null;
      if (!pill || !label) return;
      pill.hidden = !fixture;
      if (!fixture) return;
      label.textContent = meta?.label || `${fixture} fixture`;
      pill.title = meta?.summary || 'Fixture / demo preview';
    }

    function fixtureCard(kind, id, options = {}) {
      return createCard(kind, { id, ...options });
    }

    function fixturePrompt(kind, text, { options = [], authorship = 'reveal', source = 'original' } = {}) {
      return {
        id: `fixture-${kind}-${text.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`,
        type: kind,
        text,
        world: 'clean',
        stage: 1,
        source,
        author: 'Cribbit',
        authorship,
        targeting: kind === 'paranoia' || kind === 'duel' ? 'specific' : kind === 'chaos' ? 'all' : 'current',
        options
      };
    }

    function resetFixtureInputs() {
      Object.assign(state.setup, {
        mode: 'party',
        playerCount: 5,
        world: 'clean',
        ceiling: 3,
        sources: { original: true, community: true, house: true, live: true },
        qaHand: true,
        roomName: 'Night Squad',
        profileName: 'You'
      });
      Object.assign(state.knobs, {
        startingHand: 7,
        drawPenalty: 2,
        turnTimer: 40,
        stageEvery: 4,
        voluntaryDraw: false,
        socialAlwaysLegal: true,
        finalSocialWin: 'after',
        nopeContract: 'draw-chaos'
      });
      renderSetup();
      setInputValue('profileName', state.setup.profileName);
      setInputValue('roomName', state.setup.roomName);
      setInputValue('worldSelect', state.setup.world);
      setInputValue('ceilingSelect', state.setup.ceiling);
      setInputValue('playerCount', state.setup.playerCount);
      setInputValue('knobStartingHand', state.knobs.startingHand);
      setInputValue('knobDrawPenalty', state.knobs.drawPenalty);
      setInputValue('knobTurnTimer', state.knobs.turnTimer);
      setInputValue('knobStageEvery', state.knobs.stageEvery);
      setInputChecked('knobVoluntaryDraw', state.knobs.voluntaryDraw);
      setInputChecked('knobSocialAlways', state.knobs.socialAlwaysLegal);
      setInputValue('knobFinalSocial', state.knobs.finalSocialWin);
      setInputValue('knobNopeContract', state.knobs.nopeContract);
    }

    function seedFixtureBoard() {
      const session = state.session;
      if (!session) return;
      session.players[0].hand = [
        fixtureCard('number', 'fixture-human-number', { color: 'lime', value: 2, symbol: '2' }),
        fixtureCard('skip', 'fixture-human-skip', { color: 'orange' }),
        fixtureCard('reverse', 'fixture-human-reverse', { color: 'cyan' }),
        fixtureCard('draw', 'fixture-human-draw', { color: 'purple' }),
        fixtureCard('wild', 'fixture-human-wild', { color: 'lime' }),
        fixtureCard('truth', 'fixture-human-truth'),
        fixtureCard('paranoia', 'fixture-human-paranoia')
      ];
      session.players[1].hand = [fixtureCard('number', 'fixture-bot-1-number', { color: 'orange', value: 4, symbol: '4' }), fixtureCard('nope', 'fixture-bot-1-nope'), fixtureCard('number', 'fixture-bot-1-two', { color: 'cyan', value: 6, symbol: '6' }), fixtureCard('dare', 'fixture-bot-1-dare'), fixtureCard('number', 'fixture-bot-1-three', { color: 'purple', value: 9, symbol: '9' })];
      session.players[2].hand = [fixtureCard('number', 'fixture-bot-2-number', { color: 'purple', value: 1, symbol: '1' }), fixtureCard('duel', 'fixture-bot-2-duel'), fixtureCard('number', 'fixture-bot-2-two', { color: 'lime', value: 8, symbol: '8' }), fixtureCard('number', 'fixture-bot-2-three', { color: 'orange', value: 3, symbol: '3' }), fixtureCard('nope', 'fixture-bot-2-nope')];
      session.players[3].hand = [fixtureCard('number', 'fixture-bot-3-number', { color: 'cyan', value: 5, symbol: '5' }), fixtureCard('chaos', 'fixture-bot-3-chaos'), fixtureCard('number', 'fixture-bot-3-two', { color: 'lime', value: 7, symbol: '7' }), fixtureCard('number', 'fixture-bot-3-three', { color: 'orange', value: 0, symbol: '0' }), fixtureCard('draw', 'fixture-bot-3-draw', { color: 'purple' })];
      session.players[4].hand = [fixtureCard('number', 'fixture-bot-4-number', { color: 'orange', value: 7, symbol: '7' }), fixtureCard('number', 'fixture-bot-4-two', { color: 'cyan', value: 2, symbol: '2' }), fixtureCard('truth', 'fixture-bot-4-truth'), fixtureCard('number', 'fixture-bot-4-three', { color: 'lime', value: 5, symbol: '5' }), fixtureCard('reverse', 'fixture-bot-4-reverse', { color: 'purple' })];
      session.discard = [fixtureCard('number', 'fixture-discard-top', { color: 'lime', value: 7, symbol: '7' }), fixtureCard('skip', 'fixture-discard-under', { color: 'orange' })];
      session.lastDiscardId = session.discard[0].id;
      session.deck = [
        fixtureCard('number', 'fixture-deck-1', { color: 'cyan', value: 8, symbol: '8' }),
        fixtureCard('number', 'fixture-deck-2', { color: 'orange', value: 9, symbol: '9' }),
        fixtureCard('wild', 'fixture-deck-3'),
        fixtureCard('number', 'fixture-deck-4', { color: 'purple', value: 1, symbol: '1' }),
        fixtureCard('truth', 'fixture-deck-5'),
        fixtureCard('dare', 'fixture-deck-6'),
        fixtureCard('paranoia', 'fixture-deck-7'),
        fixtureCard('duel', 'fixture-deck-8'),
        fixtureCard('chaos', 'fixture-deck-9'),
        fixtureCard('nope', 'fixture-deck-10'),
        fixtureCard('draw', 'fixture-deck-11', { color: 'lime' }),
        fixtureCard('reverse', 'fixture-deck-12', { color: 'cyan' }),
        fixtureCard('skip', 'fixture-deck-13', { color: 'orange' }),
        fixtureCard('number', 'fixture-deck-14', { color: 'lime', value: 6, symbol: '6' }),
        fixtureCard('number', 'fixture-deck-15', { color: 'purple', value: 2, symbol: '2' })
      ];
      session.currentIndex = 0;
      session.direction = 1;
      session.phase = 'PLAY_DRAW';
      session.round = 2;
      session.completedTurns = 6;
      session.stage = 1;
      session.activeColor = 'lime';
      session.activeSymbol = '7';
      session.winnerId = null;
      session.pendingWinCandidate = null;
      session.pendingEffect = null;
      session.deadline = Date.now() + VISUAL_FIXTURE_DURATION_MS;
      session.turnStartedAt = Date.now();
      session.stats = { totalPlays: 8, totalDraws: 3, socialResolved: 2, rouletteSpins: 1, flags: 1, passes: 1, rewinds: 1, nopes: 1, duels: 1, chaos: 1 };
      state.flow = null;
      state.reactionDeadline = null;
      clearTimeout(state.botTimer);
      state.botTimer = null;
      state.connection = 'CONNECTED';
      state.reconnectDeadline = null;
    }

    function applyFixtureFlow(fixture) {
      const session = state.session;
      if (!session) return;
      const actor = session.players[0];
      const opponent = session.players[1];
      if (fixture === 'standard' || fixture === 'mobile') return;
      if (fixture === 'social') {
        const card = actor.hand.find(item => item.kind === 'truth') || actor.hand[0];
        state.session.phase = 'ANSWER_RESOLVE';
        state.flow = {
          type: 'social',
          family: 'truth',
          originFamily: 'truth',
          actorId: actor.id,
          targetId: actor.id,
          cardId: card.id,
          prompt: fixturePrompt('truth', 'What is one opinion this room would not guess about you?', { options: ['A hidden talent', 'A guilty pleasure', 'A harmless obsession'], authorship: 'reveal' }),
          step: 'public-prompt',
          answerState: 'WAITING_FOR_PLAYER',
          deadline: Date.now() + VISUAL_FIXTURE_DURATION_MS,
          flags: []
        };
        return;
      }
      if (fixture === 'paranoia') {
        const card = actor.hand.find(item => item.kind === 'paranoia') || actor.hand[0];
        state.session.phase = 'ANSWER_RESOLVE';
        state.flow = {
          type: 'paranoia',
          family: 'paranoia',
          originFamily: 'paranoia',
          actorId: actor.id,
          targetId: actor.id,
          cardId: card.id,
          prompt: fixturePrompt('paranoia', 'Who here would make the best cartoon detective?', { authorship: 'taboo' }),
          step: 'paranoia-choice',
          deadline: Date.now() + VISUAL_FIXTURE_DURATION_MS,
          flags: []
        };
        return;
      }
      if (fixture === 'duel') {
        const card = actor.hand.find(item => item.kind === 'duel') || actor.hand[0];
        state.session.phase = 'ANSWER_RESOLVE';
        state.flow = {
          type: 'duel',
          family: 'duel',
          originFamily: 'duel',
          actorId: actor.id,
          targetId: actor.id,
          opponentId: opponent.id,
          cardId: card.id,
          prompt: fixturePrompt('duel', 'You each have 15 seconds to name as many African countries as possible.', { authorship: 'signed' }),
          step: 'duel-active',
          duelPhase: 'active-answer',
          answerState: 'WAITING_FOR_PLAYER',
          deadline: Date.now() + VISUAL_FIXTURE_DURATION_MS,
          flags: []
        };
        return;
      }
      if (fixture === 'chaos') {
        const card = actor.hand.find(item => item.kind === 'chaos') || actor.hand[0];
        state.session.phase = 'ANSWER_RESOLVE';
        state.flow = {
          type: 'chaos',
          family: 'chaos',
          originFamily: 'chaos',
          actorId: actor.id,
          targetId: actor.id,
          cardId: card.id,
          prompt: fixturePrompt('truth', 'Everyone answers the next eligible question in reverse turn order.', { authorship: 'signed' }),
          effect: { id: 'group-answer', title: 'Group Answer', copy: 'Everyone answers the next eligible question. Bots resolve automatically; the active player uses an explicit answer path.', targeted: false },
          step: 'public-prompt',
          answerState: 'WAITING_FOR_PLAYER',
          deadline: Date.now() + VISUAL_FIXTURE_DURATION_MS,
          flags: []
        };
      }
    }

    function applyVisualFixture(fixture) {
      const validFixture = VISUAL_FIXTURE_ORDER.includes(fixture) ? fixture : null;
      visualWindow.__CRIBBIT_VISUAL_FIXTURE__ = validFixture;
      visualWindow.__CRIBBIT_VISUAL_FIXTURE_META__ = validFixture ? { name: validFixture, label: validFixture === 'standard' ? 'Standard turn' : validFixture === 'social' ? 'Social prompt' : validFixture === 'paranoia' ? 'Paranoia choice' : validFixture === 'duel' ? 'Duel / Nope' : validFixture === 'chaos' ? 'Chaos resolution' : 'Mobile / Telegram', summary: validFixture === 'standard' ? 'Baseline board with an active human turn, hand, draw pile, discard pile, and timer presentation.' : validFixture === 'social' ? 'Truth/Dare modal preview with explicit answer controls and the public social contract visible.' : validFixture === 'paranoia' ? 'Private target-selection presentation with sealed prompt handling.' : validFixture === 'duel' ? 'Duel target / response presentation with the reaction boundary visible.' : validFixture === 'chaos' ? 'All-player Chaos completion presentation with the deterministic effect already selected.' : 'Narrow viewport presentation used to verify Telegram safe areas and touch-safe layout.' } : null;
      syncFixtureBadge();
      if (!validFixture) return;
      resetFixtureInputs();
      commandStartGame();
      seedFixtureBoard();
      applyFixtureFlow(validFixture);
      state.revision = 0;
      state.events = [];
      addEvent('VISUAL_FIXTURE_READY', `${visualWindow.__CRIBBIT_VISUAL_FIXTURE_META__?.label || validFixture} loaded from the shared fixture renderer.`, 'cyan');
      syncHeader();
      renderAll();
      requestAnimationFrame(() => { syncRailMode(); scheduleBoardFit(); });
      visualWindow.__CRIBBIT_SET_VISUAL_FIXTURE__ = applyVisualFixture;
    }

    function cycleVisualFixture() {
      const current = visualWindow.__CRIBBIT_VISUAL_FIXTURE__ || 'standard';
      const currentIndex = VISUAL_FIXTURE_ORDER.indexOf(current);
      const next = VISUAL_FIXTURE_ORDER[(currentIndex + 1) % VISUAL_FIXTURE_ORDER.length];
      applyVisualFixture(next);
    }

    function initialize() {
      initializeLayoutController();
      initializeNavigationMenus();
      state.prompts.filter(prompt=>prompt.approved && ['original','community','house','live'].includes(prompt.source)).slice(0,8).forEach(prompt=>state.ecosystem.liveRoomPool.add(prompt.id));
      ensureDemoPromptCoverage();
      $('#familyFilters').innerHTML = ['all','truth','dare','paranoia','duel','chaos'].map(filter => `<button class="chip-button" data-filter="${filter}" aria-pressed="${filter === 'all'}" type="button">${filter === 'all' ? 'All families' : filter}</button>`).join('');
      renderSetup();
      renderBoard();
      renderAll();
      syncHeader();
      state.timerInterval = setInterval(tick,250);
      if (visualWindow.__CRIBBIT_VISUAL_FIXTURE__) applyVisualFixture(visualWindow.__CRIBBIT_VISUAL_FIXTURE__);
      addEvent('DEMO_READY', visualWindow.__CRIBBIT_VISUAL_FIXTURE__ ? `Visual fixture preview initialized: ${visualWindow.__CRIBBIT_VISUAL_FIXTURE_META__?.label || visualWindow.__CRIBBIT_VISUAL_FIXTURE__}.` : 'Single-file playable demo initialized. Undefined values remain visible balancing knobs.', 'lime');
      renderAll();
      $('#fixturePill')?.addEventListener('click', cycleVisualFixture);
      auditInteractiveControls();
    }

    initialize();
  })();

export {};
