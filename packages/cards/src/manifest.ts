import type { CardBackKind, CardDefinition, CardFamily, GameCardMapping } from './types.ts';

interface CardGroup {
  readonly start: number;
  readonly end: number;
  readonly type: string;
  readonly family: CardFamily;
  readonly title: string;
  readonly instruction: string;
  readonly defaultBack: CardBackKind;
  readonly mapping: GameCardMapping;
}

const GROUPS = [
  group(1, 10, 'Truth', 'truth', 'TRUTH', 'Reveal something real. Answer honestly. No dodging.', 'classic', {
    runtimeRole: 'playable-social-card',
    engineKind: 'truth'
  }),
  group(11, 19, 'Dare', 'dare', 'DARE', 'Do something bold. No backing out. Commit.', 'classic', {
    runtimeRole: 'playable-social-card',
    engineKind: 'dare'
  }),
  group(20, 26, 'Paranoia', 'paranoia', 'PARANOIA', 'Pick someone. The table decides what they reveal.', 'classic', {
    runtimeRole: 'playable-social-card',
    engineKind: 'paranoia'
  }),
  group(27, 33, 'Chaos', 'chaos', 'CHAOS', 'Everyone is pulled into the prompt.', 'classic', {
    runtimeRole: 'playable-social-card',
    engineKind: 'chaos'
  }),
  group(34, 38, 'Duel', 'duel', 'DUEL', 'Challenge one player directly.', 'classic', {
    runtimeRole: 'playable-social-card',
    engineKind: 'duel'
  }),
  group(39, 43, 'Nope', 'nope', 'NOPE', 'React while a Nope window is open.', 'classic', {
    runtimeRole: 'reaction-card',
    engineKind: 'nope',
    actionId: 'PLAY_NOPE'
  }),
  group(44, 47, 'Wild', 'wild', 'WILD', 'Change color through the authoritative wild selection flow.', 'classic', {
    runtimeRole: 'playable-core-card',
    engineKind: 'wild',
    actionId: 'PLAY_CARD',
    secondaryActionId: 'SELECT_WILD_COLOR'
  }),
  group(48, 51, 'Pass', 'pass', 'PASS', 'Privately decline an eligible active social prompt.', 'classic', {
    runtimeRole: 'safety-action',
    actionId: 'PASS_PROMPT'
  }),
  group(52, 55, 'Rewind', 'rewind', 'REWIND', 'Privately request an eligible alternate prompt.', 'classic', {
    runtimeRole: 'safety-action',
    actionId: 'REWIND_PROMPT'
  }),
  group(56, 57, 'Roulette', 'roulette', 'ROULETTE', 'Presentation metadata for deterministic roulette.', 'chaos_tier', {
    runtimeRole: 'presentation-metadata',
    ambiguity: 'Roulette presentation contract exists, but this card is not itself a gameplay command.'
  }),
  group(58, 59, 'Spice Dial', 'spice', 'SPICE DIAL', 'Prompt-profile/intensity presentation metadata.', 'chaos_tier', {
    runtimeRole: 'presentation-metadata',
    ambiguity: 'Spice Dial has no current engine/action command; verify whether it configures prompt profile or intensity.'
  }),
  group(60, 62, 'Nope Card', 'nope', 'NOPE CARD', 'React while a Nope window is open.', 'classic', {
    runtimeRole: 'reaction-card',
    engineKind: 'nope',
    actionId: 'PLAY_NOPE',
    ambiguity: 'Type label differs from Nope; proposed as same reaction rule pending Bible confirmation.'
  }),
  group(63, 63, 'Flag (Report)', 'flag', 'FLAG', 'Privately flag the current prompt for moderation.', 'classic', {
    runtimeRole: 'safety-action',
    actionId: 'FLAG_PROMPT'
  }),
  group(64, 64, 'Key Rule', 'keyrule', 'KEY RULE', 'Rules-reference metadata.', 'chaos_tier', {
    runtimeRole: 'rules-reference',
    ambiguity: 'Key Rule is reference/metadata; no current engine/action command.'
  }),
  group(65, 67, 'Speak', 'answer', 'SPEAK', 'Answer aloud through the Speak mode.', 'classic', {
    runtimeRole: 'answer-mode',
    actionId: 'SELECT_ANSWER_MODE',
    responseMode: 'SPEAK'
  }),
  group(68, 70, 'Type', 'answer', 'TYPE', 'Answer through the private Type mode.', 'classic', {
    runtimeRole: 'answer-mode',
    actionId: 'SELECT_ANSWER_MODE',
    responseMode: 'TYPE'
  }),
  group(71, 73, 'Choose', 'answer', 'CHOOSE', 'Choose one authoritative option.', 'classic', {
    runtimeRole: 'answer-mode',
    actionId: 'SELECT_ANSWER_MODE',
    responseMode: 'CHOOSE'
  }),
  group(74, 76, 'Answered Live', 'answer', 'ANSWERED LIVE', 'Mark an answer completed live without storing content.', 'classic', {
    runtimeRole: 'answer-mode',
    actionId: 'SELECT_ANSWER_MODE',
    secondaryActionId: 'MARK_ANSWERED_LIVE',
    responseMode: 'ANSWERED_LIVE'
  }),
  group(77, 78, 'Voice Only', 'voice', 'VOICE ONLY', 'Answer constraint metadata.', 'classic', {
    runtimeRole: 'answer-constraint',
    ambiguity: 'Voice-only constraint/card is not a current GameCommand; verify canonical prompt/profile linkage.'
  }),
  group(79, 80, 'No Voice', 'voice', 'NO VOICE', 'Answer constraint metadata.', 'classic', {
    runtimeRole: 'answer-constraint',
    ambiguity: 'No-voice constraint/card is not a current GameCommand; verify canonical prompt/profile linkage.'
  }),
  group(81, 82, 'Signed', 'authorship', 'SIGNED', 'Authorship mode metadata.', 'classic', {
    runtimeRole: 'authorship-mode',
    authorshipMode: 'SIGNED'
  }),
  group(83, 84, 'Reveal After', 'authorship', 'REVEAL AFTER', 'Authorship mode metadata.', 'classic', {
    runtimeRole: 'authorship-mode',
    authorshipMode: 'REVEAL_AFTER'
  }),
  group(85, 86, 'Taboo', 'authorship', 'TABOO', 'Authorship mode metadata.', 'classic', {
    runtimeRole: 'authorship-mode',
    authorshipMode: 'TABOO'
  }),
  group(87, 89, 'Warm Up', 'stage', 'WARM UP', 'Stage metadata.', 'chaos_tier', stageAmbiguity()),
  group(90, 92, 'Personal', 'stage', 'PERSONAL', 'Stage metadata.', 'chaos_tier', stageAmbiguity()),
  group(93, 95, 'Bold', 'stage', 'BOLD', 'Stage metadata.', 'chaos_tier', stageAmbiguity()),
  group(96, 98, 'Chaos Tier', 'stage', 'CHAOS TIER', 'Stage metadata.', 'chaos_tier', stageAmbiguity()),
  group(99, 100, 'Endgame', 'stage', 'ENDGAME', 'Stage metadata.', 'chaos_tier', stageAmbiguity()),
  group(101, 103, '0', 'intensity', '0', 'Warm Up intensity metadata.', 'chaos_tier', intensityAmbiguity()),
  group(104, 106, '1', 'intensity', '1', 'Funny intensity metadata.', 'chaos_tier', intensityAmbiguity()),
  group(107, 109, '2', 'intensity', '2', 'Wild intensity metadata.', 'chaos_tier', intensityAmbiguity()),
  group(110, 112, '3', 'intensity', '3', 'Max intensity metadata.', 'chaos_tier', intensityAmbiguity())
] as const satisfies readonly CardGroup[];

function group(
  start: number,
  end: number,
  type: string,
  family: CardFamily,
  title: string,
  instruction: string,
  defaultBack: CardBackKind,
  mapping: GameCardMapping
): CardGroup {
  return { start, end, type, family, title, instruction, defaultBack, mapping };
}

function stageAmbiguity(): GameCardMapping {
  return {
    runtimeRole: 'stage-card',
    ambiguity: 'Stage cards are prompt/profile metadata, not current GameCommand cards.'
  };
}

function intensityAmbiguity(): GameCardMapping {
  return {
    runtimeRole: 'intensity-card',
    ambiguity: 'Intensity cards are prompt/profile metadata, not current GameCommand cards.'
  };
}

function padId(value: number): string {
  return String(value).padStart(3, '0');
}

function slug(value: string): string {
  return value
    .toLowerCase()
    .replace(/\s+/g, '_')
    .replace(/[()]/g, '')
    .replace(/[^a-z0-9_]/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_|_$/g, '');
}

function buildDefinitions(): readonly CardDefinition[] {
  return GROUPS.flatMap((cardGroup) => {
    const definitions: CardDefinition[] = [];
    for (let numericId = cardGroup.start; numericId <= cardGroup.end; numericId += 1) {
      const id = padId(numericId);
      const filename = `${id}_${slug(cardGroup.type)}.png`;
      definitions.push({
        id,
        type: cardGroup.type,
        family: cardGroup.family,
        title: cardGroup.title,
        instruction: cardGroup.instruction,
        variant: numericId - cardGroup.start + 1,
        filename,
        frontAsset: `assets/masters/${filename}`,
        defaultBack: cardGroup.defaultBack,
        gameMapping: cardGroup.mapping
      });
    }
    return definitions;
  });
}

export const cardDefinitions = buildDefinitions();
