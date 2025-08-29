'use client';

import { useState } from 'react';
import { Type, Loader2, Sparkles } from 'lucide-react';
import { ContentSafetyValidator } from '@/components/content/content-safety-validator';

interface TextModeProps {
  creatorId: string;
  loraUrl: string;
  triggerWord: string;
  onGenerationStart: (generationId: string) => void;
}

export default function TextMode({ 
  creatorId, 
  loraUrl, 
  triggerWord, 
  onGenerationStart 
}: TextModeProps) {
  const [prompt, setPrompt] = useState<string>('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [isContentValid, setIsContentValid] = useState(true);
  const [contentViolations, setContentViolations] = useState<string[]>([]);

  const promptSuggestions = [
    `${triggerWord} sitting in a cozy coffee shop`,
    `${triggerWord} walking through a magical forest`,
    `${triggerWord} as a superhero saving the day`,
    `${triggerWord} in a futuristic cyberpunk city`,
    `${triggerWord} painting a masterpiece in an art studio`,
    `${triggerWord} cooking in a professional kitchen`,
  ];

  const handleSuggestionClick = (suggestion: string) => {
    setPrompt(suggestion);
  };

  const handleContentValidation = (isValid: boolean, violations: string[]) => {
    setIsContentValid(isValid);
    setContentViolations(violations);
  };

  const handleGenerate = async () => {
    if (!prompt.trim()) {
      alert('Please enter a prompt');
      return;
    }

    if (!isContentValid) {
      alert('Please fix content safety violations before generating');
      return;
    }

    setIsGenerating(true);
    
    try {
      const response = await fetch('/api/generate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          creator_id: creatorId,
          mode: 'text',
          prompt: prompt.trim(),
          lora_url: loraUrl,
        }),
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
      setPrompt('');
      
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
        <h3 className="text-lg font-semibold mb-2">Text Mode</h3>
        <p className="text-gray-600">
          Describe a scene and generate {triggerWord} content from your imagination
        </p>
      </div>

      {/* Prompt Input */}
      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium mb-2">
            Describe your scene
          </label>
          <textarea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder={`Describe a scene with ${triggerWord}...`}
            rows={4}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <p className="text-xs text-gray-500 mt-1">
            Be descriptive! Include details about the setting, mood, and what {triggerWord} is doing.
          </p>
        </div>

        {/* Prompt Suggestions */}
        <div>
          <label className="block text-sm font-medium mb-2">
            <Sparkles className="inline h-4 w-4 mr-1" />
            Suggestions
          </label>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
            {promptSuggestions.map((suggestion, index) => (
              <button
                key={index}
                onClick={() => handleSuggestionClick(suggestion)}
                className="text-left p-3 text-sm bg-gray-50 hover:bg-gray-100 rounded-md border transition-colors"
              >
                {suggestion}
              </button>
            ))}
          </div>
        </div>

        {/* Character Count */}
        <div className="text-right">
          <span className={`text-xs ${prompt.length > 500 ? 'text-red-500' : 'text-gray-500'}`}>
            {prompt.length}/500 characters
          </span>
        </div>

        {/* Content Safety Validation */}
        <ContentSafetyValidator
          content={{ text: prompt }}
          onValidation={handleContentValidation}
          showResults={prompt.length > 0}
        />

        {/* Generate Button */}
        <button
          onClick={handleGenerate}
          disabled={isGenerating || !prompt.trim() || prompt.length > 500 || !isContentValid}
          className="w-full bg-purple-600 text-white py-3 px-4 rounded-md hover:bg-purple-700 disabled:bg-gray-400 disabled:cursor-not-allowed flex items-center justify-center space-x-2"
        >
          {isGenerating ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              <span>Generating...</span>
            </>
          ) : (
            <>
              <Type className="h-4 w-4" />
              <span>Generate from Text</span>
            </>
          )}
        </button>
      </div>

      {/* Tips */}
      <div className="bg-blue-50 p-4 rounded-md">
        <h4 className="font-medium text-blue-900 mb-2">💡 Tips for better results:</h4>
        <ul className="text-sm text-blue-800 space-y-1">
          <li>• Be specific about the setting and environment</li>
          <li>• Include lighting and mood descriptions</li>
          <li>• Mention what {triggerWord} is wearing or doing</li>
          <li>• Use descriptive adjectives for better quality</li>
        </ul>
      </div>
    </div>
  );
}