import { InventoryItem, PricingTier } from '../types';

export interface ActivePricingResult {
  effectivePrice: number;
  wholesalePrice: number;
  retailPrice: number;
  exBrewPrice: number;
  promoPrice?: number;
  isPromoActive: boolean;
  promoStatus: 'none' | 'active' | 'upcoming' | 'expired';
  promoLabel?: string;
  activeTier: PricingTier;
}

/**
 * Resolves the active selling price and promotional status for an inventory item.
 * - If tier is 'wholesale', returns wholesalePrice (falling back to retailPrice if not specified).
 * - If tier is 'retail', returns promoPrice if active, or retailPrice.
 */
export function getItemPricing(
  item: InventoryItem,
  referenceDateStr?: string,
  tier: PricingTier = 'retail'
): ActivePricingResult {
  const retailPrice = Number(item.retailPrice) || 0;
  const wholesalePrice =
    item.wholesalePrice !== undefined && item.wholesalePrice > 0
      ? Number(item.wholesalePrice)
      : retailPrice;
  const exBrewPrice = Number(item.unitCost) || 0;
  const promoPrice = item.promoPrice !== undefined ? Number(item.promoPrice) : undefined;

  const today = referenceDateStr || new Date().toISOString().split('T')[0];
  const start = item.promoStartDate?.trim();
  const end = item.promoEndDate?.trim();

  let isPromoActive = false;
  let promoStatus: 'none' | 'active' | 'upcoming' | 'expired' = 'none';
  let promoLabel: string | undefined = undefined;

  if (item.hasPromo && promoPrice && promoPrice > 0) {
    if (!start && !end) {
      isPromoActive = true;
      promoStatus = 'active';
      promoLabel = 'Promo Active';
    } else if (start && today < start) {
      promoStatus = 'upcoming';
      promoLabel = `Starts ${start}`;
    } else if (end && today > end) {
      promoStatus = 'expired';
      promoLabel = `Ended ${end}`;
    } else {
      isPromoActive = true;
      promoStatus = 'active';
      promoLabel = end ? `Promo until ${end}` : 'Promo Active';
    }
  }

  // Determine effective price based on selected pricing tier
  let effectivePrice: number;
  if (tier === 'wholesale') {
    effectivePrice = wholesalePrice;
  } else {
    effectivePrice = isPromoActive && promoPrice ? promoPrice : retailPrice;
  }

  return {
    effectivePrice,
    wholesalePrice,
    retailPrice,
    exBrewPrice,
    promoPrice,
    isPromoActive,
    promoStatus,
    promoLabel,
    activeTier: tier,
  };
}
