'use client';

import { useState } from 'react';
import { Camera, Type } from 'lucide-react';
import PhotoMode from './photo-mode';
import TextMode from './text-mode';
import GenerationQueue from './generation-queue';

interface Creator {
  id: string;
  name: string;
  lora_url: string;
  trigger_word: string;
  status: string;
}

interface GenerationInterfaceProps {
  creator: Creator;
  userId: string;
}

export default function GenerationInterface({ creator, userId }: GenerationInterfaceProps) {
  const [activeMode, setActiveMode] = useState<'photo' | 'text'>('photo');
  const [refreshQueue, setRefreshQueue] = useState(0);

  const handleGenerationStart = (generationId: string) => {
    // Trigger queue refresh
    setRefreshQueue(prev => prev + 1);
  };

  const handleProductCreate = (generationId: string) => {
    // Navigate to product creation page
    window.location.href = `/generation/${generationId}/create-product`;
  };

  if (creator.status !== 'READY') {
    return (
      <div className="text-center py-12">
        <div className="text-gray-500 mb-4">
          {creator.status === 'TRAINING' && 'LoRA is still training...'}
          {creator.status === 'PENDING' && 'LoRA training not started'}
          {creator.status === 'FAILED' && 'LoRA training failed'}
        </div>
        <p className="text-sm text-gray-400">
          Generation will be available once the LoRA is ready
        </p>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      {/* Creator Info */}
      <div className="text-center">
        <h2 className="text-2xl font-bold mb-2">Generate with {creator.name}</h2>
        <p className="text-gray-600">
          Trigger word: <span className="font-mono bg-gray-100 px-2 py-1 rounded">{creator.trigger_word}</span>
        </p>
      </div>

      {/* Mode Selector */}
      <div className="flex justify-center">
        <div className="bg-gray-100 p-1 rounded-lg">
          <button
            onClick={() => setActiveMode('photo')}
            className={`flex items-center space-x-2 px-4 py-2 rounded-md transition-colors ${
              activeMode === 'photo'
                ? 'bg-white text-blue-600 shadow-sm'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            <Camera className="h-4 w-4" />
            <span>Photo Mode</span>
          </button>
          <button
            onClick={() => setActiveMode('text')}
            className={`flex items-center space-x-2 px-4 py-2 rounded-md transition-colors ${
              activeMode === 'text'
                ? 'bg-white text-purple-600 shadow-sm'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            <Type className="h-4 w-4" />
            <span>Text Mode</span>
          </button>
        </div>
      </div>

      {/* Generation Interface */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Generation Form */}
        <div className="bg-white p-6 rounded-lg border shadow-sm">
          {activeMode === 'photo' ? (
            <PhotoMode
              creatorId={creator.id}
              loraUrl={creator.lora_url}
              triggerWord={creator.trigger_word}
              onGenerationStart={handleGenerationStart}
            />
          ) : (
            <TextMode
              creatorId={creator.id}
              loraUrl={creator.lora_url}
              triggerWord={creator.trigger_word}
              onGenerationStart={handleGenerationStart}
            />
          )}
        </div>

        {/* Generation Queue */}
        <div className="bg-white p-6 rounded-lg border shadow-sm">
          <GenerationQueue
            userId={userId}
            onProductCreate={handleProductCreate}
            key={refreshQueue} // Force re-render when new generation starts
          />
        </div>
      </div>
    </div>
  );
}