import { prisma } from './prisma';
import { Creator, Store, Product, ProductType } from '@prisma/client';

export interface StoreWithDetails extends Store {
  owner: {
    id: string;
    name: string | null;
  };
  _count: {
    products: number;
  };
}

export interface CreateStoreData {
  name: string;
  description?: string;
  logo_url?: string;
  banner_url?: string;
  theme_color?: string;
  custom_domain?: string;
  is_public?: boolean;
  allow_reviews?: boolean;
  auto_approve_products?: boolean;
}

export interface UpdateStoreData {
  name?: string;
  description?: string;
  logo_url?: string;
  banner_url?: string;
  theme_color?: string;
  custom_domain?: string;
  is_public?: boolean;
  allow_reviews?: boolean;
  auto_approve_products?: boolean;
}

export interface ProductListingData {
  generation_id: string;
  creator_id: string;
  product_type: ProductType;
  price_cents: number;
}

export class StoreService {
  /**
   * Create a new store
   */
  static async createStore(ownerId: string, data: CreateStoreData): Promise<StoreWithDetails> {
    // Validate custom domain if provided
    if (data.custom_domain) {
      const existingStore = await prisma.store.findUnique({
        where: { custom_domain: data.custom_domain }
      });
      
      if (existingStore) {
        throw new Error('Custom domain is already taken');
      }
    }

    const store = await prisma.store.create({
      data: {
        ...data,
        owner_id: ownerId
      },
      include: {
        owner: {
          select: {
            id: true,
            name: true
          }
        },
        _count: {
          select: {
            products: true
          }
        }
      }
    });

    return store;
  }

  /**
   * Get store by ID with details
   */
  static async getStoreById(storeId: string): Promise<StoreWithDetails | null> {
    const store = await prisma.store.findUnique({
      where: { id: storeId },
      include: {
        owner: {
          select: {
            id: true,
            name: true
          }
        },
        _count: {
          select: {
            products: true
          }
        }
      }
    });

    return store;
  }

  /**
   * Get stores by owner
   */
  static async getStoresByOwner(ownerId: string): Promise<StoreWithDetails[]> {
    const stores = await prisma.store.findMany({
      where: { owner_id: ownerId },
      include: {
        owner: {
          select: {
            id: true,
            name: true
          }
        },
        _count: {
          select: {
            products: true
          }
        }
      },
      orderBy: {
        createdAt: 'desc'
      }
    });

    return stores;
  }

  /**
   * Update store
   */
  static async updateStore(
    storeId: string, 
    ownerId: string, 
    data: UpdateStoreData
  ): Promise<StoreWithDetails> {
    // Verify ownership
    const store = await prisma.store.findUnique({
      where: { id: storeId }
    });

    if (!store) {
      throw new Error('Store not found');
    }

    if (store.owner_id !== ownerId) {
      throw new Error('Not authorized to update this store');
    }

    // Validate custom domain if being updated
    if (data.custom_domain && data.custom_domain !== store.custom_domain) {
      const existingStore = await prisma.store.findUnique({
        where: { custom_domain: data.custom_domain }
      });
      
      if (existingStore) {
        throw new Error('Custom domain is already taken');
      }
    }

    const updatedStore = await prisma.store.update({
      where: { id: storeId },
      data,
      include: {
        owner: {
          select: {
            id: true,
            name: true
          }
        },
        _count: {
          select: {
            products: true
          }
        }
      }
    });

    return updatedStore;
  }

  /**
   * Delete store
   */
  static async deleteStore(storeId: string, ownerId: string): Promise<void> {
    // Verify ownership and check for products
    const store = await prisma.store.findUnique({
      where: { id: storeId },
      include: {
        _count: {
          select: {
            products: true
          }
        }
      }
    });

    if (!store) {
      throw new Error('Store not found');
    }

    if (store.owner_id !== ownerId) {
      throw new Error('Not authorized to delete this store');
    }

    if (store._count.products > 0) {
      throw new Error('Cannot delete store with existing products');
    }

    await prisma.store.delete({
      where: { id: storeId }
    });
  }

  /**
   * Add product to store with licensing validation
   */
  static async addProductToStore(
    storeId: string, 
    ownerId: string, 
    productData: ProductListingData
  ): Promise<Product> {
    // Verify store ownership
    const store = await prisma.store.findUnique({
      where: { id: storeId }
    });

    if (!store) {
      throw new Error('Store not found');
    }

    if (store.owner_id !== ownerId) {
      throw new Error('Not authorized to add products to this store');
    }

    // Get generation details for policy validation
    const generation = await prisma.generation.findUnique({
      where: { id: productData.generation_id },
      include: {
        user: true
      }
    });

    if (!generation) {
      throw new Error('Generation not found');
    }

    // Import PolicyService here to avoid circular dependencies
    const { PolicyService } = await import('./policy-service');

    // Validate product against creator licensing policy
    const policyCheck = {
      creator_id: productData.creator_id,
      store_owner_id: ownerId,
      generation_user_id: generation.user_id,
      product_type: productData.product_type,
      price_cents: productData.price_cents
    };

    const validation = await PolicyService.validateProductPolicy(policyCheck);

    if (!validation.isValid) {
      throw new Error(`Policy violation: ${validation.errors.join(', ')}`);
    }

    // Create the product
    const product = await prisma.product.create({
      data: {
        store_id: storeId,
        generation_id: productData.generation_id,
        creator_id: productData.creator_id,
        product_type: productData.product_type,
        price_cents: productData.price_cents
      }
    });

    return product;
  }

  /**
   * Get store products with filtering and pagination
   */
  static async getStoreProducts(
    storeId: string,
    options: {
      page?: number;
      limit?: number;
      product_type?: ProductType;
      status?: string;
    } = {}
  ) {
    const { page = 1, limit = 20, product_type, status } = options;
    const skip = (page - 1) * limit;

    const where: any = { store_id: storeId };
    
    if (product_type) {
      where.product_type = product_type;
    }
    
    if (status) {
      where.status = status;
    }

    const [products, total] = await Promise.all([
      prisma.product.findMany({
        where,
        include: {
          generation: {
            select: {
              id: true,
              image_url: true,
              prompt: true,
              mode: true
            }
          },
          creator: {
            select: {
              id: true,
              name: true,
              royalty_bps: true
            }
          }
        },
        skip,
        take: limit,
        orderBy: {
          createdAt: 'desc'
        }
      }),
      prisma.product.count({ where })
    ]);

    return {
      products,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit)
      }
    };
  }

  /**
   * Get public stores (for browsing)
   */
  static async getPublicStores(options: {
    page?: number;
    limit?: number;
    search?: string;
  } = {}) {
    const { page = 1, limit = 20, search } = options;
    const skip = (page - 1) * limit;

    const where: any = { is_public: true };
    
    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { description: { contains: search, mode: 'insensitive' } }
      ];
    }

    const [stores, total] = await Promise.all([
      prisma.store.findMany({
        where,
        include: {
          owner: {
            select: {
              id: true,
              name: true
            }
          },
          _count: {
            select: {
              products: true
            }
          }
        },
        skip,
        take: limit,
        orderBy: {
          createdAt: 'desc'
        }
      }),
      prisma.store.count({ where })
    ]);

    return {
      stores,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit)
      }
    };
  }
}