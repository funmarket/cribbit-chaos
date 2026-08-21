import type { PromptEligibilityRequest, SocialPrompt } from '@cribbit/contracts';

function normalize(value: string): string {
  return value.trim().toLowerCase();
}

export function isPromptEligible(prompt: SocialPrompt, request: PromptEligibilityRequest): boolean {
  if (prompt.kind !== request.kind) return false;
  if (prompt.world !== request.world) return false;
  if (prompt.targeting !== request.targeting) return false;
  if (prompt.groupSizeMin > prompt.groupSizeMax) return false;
  if (request.groupSize < prompt.groupSizeMin) return false;
  if (request.groupSize > prompt.groupSizeMax) return false;
  if (prompt.stage > request.stage) return false;
  if (prompt.intensity > request.intensity) return false;
  if (request.language !== '*' && normalize(prompt.language) !== normalize(request.language)) return false;
  if (request.callSuitability !== '*' && normalize(prompt.callSuitability) !== normalize(request.callSuitability)) return false;

  if (request.excludePromptIds?.includes(prompt.id)) return false;
  if (prompt.repeatGroup && request.excludeRepeatGroups?.some(group => normalize(group) === normalize(prompt.repeatGroup ?? ''))) return false;
  if (prompt.antiRepeatKey && request.excludeAntiRepeatKeys?.some(key => normalize(key) === normalize(prompt.antiRepeatKey ?? ''))) return false;
  return true;
}

export function selectEligiblePrompt(prompts: readonly SocialPrompt[], request: PromptEligibilityRequest): SocialPrompt | null {
  return getEligiblePrompts(prompts, request)[0] ?? null;
}

export function getEligiblePrompts(prompts: readonly SocialPrompt[], request: PromptEligibilityRequest): SocialPrompt[] {
  return prompts
    .filter(prompt => isPromptEligible(prompt, request))
    .sort((left, right) => left.id.localeCompare(right.id));
}

/**
 * Shared approved prompt seed used by every runtime that calls the shared reducer.
 * Clients do not pick outcomes; the reducer filters this pool against the authoritative
 * world/group/targeting contract before selecting a prompt.
 */
export const promptDefinitions: readonly SocialPrompt[] = [
  {
    id:'clean-truth-school', kind:'truth', text:'What is the funniest thing that ever happened to you at school?',
    world:'UNDER_18_CLEAN', stage:1, groupSizeMin:2, groupSizeMax:10, intensity:1, language:'*', callSuitability:'*',
    targeting:'current', authorshipMode:'SIGNED', destination:'community'
  },
  {
    id:'clean-truth-talent', kind:'truth', text:'What harmless talent would surprise this group the most?',
    world:'UNDER_18_CLEAN', stage:0, groupSizeMin:2, groupSizeMax:10, intensity:1, language:'*', callSuitability:'*',
    targeting:'current', options:['A performance','A skill','A fact about me'], authorshipMode:'SIGNED', destination:'community'
  },
  {
    id:'clean-dare-villain', kind:'dare', text:'Act like a cartoon villain for 20 seconds. The group guesses the type.',
    world:'UNDER_18_CLEAN', stage:1, groupSizeMin:2, groupSizeMax:10, intensity:1, language:'*', callSuitability:'*',
    targeting:'current', authorshipMode:'SIGNED', destination:'community'
  },
  {
    id:'clean-dare-pose', kind:'dare', text:'Hold the weirdest heroic pose you can invent until the next player begins.',
    world:'UNDER_18_CLEAN', stage:1, groupSizeMin:2, groupSizeMax:10, intensity:1, language:'*', callSuitability:'*',
    targeting:'current', authorshipMode:'SIGNED', destination:'community'
  },
  {
    id:'clean-paranoia-detective', kind:'paranoia', text:'Who here would make the best cartoon detective?',
    world:'UNDER_18_CLEAN', stage:1, groupSizeMin:3, groupSizeMax:10, intensity:1, language:'*', callSuitability:'*',
    targeting:'specific', authorshipMode:'SIGNED', destination:'community'
  },
  {
    id:'clean-duel-countries', kind:'duel', text:'You each have 15 seconds to name as many African countries as possible.',
    world:'UNDER_18_CLEAN', stage:2, groupSizeMin:2, groupSizeMax:10, intensity:2, language:'*', callSuitability:'*',
    targeting:'specific', authorshipMode:'SIGNED', destination:'community', duelJudgingMode:'GROUP_VOTE'
  },
  {
    id:'clean-chaos-animal', kind:'chaos', text:'Everyone has 10 seconds to draw an animal. The active player chooses the funniest.',
    world:'UNDER_18_CLEAN', stage:3, groupSizeMin:2, groupSizeMax:10, intensity:3, language:'*', callSuitability:'*',
    targeting:'all', authorshipMode:'SIGNED', destination:'community'
  },
  {
    id:'adult-truth-assumption', kind:'truth', text:'What assumption does this group have about you that is completely wrong?',
    world:'18+_ADULT', stage:1, groupSizeMin:2, groupSizeMax:10, intensity:1, language:'*', callSuitability:'*',
    targeting:'current', authorshipMode:'SIGNED', destination:'community'
  },
  {
    id:'adult-truth-draft', kind:'truth', text:'What is a message you drafted and never sent?',
    world:'18+_ADULT', stage:1, groupSizeMin:2, groupSizeMax:10, intensity:1, language:'*', callSuitability:'*',
    targeting:'current', authorshipMode:'SIGNED', destination:'community'
  },
  {
    id:'adult-dare-impression', kind:'dare', text:'Do your best celebrity impression for 20 seconds.',
    world:'18+_ADULT', stage:1, groupSizeMin:2, groupSizeMax:10, intensity:1, language:'*', callSuitability:'*',
    targeting:'current', authorshipMode:'SIGNED', destination:'community'
  },
  {
    id:'adult-dare-story', kind:'dare', text:'Tell a dramatic ten-second story using only three words chosen by the group.',
    world:'18+_ADULT', stage:2, groupSizeMin:2, groupSizeMax:10, intensity:2, language:'*', callSuitability:'*',
    targeting:'current', authorshipMode:'SIGNED', destination:'community'
  },
  {
    id:'adult-paranoia-plan', kind:'paranoia', text:'Who here is most likely to have a secret backup plan?',
    world:'18+_ADULT', stage:1, groupSizeMin:3, groupSizeMax:10, intensity:1, language:'*', callSuitability:'*',
    targeting:'specific', authorshipMode:'SIGNED', destination:'community'
  },
  {
    id:'adult-duel-liar', kind:'duel', text:'You each get 15 seconds to convince the room you are the better liar. The room votes.',
    world:'18+_ADULT', stage:2, groupSizeMin:2, groupSizeMax:10, intensity:2, language:'*', callSuitability:'*',
    targeting:'specific', authorshipMode:'SIGNED', destination:'community', duelJudgingMode:'GROUP_VOTE'
  },
  {
    id:'adult-chaos-reverse', kind:'chaos', text:'Everyone answers the next eligible question in reverse turn order.',
    world:'18+_ADULT', stage:3, groupSizeMin:2, groupSizeMax:10, intensity:3, language:'*', callSuitability:'*',
    targeting:'all', authorshipMode:'SIGNED', destination:'community'
  }
] as const;
