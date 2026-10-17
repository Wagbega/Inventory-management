import { InventoryItem } from '../types';

export interface ActivePricingResult {
  effectivePrice: number;
  wholesalePrice: number;
  exBrewPrice: number;
  promoPrice?: number;
  isPromoActive: boolean;
  promoStatus: 'none' | 'active' | 'upcoming' | 'expired';
  promoLabel?: string;
}

/**
 * Resolves the active selling price and promotional status for an inventory item.
 * - If hasPromo is true and promoPrice > 0, checks if the referenceDate (default: today)
 *   falls within promoStartDate and promoEndDate (inclusive).
 * - If active, returns promoPrice as the effectivePrice.
 * - Otherwise, returns retailPrice (Wholesale Price) as the effectivePrice.
 */
export function getItemPricing(
  item: InventoryItem,
  referenceDateStr?: string
): ActivePricingResult {
  const wholesalePrice = Number(item.retailPrice) || 0;
  const exBrewPrice = Number(item.unitCost) || 0;
  const promoPrice = item.promoPrice !== undefined ? Number(item.promoPrice) : undefined;

  if (!item.hasPromo || !promoPrice || promoPrice <= 0) {
    return {
      effectivePrice: wholesalePrice,
      wholesalePrice,
      exBrewPrice,
      promoPrice: undefined,
      isPromoActive: false,
      promoStatus: 'none',
    };
  }

  const today = referenceDateStr || new Date().toISOString().split('T')[0];
  const start = item.promoStartDate?.trim();
  const end = item.promoEndDate?.trim();

  // If no start or end date is specified while hasPromo is enabled, treat as active
  if (!start && !end) {
    return {
      effectivePrice: promoPrice,
      wholesalePrice,
      exBrewPrice,
      promoPrice,
      isPromoActive: true,
      promoStatus: 'active',
      promoLabel: 'Promo Active',
    };
  }

  if (start && today < start) {
    return {
      effectivePrice: wholesalePrice,
      wholesalePrice,
      exBrewPrice,
      promoPrice,
      isPromoActive: false,
      promoStatus: 'upcoming',
      promoLabel: `Starts ${start}`,
    };
  }

  if (end && today > end) {
    return {
      effectivePrice: wholesalePrice,
      wholesalePrice,
      exBrewPrice,
      promoPrice,
      isPromoActive: false,
      promoStatus: 'expired',
      promoLabel: `Ended ${end}`,
    };
  }

  return {
    effectivePrice: promoPrice,
    wholesalePrice,
    exBrewPrice,
    promoPrice,
    isPromoActive: true,
    promoStatus: 'active',
    promoLabel: end ? `Promo until ${end}` : 'Promo Active',
  };
}
