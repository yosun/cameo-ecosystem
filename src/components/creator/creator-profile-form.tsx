'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import ImageUpload from './image-upload';
import ConsentForm from './consent-form';

interface CreatorProfileFormProps {
  initialData?: {
    name: string;
    email: string;
    royalty_bps?: number;
    min_price_cents?: number;
    max_discount_bps?: number;
    allow_third_party_stores?: boolean;
  };
  isEditing?: boolean;
}

export default function CreatorProfileForm({ 
  initialData, 
  isEditing = false 
}: CreatorProfileFormProps) {
  const router = useRouter();
  const [formData, setFormData] = useState({
    name: initialData?.name || '',
    email: initialData?.email || '',
    royalty_bps: initialData?.royalty_bps || 1000, // 10%
    min_price_cents: initialData?.min_price_cents || 500, // $5.00
    max_discount_bps: initialData?.max_discount_bps || 2000, // 20%
    allow_third_party_stores: initialData?.allow_third_party_stores ?? true,
  });
  
  const [trainingImages, setTrainingImages] = useState<File[]>([]);
  const [consent, setConsent] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleInputChange = (field: string, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!isEditing && (!consent || trainingImages.length < 5)) {
      setError('Please provide consent and upload at least 5 training images.');
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      const formDataToSend = new FormData();
      
      // Add form fields
      Object.entries(formData).forEach(([key, value]) => {
        formDataToSend.append(key, value.toString());
      });
      
      // Add consent
      formDataToSend.append('consent_given', consent.toString());
      
      // Add training images (only for new creators)
      if (!isEditing) {
        trainingImages.forEach((file, index) => {
          formDataToSend.append(`training_image_${index}`, file);
        });
      }

      const response = await fetch('/api/creator', {
        method: isEditing ? 'PUT' : 'POST',
        body: formDataToSend,
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error?.message || 'Failed to save creator profile');
      }

      const result = await response.json();
      
      // Redirect to creator dashboard or profile page
      router.push(`/creator/${result.creator.id}`);
    } catch (err) {
      console.error('Error saving creator profile:', err);
      setError(err instanceof Error ? err.message : 'An unexpected error occurred');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-8">
      <div className="bg-white shadow-sm rounded-lg">
        <div className="px-6 py-4 border-b border-gray-200">
          <h1 className="text-2xl font-bold text-gray-900">
            {isEditing ? 'Edit Creator Profile' : 'Create Creator Profile'}
          </h1>
          <p className="mt-1 text-sm text-gray-600">
            {isEditing 
              ? 'Update your creator profile and licensing settings.'
              : 'Set up your creator profile to start training your personalized LoRA model.'
            }
          </p>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-8">
          {/* Basic Information */}
          <div className="space-y-6">
            <h2 className="text-lg font-medium text-gray-900">Basic Information</h2>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label htmlFor="name" className="block text-sm font-medium text-gray-700">
                  Creator Name *
                </label>
                <input
                  type="text"
                  id="name"
                  required
                  value={formData.name}
                  onChange={(e) => handleInputChange('name', e.target.value)}
                  className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
                  placeholder="Enter your creator name"
                />
              </div>

              <div>
                <label htmlFor="email" className="block text-sm font-medium text-gray-700">
                  Email Address *
                </label>
                <input
                  type="email"
                  id="email"
                  required
                  value={formData.email}
                  onChange={(e) => handleInputChange('email', e.target.value)}
                  className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
                  placeholder="Enter your email address"
                />
              </div>
            </div>
          </div>

          {/* Licensing Configuration */}
          <div className="space-y-6">
            <h2 className="text-lg font-medium text-gray-900">Licensing & Revenue Settings</h2>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label htmlFor="royalty_bps" className="block text-sm font-medium text-gray-700">
                  Royalty Rate (%)
                </label>
                <input
                  type="number"
                  id="royalty_bps"
                  min="0"
                  max="5000"
                  step="100"
                  value={formData.royalty_bps / 100}
                  onChange={(e) => handleInputChange('royalty_bps', parseInt(e.target.value) * 100)}
                  className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
                />
                <p className="mt-1 text-sm text-gray-500">
                  Percentage of revenue you'll receive from products using your LoRA (0-50%)
                </p>
              </div>

              <div>
                <label htmlFor="min_price_cents" className="block text-sm font-medium text-gray-700">
                  Minimum Price ($)
                </label>
                <input
                  type="number"
                  id="min_price_cents"
                  min="100"
                  step="100"
                  value={formData.min_price_cents / 100}
                  onChange={(e) => handleInputChange('min_price_cents', parseInt(e.target.value) * 100)}
                  className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
                />
                <p className="mt-1 text-sm text-gray-500">
                  Minimum price for products using your LoRA
                </p>
              </div>

              <div>
                <label htmlFor="max_discount_bps" className="block text-sm font-medium text-gray-700">
                  Maximum Discount (%)
                </label>
                <input
                  type="number"
                  id="max_discount_bps"
                  min="0"
                  max="5000"
                  step="100"
                  value={formData.max_discount_bps / 100}
                  onChange={(e) => handleInputChange('max_discount_bps', parseInt(e.target.value) * 100)}
                  className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
                />
                <p className="mt-1 text-sm text-gray-500">
                  Maximum discount allowed on products using your LoRA (0-50%)
                </p>
              </div>

              <div className="flex items-center">
                <input
                  id="allow_third_party_stores"
                  type="checkbox"
                  checked={formData.allow_third_party_stores}
                  onChange={(e) => handleInputChange('allow_third_party_stores', e.target.checked)}
                  className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                />
                <label htmlFor="allow_third_party_stores" className="ml-2 block text-sm text-gray-700">
                  Allow third-party stores to sell products using my LoRA
                </label>
              </div>
            </div>
          </div>

          {/* Training Images (only for new creators) */}
          {!isEditing && (
            <div className="space-y-6">
              <h2 className="text-lg font-medium text-gray-900">Training Images</h2>
              <ImageUpload onImagesChange={setTrainingImages} />
            </div>
          )}

          {/* Consent Form (only for new creators) */}
          {!isEditing && (
            <div className="space-y-6">
              <h2 className="text-lg font-medium text-gray-900">Consent & Agreement</h2>
              <ConsentForm onConsentChange={setConsent} creatorName={formData.name} />
            </div>
          )}

          {/* Error Display */}
          {error && (
            <div className="bg-red-50 border border-red-200 rounded-md p-4">
              <div className="flex">
                <div className="flex-shrink-0">
                  <svg className="h-5 w-5 text-red-400" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                  </svg>
                </div>
                <div className="ml-3">
                  <h3 className="text-sm font-medium text-red-800">Error</h3>
                  <div className="mt-2 text-sm text-red-700">
                    <p>{error}</p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Submit Button */}
          <div className="flex justify-end space-x-4">
            <button
              type="button"
              onClick={() => router.back()}
              className="px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting || (!isEditing && (!consent || trainingImages.length < 5))}
              className="px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSubmitting 
                ? (isEditing ? 'Updating...' : 'Creating Profile & Starting Training...') 
                : (isEditing ? 'Update Profile' : 'Create Profile & Start Training')
              }
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}