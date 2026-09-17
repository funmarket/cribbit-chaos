/**
 * Cribbit CHAOS — Canonical Digital Card Registry
 *
 * This file is the DIGITAL MASTER for the physical 133-card deck.
 * It does not implement gameplay rules. The game engine owns legality/effects.
 */

import type {
  CardColor,
  CardDefinition,
  CardFamily,
  DeckDefinition,
  PhysicalCardInstance,
} from "./types";

export const DECK_SPEC_ID = "CHAOS-133-V1" as const;
export const CANONICAL_DECK_SIZE = 133 as const;
export const CARD_BACK = "backs/card_back.jpg";

export const CARD_COPY_COUNTS: Readonly<Record<CardFamily, number>> = {
  number: 76,
  skip: 6,
  reverse: 6,
  draw: 6,
  wild: 3,
  truth: 3,
  dare: 3,
  paranoia: 3,
  chaos: 3,
  duel: 3,
  nope: 3,
  tag: 3,
  truth_or_chaos: 3,
  hijack: 3,
  taboo: 3,
  machiavelli: 1,
  ghost: 1,
  reverse_confession: 3,
  dig_me: 1,
};

const colors = ["lime", "orange", "cyan", "purple"] as const satisfies readonly CardColor[];

const numberMasters: CardDefinition[] = colors.flatMap((color) =>
  Array.from({ length: 10 }, (_, value) => ({
    id: `number_${color}_${value}`,
    family: "number" as const,
    name: `${color.toUpperCase()} ${value}`,
    color,
    value,
    image: `cards/numbers/${color}/number_${color}_${value}_${value === 0 ? "01" : "01"}.jpg`,
    description: "Match by color or number.",
    copies: value === 0 ? 1 : 2,
    lifecycle: "reusable" as const,
  }))
);

const actionMasters: CardDefinition[] = [
  { id: "skip", family: "skip", name: "SKIP", image: "cards/skip/skip_01.jpg", description: "Deny the next eligible player a turn.", copies: 6, lifecycle: "reusable" },
  { id: "reverse", family: "reverse", name: "REVERSE", image: "cards/reverse/reverse_01.jpg", description: "Reverse the current turn direction; in two-player play the turn returns.", copies: 6, lifecycle: "reusable" },
  { id: "draw", family: "draw", name: "DRAW", image: "cards/draw/draw_01.jpg", description: "End your action and make the next eligible player draw exactly 2 real cards; whether that player's normal turn is also removed remains unresolved.", copies: 6, lifecycle: "reusable" },
  { id: "wild", family: "wild", name: "WILD", image: "cards/wild/wild_01.jpg", description: "Choose the active color.", copies: 3, lifecycle: "reusable" },

  { id: "truth", family: "truth", name: "TRUTH", image: "cards/truth/truth_01.jpg", description: "Use Manual or Roulette for one Truth question; Pass / Not for Me draws exactly 2 before resolution.", copies: 3, lifecycle: "exhausted_after_resolution" },
  { id: "dare", family: "dare", name: "DARE", image: "cards/dare/dare_01.jpg", description: "Choose another player first, then establish a Manual or Roulette Dare for that target; target refusal draws exactly 2.", copies: 3, lifecycle: "exhausted_after_resolution" },
  { id: "paranoia", family: "paranoia", name: "PARANOIA", image: "cards/paranoia/paranoia_01.jpg", description: "Ask a personal, awkward or revealing question, then resolve Classic Reveal / Keep Secret or Stranger belief voting under the canonical Paranoia rules.", copies: 3, lifecycle: "exhausted_after_resolution" },
  { id: "chaos", family: "chaos", name: "CHAOS", image: "cards/chaos/chaos_01.jpg", description: "Trigger one approved whole-table disruption. Current canonical effects are Blind Swap and Reverse Order.", copies: 3, lifecycle: "exhausted_after_resolution" },
  { id: "duel", family: "duel", name: "DUEL", image: "cards/duel/duel_01.jpg", description: "Challenge another player with one shared question; subjective results use eligible non-participant group voting and do not replace empty-hand victory.", copies: 3, lifecycle: "exhausted_after_resolution" },
  { id: "nope", family: "nope", name: "NOPE", image: "cards/nope/nope_01.jpg", description: "Consume this card to escape an eligible Truth or Dare challenge without the normal refusal penalty; any other eligibility must be explicitly approved.", copies: 3, lifecycle: "exhausted_after_resolution" },
  { id: "tag", family: "tag", name: "TAG", image: "cards/tag/tag_01.jpg", description: "Tag another player into your turn for one bonus Play-or-Draw action; they still keep their normal scheduled turn.", copies: 3, lifecycle: "exhausted_after_resolution" },
  { id: "truth_or_chaos", family: "truth_or_chaos", name: "TRUTH OR CHAOS", image: "cards/truth_or_chaos/truth_or_chaos_01.jpg", description: "Ask the affected group one comparable-answer question; if any answer differs, impose one group Dare / group punishment.", copies: 3, lifecycle: "exhausted_after_resolution" },
  { id: "hijack", family: "hijack", name: "HIJACK", image: "cards/hijack/hijack_01.jpg", description: "Choose another player and permanently swap turn-order positions; the target draws 1 and immediately gets a normal Play-or-Draw action from your former position.", copies: 3, lifecycle: "exhausted_after_resolution" },
  { id: "taboo", family: "taboo", name: "TABOO", image: "cards/taboo/taboo_01.jpg", description: "Ask one chosen player a question: answer YES or draw exactly 2 cards.", copies: 3, lifecycle: "exhausted_after_resolution" },

  { id: "machiavelli", family: "machiavelli", name: "MACHIAVELLI", image: "cards/machiavelli/machiavelli_01.jpg", description: "Privately choose exactly one of six fixed server-enforced effects: Convert the Weak, Taboo for All, No Mercy, Paranoia Spreads, Double the Pressure, or Reverse Confession.", copies: 1, lifecycle: "exhausted_after_resolution" },
  { id: "ghost", family: "ghost", name: "GHOST", image: "cards/ghost/ghost_01.jpg", description: "Arm face-down, then activate to become a Ghost for two of your own turns: play a legal card from hand if possible and take no normal draw when none is legal.", copies: 1, lifecycle: "persistent_until_resolution" },
  { id: "reverse_confession", family: "reverse_confession", name: "REVERSE CONFESSION", image: "cards/reverse_confession/fIYGR_01.jpg", description: "Confess something about yourself. It can be real or made up — do not say which one it is. Final group-response mechanics remain unresolved.", copies: 3, lifecycle: "exhausted_after_resolution" },
  { id: "dig_me", family: "dig_me", name: "DIG ME", image: "cards/Dig_Me/digme.jpg", description: "Choose another player and personally write or ask live one question about yourself; DIG ME does not use Roulette or app suggestions.", copies: 1, lifecycle: "exhausted_after_resolution" },
];

export const CARD_MASTERS: readonly CardDefinition[] = [
  ...numberMasters,
  ...actionMasters,
];

function numberInstances(): PhysicalCardInstance[] {
  const instances: PhysicalCardInstance[] = [];
  for (const color of colors) {
    for (let value = 0; value <= 9; value++) {
      const copies = value === 0 ? 1 : 2;
      for (let copy = 1; copy <= copies; copy++) {
        const suffix = String(copy).padStart(2, "0");
        instances.push({
          instanceId: `number_${color}_${value}_${suffix}`,
          masterId: `number_${color}_${value}`,
          family: "number",
          color,
          value,
          image: `cards/numbers/${color}/number_${color}_${value}_${suffix}.jpg`,
        });
      }
    }
  }
  return instances;
}

const familyAsset: Record<Exclude<CardFamily, "number">, { folder: string; base: string }> = {
  skip: { folder: "skip", base: "skip" },
  reverse: { folder: "reverse", base: "reverse" },
  draw: { folder: "draw", base: "draw" },
  wild: { folder: "wild", base: "wild" },
  truth: { folder: "truth", base: "truth" },
  dare: { folder: "dare", base: "dare" },
  paranoia: { folder: "paranoia", base: "paranoia" },
  chaos: { folder: "chaos", base: "chaos" },
  duel: { folder: "duel", base: "duel" },
  nope: { folder: "nope", base: "nope" },
  tag: { folder: "tag", base: "tag" },
  truth_or_chaos: { folder: "truth_or_chaos", base: "truth_or_chaos" },
  hijack: { folder: "hijack", base: "hijack" },
  taboo: { folder: "taboo", base: "taboo" },
  machiavelli: { folder: "machiavelli", base: "machiavelli" },
  ghost: { folder: "ghost", base: "ghost" },
  reverse_confession: { folder: "reverse_confession", base: "fIYGR" },
  dig_me: { folder: "Dig_Me", base: "digme" },
};

function actionInstances(): PhysicalCardInstance[] {
  const instances: PhysicalCardInstance[] = [];

  for (const family of Object.keys(familyAsset) as Array<Exclude<CardFamily, "number">>) {
    const count = CARD_COPY_COUNTS[family];
    const { folder, base } = familyAsset[family];

    for (let copy = 1; copy <= count; copy++) {
      const suffix = String(copy).padStart(2, "0");
      const singleUnnumbered = family === "dig_me";
      instances.push({
        instanceId: count === 1 ? family : `${family}_${suffix}`,
        masterId: family,
        family,
        image: singleUnnumbered
          ? `cards/${folder}/${base}.jpg`
          : `cards/${folder}/${base}_${suffix}.jpg`,
      });
    }
  }

  return instances;
}

export const CARD_INSTANCES: readonly PhysicalCardInstance[] = [
  ...numberInstances(),
  ...actionInstances(),
];

if (CARD_INSTANCES.length !== CANONICAL_DECK_SIZE) {
  throw new Error(
    `Invalid ${DECK_SPEC_ID} registry: expected ${CANONICAL_DECK_SIZE} cards, got ${CARD_INSTANCES.length}`
  );
}

export const DECK: DeckDefinition = {
  specId: DECK_SPEC_ID,
  totalCards: CANONICAL_DECK_SIZE,
  cardBack: CARD_BACK,
  masters: CARD_MASTERS,
  instances: CARD_INSTANCES,
};

export function getCardMaster(id: string): CardDefinition | undefined {
  return CARD_MASTERS.find((card) => card.id === id);
}

export function getCardsByFamily(family: CardFamily): readonly PhysicalCardInstance[] {
  return CARD_INSTANCES.filter((card) => card.family === family);
}

export function buildDeck(): PhysicalCardInstance[] {
  return CARD_INSTANCES.map((card) => ({ ...card }));
}
