/**
 * Cribbit CHAOS — Canonical Digital Card Types
 * Deck specification: CHAOS-133-V1
 */

export type CardColor = "lime" | "orange" | "cyan" | "purple";

export type CardFamily =
  | "number"
  | "skip"
  | "reverse"
  | "draw"
  | "wild"
  | "truth"
  | "dare"
  | "paranoia"
  | "chaos"
  | "duel"
  | "nope"
  | "tag"
  | "truth_or_chaos"
  | "hijack"
  | "taboo"
  | "machiavelli"
  | "ghost"
  | "reverse_confession"
  | "dig_me";

export type CardLifecycle =
  | "reusable"
  | "exhausted_after_resolution"
  | "persistent_until_resolution";

export interface CardDefinition {
  /** Stable family/master ID. */
  id: string;
  family: CardFamily;
  name: string;
  color?: CardColor;
  value?: number;

  /**
   * Asset path relative to the shared card package asset root.
   * The UI/build layer resolves this path.
   */
  image: string;

  /** Short role label only. Dynamic Truth/Dare content does not live here. */
  description: string;

  /** Physical copies in canonical CHAOS-133-V1. */
  copies: number;

  /** Where the card goes after normal resolution. */
  lifecycle: CardLifecycle;
}

export interface PhysicalCardInstance {
  /** Unique physical/digital instance ID. */
  instanceId: string;
  masterId: string;
  family: CardFamily;
  image: string;
  color?: CardColor;
  value?: number;
}

export interface DeckDefinition {
  specId: "CHAOS-133-V1";
  totalCards: 133;
  cardBack: string;
  masters: readonly CardDefinition[];
  instances: readonly PhysicalCardInstance[];
}
