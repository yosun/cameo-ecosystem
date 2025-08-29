import { prisma } from './prisma';
import { Creator, Product, ProductType } from '@prisma/client';

export interface PolicyValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
}

export interface ProductPolicyCheck {
  creator_id: string;
  store_owner_id: string;
  generation_user_id: string;
  product_type: ProductType;
  price_cents: number;
  discount_bps?: number;
}

export class PolicyService {
  /**
   * Validate if a product can be created according to creator licensing policy
   */
  static async validateProductPolicy(check: ProductPolicyCheck): Promise<PolicyValidationResult> {
    const result: PolicyValidationResult = {
      isValid: true,
      errors: [],
      warnings: []
    };

    try {
      // Get creator licensing configuration
      const creator = await prisma.creator.findUnique({
        where: { id: check.creator_id }
      });

      if (!creator) {
        result.isValid = false;
        result.errors.push('Creator not found');
        return result;
      }

      // Check if third-party stores are allowed
      if (!creator.allow_third_party_stores && check.store_owner_id !== check.generation_user_id) {
        result.isValid = false;
        result.errors.push('Creator does not allow third-party store listings');
        return result;
      }

      // Check minimum price constraint
      if (check.price_cents < creator.min_price_cents) {
        result.isValid = false;
        result.errors.push(
          `Price $${check.price_cents / 100} is below creator's minimum of $${creator.min_price_cents / 100}`
        );
      }

      // Check maximum discount constraint
      if (check.discount_bps && check.discount_bps > creator.max_discount_bps) {
        result.isValid = false;
        result.errors.push(
          `Discount ${check.discount_bps / 100}% exceeds creator's maximum of ${creator.max_discount_bps / 100}%`
        );
      }

      // Calculate effective price after discount
      const effectivePrice = check.discount_bps 
        ? check.price_cents * (1 - check.discount_bps / 10000)
        : check.price_cents;

      if (effectivePrice < creator.min_price_cents) {
        result.isValid = false;
        result.errors.push(
          `Price after discount ($${effectivePrice / 100}) is below creator's minimum of $${creator.min_price_cents / 100}`
        );
      }

      // Add warnings for high royalty rates
      if (creator.royalty_bps > 2500) { // 25%
        result.warnings.push(
          `High royalty rate (${creator.royalty_bps / 100}%) may reduce store owner profit margins`
        );
      }

      // Add warnings for high minimum prices
      if (creator.min_price_cents > 2000) { // $20
        result.warnings.push(
          `High minimum price ($${creator.min_price_cents / 100}) may limit market appeal`
        );
      }

    } catch (error) {
      console.error('Error validating product policy:', error);
      result.isValid = false;
      result.errors.push('Failed to validate product policy');
    }

    return result;
  }

  /**
   * Calculate revenue split for a product sale
   */
  static async calculateRevenueSplit(productId: string, salePrice: number) {
    const product = await prisma.product.findUnique({
      where: { id: productId },
      include: {
        creator: true,
        store: true
      }
    });

    if (!product) {
      throw new Error('Product not found');
    }

    const platformFeeBps = 1000; // 10% platform fee
    const creatorRoyaltyBps = product.creator.royalty_bps;

    const platformFee = Math.floor(salePrice * platformFeeBps / 10000);
    const creatorRoyalty = Math.floor(salePrice * creatorRoyaltyBps / 10000);
    const storeRevenue = salePrice - platformFee - creatorRoyalty;

    return {
      salePrice,
      platformFee,
      creatorRoyalty,
      storeRevenue,
      splits: {
        platform: {
          amount: platformFee,
          percentage: platformFeeBps / 100
        },
        creator: {
          id: product.creator.id,
          name: product.creator.name,
          amount: creatorRoyalty,
          percentage: creatorRoyaltyBps / 100
        },
        store: {
          id: product.store.id,
          name: product.store.name,
          amount: storeRevenue,
          percentage: ((storeRevenue / salePrice) * 100)
        }
      }
    };
  }

  /**
   * Validate pricing constraints for a creator
   */
  static validateCreatorLicensing(licensing: {
    royalty_bps: number;
    min_price_cents: number;
    max_discount_bps: number;
  }): PolicyValidationResult {
    const result: PolicyValidationResult = {
      isValid: true,
      errors: [],
      warnings: []
    };

    // Validate royalty rate
    if (licensing.royalty_bps < 100) { // 1%
      result.errors.push('Royalty rate must be at least 1%');
      result.isValid = false;
    }
    if (licensing.royalty_bps > 5000) { // 50%
      result.errors.push('Royalty rate cannot exceed 50%');
      result.isValid = false;
    }

    // Validate minimum price
    if (licensing.min_price_cents < 100) { // $1.00
      result.errors.push('Minimum price must be at least $1.00');
      result.isValid = false;
    }
    if (licensing.min_price_cents > 50000) { // $500.00
      result.errors.push('Minimum price cannot exceed $500.00');
      result.isValid = false;
    }

    // Validate maximum discount
    if (licensing.max_discount_bps < 0) {
      result.errors.push('Maximum discount cannot be negative');
      result.isValid = false;
    }
    if (licensing.max_discount_bps > 7500) { // 75%
      result.errors.push('Maximum discount cannot exceed 75%');
      result.isValid = false;
    }

    // Add warnings
    if (licensing.royalty_bps > 3000) { // 30%
      result.warnings.push('High royalty rates may discourage store owners from listing your products');
    }

    if (licensing.min_price_cents > 5000) { // $50
      result.warnings.push('High minimum prices may limit product accessibility');
    }

    if (licensing.max_discount_bps > 5000) { // 50%
      result.warnings.push('High maximum discounts may devalue your brand');
    }

    return result;
  }

  /**
   * Get policy compliance report for a creator
   */
  static async getCreatorPolicyReport(creatorId: string) {
    const creator = await prisma.creator.findUnique({
      where: { id: creatorId },
      include: {
        products: {
          include: {
            store: {
              select: {
                id: true,
                name: true,
                owner_id: true
              }
            }
          }
        }
      }
    });

    if (!creator) {
      throw new Error('Creator not found');
    }

    const report = {
      creator: {
        id: creator.id,
        name: creator.name,
        licensing: {
          allow_third_party_stores: creator.allow_third_party_stores,
          royalty_bps: creator.royalty_bps,
          min_price_cents: creator.min_price_cents,
          max_discount_bps: creator.max_discount_bps
        }
      },
      products: {
        total: creator.products.length,
        by_store_type: {
          own_stores: creator.products.filter(p => p.store.owner_id === creatorId).length,
          third_party_stores: creator.products.filter(p => p.store.owner_id !== creatorId).length
        },
        price_distribution: {
          min: Math.min(...creator.products.map(p => p.price_cents)),
          max: Math.max(...creator.products.map(p => p.price_cents)),
          avg: Math.floor(creator.products.reduce((sum, p) => sum + p.price_cents, 0) / creator.products.length)
        }
      },
      compliance: {
        all_products_above_min_price: creator.products.every(p => p.price_cents >= creator.min_price_cents),
        third_party_compliance: creator.allow_third_party_stores || creator.products.every(p => p.store.owner_id === creatorId)
      }
    };

    return report;
  }

  /**
   * Enforce policy on existing products (for policy updates)
   */
  static async enforcePolicyOnExistingProducts(creatorId: string) {
    const creator = await prisma.creator.findUnique({
      where: { id: creatorId },
      include: {
        products: {
          include: {
            store: true,
            generation: {
              include: {
                user: true
              }
            }
          }
        }
      }
    });

    if (!creator) {
      throw new Error('Creator not found');
    }

    const violations = [];
    const updates = [];

    for (const product of creator.products) {
      const policyCheck: ProductPolicyCheck = {
        creator_id: creatorId,
        store_owner_id: product.store.owner_id,
        generation_user_id: product.generation.user_id,
        product_type: product.product_type,
        price_cents: product.price_cents
      };

      const validation = await this.validateProductPolicy(policyCheck);

      if (!validation.isValid) {
        violations.push({
          product_id: product.id,
          store_name: product.store.name,
          errors: validation.errors
        });

        // Deactivate non-compliant products
        updates.push(
          prisma.product.update({
            where: { id: product.id },
            data: { status: 'INACTIVE' }
          })
        );
      }
    }

    // Execute all updates
    if (updates.length > 0) {
      await Promise.all(updates);
    }

    return {
      violations_found: violations.length,
      violations,
      products_deactivated: updates.length
    };
  }
}