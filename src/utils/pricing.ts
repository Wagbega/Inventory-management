import { InventoryItem } from '../types';

export interface ActivePricingResult {
  effectivePrice: number;
  wholesalePrice: number;
  retailPrice: number;
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
 * - Otherwise, returns retailPrice as the effectivePrice.
 */
export function getItemPricing(
  item: InventoryItem,
  referenceDateStr?: string
): ActivePricingResult {
  const retailPrice = Number(item.retailPrice) || 0;
  const wholesalePrice =
    item.wholesalePrice !== undefined && item.wholesalePrice > 0
      ? Number(item.wholesalePrice)
      : retailPrice;
  const exBrewPrice = Number(item.unitCost) || 0;
  const promoPrice = item.promoPrice !== undefined ? Number(item.promoPrice) : undefined;

  if (!item.hasPromo || !promoPrice || promoPrice <= 0) {
    return {
      effectivePrice: retailPrice,
      wholesalePrice,
      retailPrice,
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
      retailPrice,
      exBrewPrice,
      promoPrice,
      isPromoActive: true,
      promoStatus: 'active',
      promoLabel: 'Promo Active',
    };
  }

  if (start && today < start) {
    return {
      effectivePrice: retailPrice,
      wholesalePrice,
      retailPrice,
      exBrewPrice,
      promoPrice,
      isPromoActive: false,
      promoStatus: 'upcoming',
      promoLabel: `Starts ${start}`,
    };
  }

  if (end && today > end) {
    return {
      effectivePrice: retailPrice,
      wholesalePrice,
      retailPrice,
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
    retailPrice,
    exBrewPrice,
    promoPrice,
    isPromoActive: true,
    promoStatus: 'active',
    promoLabel: end ? `Promo until ${end}` : 'Promo Active',
  };
}
