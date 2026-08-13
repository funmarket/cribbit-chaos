import {
  getCardBackAsset,
  getCardDefinition,
  getCardFrontAsset,
  getCardsByFamily,
  hasCardDefinition
} from '@cribbit/cards';
import type { CardBackKind, CardDefinition, CardFamily } from '@cribbit/cards';
import type { Card, CardKind } from '../../../packages/contracts/src/index.ts';
import './styles/cards.css';

type TelegramCardSize = 'board' | 'hand';
type ImportedAssetMap = Record<string, string>;

const FRONT_ASSET_URLS = normalizeAssetUrls({
  ...import.meta.glob<string>('../../../packages/cards/assets/generated/mobile/fronts/*.png', {
    eager: true,
    import: 'default',
    query: '?url'
  }),
  ...import.meta.glob<string>('../../../packages/cards/assets/generated/thumbnail/fronts/*.png', {
    eager: true,
    import: 'default',
    query: '?url'
  })
});

const BACK_ASSET_URLS = normalizeAssetUrls({
  ...import.meta.glob<string>('../../../packages/cards/assets/generated/mobile/backs/*.png', {
    eager: true,
    import: 'default',
    query: '?url'
  }),
  ...import.meta.glob<string>('../../../packages/cards/assets/generated/thumbnail/backs/*.png', {
    eager: true,
    import: 'default',
    query: '?url'
  })
});

const REPRESENTATIVE_CARD_ID_BY_KIND: Partial<Record<CardKind, string>> = {
  truth: firstCardId('truth'),
  dare: firstCardId('dare'),
  paranoia: firstCardId('paranoia'),
  chaos: firstCardId('chaos'),
  duel: firstCardId('duel'),
  nope: firstCardId('nope'),
  wild: firstCardId('wild')
};

export function renderCribbitCard(card: Card, size: TelegramCardSize): string {
  const definition = resolveCardDefinition(card);
  const backKind = definition?.defaultBack ?? 'classic';
  const frontUrl = definition ? getImportedAssetUrl(FRONT_ASSET_URLS, getCardFrontAsset(definition.id, assetSize(size))) : null;
  const backUrl = getImportedAssetUrl(BACK_ASSET_URLS, getCardBackAsset(backKind, assetSize(size)));
  const imageUrl = frontUrl ?? backUrl;
  const label = definition ? `${definition.title} card` : `${fallbackCardLabel(card)} card back`;
  const dataDefinitionId = definition ? ` data-card-definition-id="${escapeHTML(definition.id)}"` : '';

  return `
    <button
      class="cribbit-card cribbit-card--${size}${definition ? '' : ' cribbit-card--unmapped'}"
      type="button"
      data-card-id="${escapeHTML(card.id)}"
      data-card-kind="${card.kind}"
      data-card-color="${card.color || ''}"
      data-action="play-card"
      ${dataDefinitionId}
      aria-label="${escapeHTML(label)}"
    >
      <img class="cribbit-card__image" src="${escapeHTML(imageUrl)}" alt="" loading="lazy" decoding="async" draggable="false" />
    </button>
  `;
}

export function renderCribbitCardBack(size: TelegramCardSize, backKind: CardBackKind = 'classic'): string {
  const backUrl = getImportedAssetUrl(BACK_ASSET_URLS, getCardBackAsset(backKind, assetSize(size)));
  return `<span class="cribbit-card-back cribbit-card-back--${size}" aria-hidden="true"><img src="${escapeHTML(backUrl)}" alt="" loading="lazy" decoding="async" draggable="false" /></span>`;
}

function resolveCardDefinition(card: Card): CardDefinition | null {
  if (hasCardDefinition(card.id)) return getCardDefinition(card.id);
  const representativeId = REPRESENTATIVE_CARD_ID_BY_KIND[card.kind];
  return representativeId ? getCardDefinition(representativeId) : null;
}

function firstCardId(family: CardFamily): string {
  const [definition] = getCardsByFamily(family);
  if (!definition) throw new Error(`Missing Telegram card representative for ${family}`);
  return definition.id;
}

function assetSize(size: TelegramCardSize): 'mobile' | 'thumbnail' {
  return size === 'board' ? 'mobile' : 'thumbnail';
}

function normalizeAssetUrls(modules: ImportedAssetMap): ImportedAssetMap {
  return Object.fromEntries(
    Object.entries(modules).map(([path, url]) => {
      const normalizedPath = path.replaceAll('\\', '/');
      const [, packagePath] = normalizedPath.match(/packages\/cards\/(.+)$/) ?? [];
      return [packagePath ?? normalizedPath, url];
    })
  );
}

function getImportedAssetUrl(assetUrls: ImportedAssetMap, logicalPath: string): string {
  const url = assetUrls[logicalPath];
  if (!url) throw new Error(`Telegram card asset was not bundled: ${logicalPath}`);
  return url;
}

function fallbackCardLabel(card: Card): string {
  if (card.symbol) return card.symbol;
  if (card.kind === 'number' && typeof card.value === 'number') return `${card.color ?? ''} ${card.value}`.trim();
  return card.kind;
}

function escapeHTML(value: string): string {
  return value.replace(/[&<>'"]/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' })[char] || char);
}
