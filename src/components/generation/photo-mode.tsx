'use client';

import { useState } from 'react';
import { Upload, Image as ImageIcon, Loader2 } from 'lucide-react';
import { ContentSafetyValidator } from '@/components/content/content-safety-validator';

interface PhotoModeProps {
  creatorId: string;
  loraUrl: string;
  triggerWord: string;
  onGenerationStart: (generationId: string) => void;
}

export default function PhotoMode({ 
  creatorId, 
  loraUrl, 
  triggerWord, 
  onGenerationStart 
}: PhotoModeProps) {
  const [sceneImage, setSceneImage] = useState<File | null>(null);
  const [sceneUrl, setSceneUrl] = useState<string>('');
  const [prompt, setPrompt] = useState<string>('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string>('');
  const [isContentValid, setIsContentValid] = useState(true);
  const [contentViolations, setContentViolations] = useState<string[]>([]);

  const handleImageUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      setSceneImage(file);
      const url = URL.createObjectURL(file);
      setPreviewUrl(url);
    }
  };

  const handleUrlChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const url = event.target.value;
    setSceneUrl(url);
    if (url) {
      setPreviewUrl(url);
      setSceneImage(null);
    }
  };

  const handleContentValidation = (isValid: boolean, violations: string[]) => {
    setIsContentValid(isValid);
    setContentViolations(violations);
  };

  const handleGenerate = async () => {
    if (!sceneImage && !sceneUrl) {
      alert('Please upload an image or provide a URL');
      return;
    }

    if (!isContentValid) {
      alert('Please fix content safety violations before generating');
      return;
    }

    setIsGenerating(true);
    
    try {
      const formData = new FormData();
      formData.append('creator_id', creatorId);
      formData.append('mode', 'photo');
      formData.append('prompt', prompt || `${triggerWord} in the scene`);
      formData.append('lora_url', loraUrl);
      
      if (sceneImage) {
        formData.append('scene_image', sceneImage);
      } else if (sceneUrl) {
        formData.append('scene_url', sceneUrl);
      }

      const response = await fetch('/api/infer', {
        method: 'POST',
        body: formData,
      });

      const result = await response.json();

      if (!response.ok) {
        if (result.violations) {
          alert(`Content policy violation: ${result.violations.join(', ')}`);
        } else {
          throw new Error(result.error || 'Generation failed');
        }
        return;
      }
      onGenerationStart(result.generation_id);
      
      // Reset form
      setSceneImage(null);
      setSceneUrl('');
      setPrompt('');
      setPreviewUrl('');
      
    } catch (error) {
      console.error('Generation error:', error);
      alert('Generation failed. Please try again.');
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="text-center">
        <h3 className="text-lg font-semibold mb-2">Photo Mode</h3>
        <p className="text-gray-600">
          Upload a scene image and generate {triggerWord} content within that scene
        </p>
      </div>

      {/* Scene Image Upload */}
      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium mb-2">
            Scene Image
          </label>
          
          {/* File Upload */}
          <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center hover:border-gray-400 transition-colors">
            <input
              type="file"
              accept="image/*"
              onChange={handleImageUpload}
              className="hidden"
              id="scene-upload"
            />
            <label htmlFor="scene-upload" className="cursor-pointer">
              <Upload className="mx-auto h-12 w-12 text-gray-400 mb-2" />
              <p className="text-sm text-gray-600">
                Click to upload or drag and drop
              </p>
              <p className="text-xs text-gray-500 mt-1">
                PNG, JPG, GIF up to 10MB
              </p>
            </label>
          </div>
          
          {/* URL Input */}
          <div className="mt-4">
            <label className="block text-sm font-medium mb-2">
              Or provide image URL
            </label>
            <input
              type="url"
              value={sceneUrl}
              onChange={handleUrlChange}
              placeholder="https://example.com/image.jpg"
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>

        {/* Image Preview */}
        {previewUrl && (
          <div className="mt-4">
            <label className="block text-sm font-medium mb-2">Preview</label>
            <div className="relative w-full max-w-md mx-auto">
              <img
                src={previewUrl}
                alt="Scene preview"
                className="w-full h-48 object-cover rounded-lg border"
              />
            </div>
          </div>
        )}

        {/* Prompt Input */}
        <div>
          <label className="block text-sm font-medium mb-2">
            Additional Prompt (Optional)
          </label>
          <textarea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder={`Describe how ${triggerWord} should appear in the scene...`}
            rows={3}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <p className="text-xs text-gray-500 mt-1">
            Default: "{triggerWord} in the scene"
          </p>
        </div>

        {/* Content Safety Validation */}
        <ContentSafetyValidator
          content={{ 
            text: prompt,
            imageUrl: previewUrl 
          }}
          onValidation={handleContentValidation}
          showResults={(prompt.length > 0 || previewUrl.length > 0)}
        />

        {/* Generate Button */}
        <button
          onClick={handleGenerate}
          disabled={isGenerating || (!sceneImage && !sceneUrl) || !isContentValid}
          className="w-full bg-blue-600 text-white py-3 px-4 rounded-md hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed flex items-center justify-center space-x-2"
        >
          {isGenerating ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              <span>Generating...</span>
            </>
          ) : (
            <>
              <ImageIcon className="h-4 w-4" />
              <span>Generate Photo</span>
            </>
          )}
        </button>
      </div>
    </div>
  );
}