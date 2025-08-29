'use client';

import { useState, useEffect } from 'react';
import Image from 'next/image';
import { Lock, Unlock, Eye, EyeOff } from 'lucide-react';

interface WatermarkedImageProps {
  generationId: string;
  alt: string;
  className?: string;
  showAccessStatus?: boolean;
  onAccessChange?: (hasAccess: boolean) => void;
}

interface ContentAccess {
  imageUrl: string;
  hasFullAccess: boolean;
}

export function WatermarkedImage({ 
  generationId, 
  alt, 
  className = '',
  showAccessStatus = true,
  onAccessChange
}: WatermarkedImageProps) {
  const [contentAccess, setContentAccess] = useState<ContentAccess | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchContentAccess();
  }, [generationId]);

  const fetchContentAccess = async () => {
    try {
      setIsLoading(true);
      setError(null);

      const response = await fetch(`/api/content/access?generationId=${generationId}`);
      const data = await response.json();

      if (data.success) {
        setContentAccess({
          imageUrl: data.imageUrl,
          hasFullAccess: data.hasFullAccess
        });
        onAccessChange?.(data.hasFullAccess);
      } else {
        throw new Error(data.error || 'Failed to load content');
      }
    } catch (error) {
      console.error('Failed to fetch content access:', error);
      setError('Failed to load image');
    } finally {
      setIsLoading(false);
    }
  };

  if (isLoading) {
    return (
      <div className={`bg-gray-200 animate-pulse rounded-lg flex items-center justify-center ${className}`}>
        <div className="text-gray-500">Loading...</div>
      </div>
    );
  }

  if (error || !contentAccess) {
    return (
      <div className={`bg-red-50 border border-red-200 rounded-lg flex items-center justify-center ${className}`}>
        <div className="text-red-500 text-center p-4">
          <p>{error || 'Failed to load image'}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="relative">
      <div className={`relative overflow-hidden rounded-lg ${className}`}>
        <Image
          src={contentAccess.imageUrl}
          alt={alt}
          fill
          className="object-cover"
          onContextMenu={(e) => {
            // Prevent right-click on watermarked images
            if (!contentAccess.hasFullAccess) {
              e.preventDefault();
            }
          }}
          onDragStart={(e) => {
            // Prevent drag on watermarked images
            if (!contentAccess.hasFullAccess) {
              e.preventDefault();
            }
          }}
        />
        
        {/* Watermark overlay for preview images */}
        {!contentAccess.hasFullAccess && (
          <div className="absolute inset-0 bg-black bg-opacity-20 flex items-center justify-center">
            <div className="bg-white bg-opacity-90 px-4 py-2 rounded-lg shadow-lg">
              <div className="flex items-center space-x-2 text-gray-800">
                <Lock className="h-5 w-5" />
                <span className="font-medium">PREVIEW</span>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Access status indicator */}
      {showAccessStatus && (
        <div className="absolute top-2 right-2">
          <div className={`flex items-center space-x-1 px-2 py-1 rounded-full text-xs font-medium ${
            contentAccess.hasFullAccess 
              ? 'bg-green-100 text-green-800' 
              : 'bg-yellow-100 text-yellow-800'
          }`}>
            {contentAccess.hasFullAccess ? (
              <>
                <Unlock className="h-3 w-3" />
                <span>Full Access</span>
              </>
            ) : (
              <>
                <Eye className="h-3 w-3" />
                <span>Preview</span>
              </>
            )}
          </div>
        </div>
      )}

      {/* Content protection notice */}
      {!contentAccess.hasFullAccess && (
        <div className="mt-2 text-xs text-gray-500 text-center">
          <p>Purchase to remove watermark and get full resolution</p>
        </div>
      )}
    </div>
  );
}