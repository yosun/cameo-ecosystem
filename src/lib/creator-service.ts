import { prisma } from './prisma';
import { Creator, LoRAStatus } from '@prisma/client';

export interface CreateCreatorData {
  name: string;
  email: string;
  training_images: string[];
  consent_given: boolean;
  allow_third_party_stores?: boolean;
  royalty_bps?: number;
  min_price_cents?: number;
  max_discount_bps?: number;
}

export interface UpdateCreatorData {
  name?: string;
  training_images?: string[];
  consent_given?: boolean;
  status?: LoRAStatus;
  lora_url?: string;
  trigger_word?: string;
  fal_job_id?: string;
  allow_third_party_stores?: boolean;
  royalty_bps?: number;
  min_price_cents?: number;
  max_discount_bps?: number;
}

/**
 * Creates a new creator profile
 */
export async function createCreator(data: CreateCreatorData): Promise<Creator> {
  return await prisma.creator.create({
    data: {
      name: data.name,
      email: data.email,
      training_images: JSON.stringify(data.training_images), // Convert array to JSON string for SQLite
      consent_given: data.consent_given,
      allow_third_party_stores: data.allow_third_party_stores ?? true,
      royalty_bps: data.royalty_bps ?? 1000,
      min_price_cents: data.min_price_cents ?? 500,
      max_discount_bps: data.max_discount_bps ?? 2000,
    },
  });
}

/**
 * Gets a creator by ID
 */
export async function getCreatorById(id: string): Promise<Creator | null> {
  return await prisma.creator.findUnique({
    where: { id },
  });
}

/**
 * Gets a creator by email
 */
export async function getCreatorByEmail(email: string): Promise<Creator | null> {
  return await prisma.creator.findUnique({
    where: { email },
  });
}

/**
 * Updates a creator profile
 */
export async function updateCreator(
  id: string,
  data: UpdateCreatorData
): Promise<Creator> {
  const updateData = { ...data };
  
  // Convert training_images array to JSON string if provided
  if (data.training_images) {
    updateData.training_images = JSON.stringify(data.training_images);
  }
  
  return await prisma.creator.update({
    where: { id },
    data: updateData,
  });
}

/**
 * Updates creator LoRA status
 */
export async function updateCreatorLoRAStatus(
  id: string,
  status: LoRAStatus,
  lora_url?: string,
  trigger_word?: string
): Promise<Creator> {
  return await prisma.creator.update({
    where: { id },
    data: {
      status,
      lora_url,
      trigger_word,
    },
  });
}

/**
 * Updates creator with FAL job ID
 */
export async function updateCreatorFALJobId(
  id: string,
  fal_job_id: string
): Promise<Creator> {
  return await prisma.creator.update({
    where: { id },
    data: {
      fal_job_id,
      status: LoRAStatus.TRAINING,
    },
  });
}

/**
 * Gets all creators with their LoRA status
 */
export async function getAllCreators(): Promise<Creator[]> {
  return await prisma.creator.findMany({
    orderBy: { createdAt: 'desc' },
  });
}

/**
 * Gets creators that are ready for generation (LoRA trained)
 */
export async function getReadyCreators(): Promise<Creator[]> {
  return await prisma.creator.findMany({
    where: {
      status: LoRAStatus.READY,
      lora_url: { not: null },
    },
    orderBy: { createdAt: 'desc' },
  });
}