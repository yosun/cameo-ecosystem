'use client';

import { useState } from 'react';
import { AlertTriangle, CheckCircle, XCircle } from 'lucide-react';

interface ContentSafetyValidatorProps {
  onValidation: (isValid: boolean, violations: string[]) => void;
  content: {
    text?: string;
    imageUrl?: string;
  };
  showResults?: boolean;
}

interface ValidationResult {
  isValid: boolean;
  violations: string[];
  isLoading: boolean;
}

export function ContentSafetyValidator({ 
  onValidation, 
  content, 
  showResults = true 
}: ContentSafetyValidatorProps) {
  const [validation, setValidation] = useState<ValidationResult>({
    isValid: true,
    violations: [],
    isLoading: false
  });

  const validateContent = async () => {
    if (!content.text && !content.imageUrl) {
      return;
    }

    setValidation(prev => ({ ...prev, isLoading: true }));

    try {
      const response = await fetch('/api/content/moderate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          contentId: `temp-${Date.now()}`,
          contentType: content.imageUrl ? 'image' : 'text',
          content: {
            text: content.text,
            imageUrl: content.imageUrl
          }
        }),
      });

      const data = await response.json();

      if (data.success) {
        const isValid = data.result.approved;
        const violations = data.result.violations || [];
        
        setValidation({
          isValid,
          violations,
          isLoading: false
        });

        onValidation(isValid, violations);
      } else {
        throw new Error(data.error || 'Validation failed');
      }
    } catch (error) {
      console.error('Content validation error:', error);
      setValidation({
        isValid: false,
        violations: ['Content validation failed. Please try again.'],
        isLoading: false
      });
      onValidation(false, ['Content validation failed']);
    }
  };

  // Auto-validate when content changes
  React.useEffect(() => {
    const timeoutId = setTimeout(() => {
      if (content.text || content.imageUrl) {
        validateContent();
      }
    }, 500); // Debounce validation

    return () => clearTimeout(timeoutId);
  }, [content.text, content.imageUrl]);

  if (!showResults) {
    return null;
  }

  return (
    <div className="mt-4">
      {validation.isLoading && (
        <div className="flex items-center space-x-2 text-blue-600">
          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600"></div>
          <span className="text-sm">Validating content safety...</span>
        </div>
      )}

      {!validation.isLoading && validation.isValid && (content.text || content.imageUrl) && (
        <div className="flex items-center space-x-2 text-green-600">
          <CheckCircle className="h-4 w-4" />
          <span className="text-sm">Content passes safety checks</span>
        </div>
      )}

      {!validation.isLoading && !validation.isValid && validation.violations.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center space-x-2 text-red-600">
            <XCircle className="h-4 w-4" />
            <span className="text-sm font-medium">Content safety violations detected:</span>
          </div>
          <ul className="list-disc list-inside space-y-1 text-sm text-red-600 ml-6">
            {validation.violations.map((violation, index) => (
              <li key={index}>{violation}</li>
            ))}
          </ul>
          <div className="bg-red-50 border border-red-200 rounded-md p-3 mt-2">
            <div className="flex items-start space-x-2">
              <AlertTriangle className="h-4 w-4 text-red-500 mt-0.5 flex-shrink-0" />
              <div className="text-sm text-red-700">
                <p className="font-medium">Content Policy Violation</p>
                <p>Please modify your content to comply with our community guidelines. Avoid celebrity names, brand references, and inappropriate content.</p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}