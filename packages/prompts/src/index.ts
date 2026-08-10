import type { PromptEligibilityRequest, SocialPrompt } from '@cribbit/contracts';

function normalize(value: string): string {
  return value.trim().toLowerCase();
}

export function isPromptEligible(prompt: SocialPrompt, request: PromptEligibilityRequest): boolean {
  if (prompt.kind !== request.kind) return false;
  if (prompt.world !== request.world) return false;
  if (prompt.targeting !== request.targeting) return false;
  if (prompt.groupSize !== request.groupSize) return false;
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
  const eligible = prompts.filter(prompt => isPromptEligible(prompt, request)).sort((left, right) => left.id.localeCompare(right.id));
  return eligible[0] ?? null;
}

/** Prompt contracts only; content and moderation are backend-owned. */
export const promptDefinitions: readonly SocialPrompt[] = [];
