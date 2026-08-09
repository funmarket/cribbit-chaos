import type { AuthorshipMode, PromptDestination } from '@cribbit/contracts';

export interface PromptDefinition {
  id: string;
  text: string;
  authorshipMode: AuthorshipMode;
  destination: PromptDestination;
}

/** Prompt contracts only; content and moderation are backend-owned. */
export const promptDefinitions: readonly PromptDefinition[] = [];
