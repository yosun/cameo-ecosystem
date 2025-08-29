'use client';

import { useState } from 'react';

interface ConsentFormProps {
  onConsentChange: (consent: boolean) => void;
  creatorName: string;
}

export default function ConsentForm({ onConsentChange, creatorName }: ConsentFormProps) {
  const [consent, setConsent] = useState(false);
  const [acknowledgments, setAcknowledgments] = useState({
    ownership: false,
    rights: false,
    commercial: false,
    liability: false,
  });

  const handleAcknowledgmentChange = (key: keyof typeof acknowledgments, value: boolean) => {
    const newAcknowledgments = { ...acknowledgments, [key]: value };
    setAcknowledgments(newAcknowledgments);
    
    // Check if all acknowledgments are true
    const allAcknowledged = Object.values(newAcknowledgments).every(Boolean);
    setConsent(allAcknowledged);
    onConsentChange(allAcknowledged);
  };

  return (
    <div className="bg-gray-50 border border-gray-200 rounded-lg p-6 space-y-4">
      <div className="flex items-start space-x-3">
        <div className="flex-shrink-0">
          <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </div>
        <div className="flex-1">
          <h3 className="text-lg font-medium text-gray-900">
            Creator Consent & Rights Agreement
          </h3>
          <p className="mt-1 text-sm text-gray-600">
            Please read and acknowledge the following terms before proceeding with LoRA training.
          </p>
        </div>
      </div>

      <div className="space-y-4">
        <div className="flex items-start space-x-3">
          <input
            id="ownership"
            type="checkbox"
            checked={acknowledgments.ownership}
            onChange={(e) => handleAcknowledgmentChange('ownership', e.target.checked)}
            className="mt-1 h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
          />
          <label htmlFor="ownership" className="text-sm text-gray-700">
            <strong>Image Ownership:</strong> I confirm that I own all rights to the uploaded images or have explicit permission to use them for AI training purposes. I understand that these images will be used to create a personalized LoRA model.
          </label>
        </div>

        <div className="flex items-start space-x-3">
          <input
            id="rights"
            type="checkbox"
            checked={acknowledgments.rights}
            onChange={(e) => handleAcknowledgmentChange('rights', e.target.checked)}
            className="mt-1 h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
          />
          <label htmlFor="rights" className="text-sm text-gray-700">
            <strong>Licensing Rights:</strong> I grant permission for fans to generate content using my LoRA model and understand that I can configure licensing terms, royalty rates, and usage restrictions through my creator profile.
          </label>
        </div>

        <div className="flex items-start space-x-3">
          <input
            id="commercial"
            type="checkbox"
            checked={acknowledgments.commercial}
            onChange={(e) => handleAcknowledgmentChange('commercial', e.target.checked)}
            className="mt-1 h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
          />
          <label htmlFor="commercial" className="text-sm text-gray-700">
            <strong>Commercial Use:</strong> I understand that generated content may be used for commercial purposes (merchandise, products) and that I will receive royalties based on my configured licensing terms.
          </label>
        </div>

        <div className="flex items-start space-x-3">
          <input
            id="liability"
            type="checkbox"
            checked={acknowledgments.liability}
            onChange={(e) => handleAcknowledgmentChange('liability', e.target.checked)}
            className="mt-1 h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
          />
          <label htmlFor="liability" className="text-sm text-gray-700">
            <strong>Content Responsibility:</strong> I understand that the platform has content safety measures in place, but I am responsible for ensuring my training images comply with platform policies and applicable laws.
          </label>
        </div>
      </div>

      <div className="border-t border-gray-200 pt-4">
        <div className="flex items-center space-x-3">
          <input
            id="final-consent"
            type="checkbox"
            checked={consent}
            disabled={!Object.values(acknowledgments).every(Boolean)}
            className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded disabled:opacity-50"
            readOnly
          />
          <label htmlFor="final-consent" className="text-sm font-medium text-gray-900">
            I, {creatorName}, provide my explicit consent for LoRA training and content generation as outlined above.
          </label>
        </div>
      </div>

      {consent && (
        <div className="bg-green-50 border border-green-200 rounded-md p-3">
          <div className="flex">
            <div className="flex-shrink-0">
              <svg className="h-5 w-5 text-green-400" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
              </svg>
            </div>
            <div className="ml-3">
              <p className="text-sm font-medium text-green-800">
                Consent provided successfully
              </p>
              <p className="mt-1 text-sm text-green-700">
                You can now proceed with LoRA training. Your consent is recorded with timestamp: {new Date().toISOString()}.
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}