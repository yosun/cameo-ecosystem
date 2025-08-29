'use client';

import { useState, useEffect } from 'react';
import { Clock, CheckCircle, XCircle, Loader2, Download, ShoppingBag } from 'lucide-react';

interface Generation {
  id: string;
  mode: 'photo' | 'text';
  prompt: string;
  scene_url?: string;
  image_url?: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  createdAt: string;
  creator: {
    name: string;
    trigger_word: string;
  };
}

interface GenerationQueueProps {
  userId: string;
  onProductCreate?: (generationId: string) => void;
}

export default function GenerationQueue({ userId, onProductCreate }: GenerationQueueProps) {
  const [generations, setGenerations] = useState<Generation[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchGenerations();
    
    // Poll for updates every 5 seconds
    const interval = setInterval(fetchGenerations, 5000);
    return () => clearInterval(interval);
  }, [userId]);

  const fetchGenerations = async () => {
    try {
      const response = await fetch(`/api/generations?user_id=${userId}`);
      if (response.ok) {
        const data = await response.json();
        setGenerations(data.generations);
      }
    } catch (error) {
      console.error('Failed to fetch generations:', error);
    } finally {
      setLoading(false);
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'pending':
        return <Clock className="h-5 w-5 text-yellow-500" />;
      case 'processing':
        return <Loader2 className="h-5 w-5 text-blue-500 animate-spin" />;
      case 'completed':
        return <CheckCircle className="h-5 w-5 text-green-500" />;
      case 'failed':
        return <XCircle className="h-5 w-5 text-red-500" />;
      default:
        return <Clock className="h-5 w-5 text-gray-500" />;
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'pending':
        return 'Queued';
      case 'processing':
        return 'Generating...';
      case 'completed':
        return 'Complete';
      case 'failed':
        return 'Failed';
      default:
        return 'Unknown';
    }
  };

  const formatTime = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleString();
  };

  const handleDownload = async (imageUrl: string, generationId: string) => {
    try {
      const response = await fetch(imageUrl);
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `generation-${generationId}.jpg`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (error) {
      console.error('Download failed:', error);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-6 w-6 animate-spin text-gray-500" />
        <span className="ml-2 text-gray-600">Loading generations...</span>
      </div>
    );
  }

  if (generations.length === 0) {
    return (
      <div className="text-center py-8">
        <div className="text-gray-500 mb-2">No generations yet</div>
        <p className="text-sm text-gray-400">
          Start generating content to see your queue here
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">Generation Queue</h3>
        <span className="text-sm text-gray-500">
          {generations.filter(g => g.status === 'processing').length} processing
        </span>
      </div>

      <div className="space-y-3">
        {generations.map((generation) => (
          <div
            key={generation.id}
            className="border rounded-lg p-4 bg-white shadow-sm"
          >
            <div className="flex items-start space-x-4">
              {/* Status Icon */}
              <div className="flex-shrink-0 mt-1">
                {getStatusIcon(generation.status)}
              </div>

              {/* Content */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center space-x-2">
                    <span className="text-sm font-medium text-gray-900">
                      {generation.mode === 'photo' ? 'Photo Mode' : 'Text Mode'}
                    </span>
                    <span className="text-xs bg-gray-100 text-gray-600 px-2 py-1 rounded">
                      {generation.creator.name}
                    </span>
                  </div>
                  <span className="text-xs text-gray-500">
                    {formatTime(generation.createdAt)}
                  </span>
                </div>

                <p className="text-sm text-gray-600 mb-2 line-clamp-2">
                  {generation.prompt}
                </p>

                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">
                    Status: {getStatusText(generation.status)}
                  </span>

                  {generation.status === 'completed' && generation.image_url && (
                    <div className="flex space-x-2">
                      <button
                        onClick={() => handleDownload(generation.image_url!, generation.id)}
                        className="text-xs bg-gray-100 hover:bg-gray-200 text-gray-700 px-3 py-1 rounded flex items-center space-x-1"
                      >
                        <Download className="h-3 w-3" />
                        <span>Download</span>
                      </button>
                      {onProductCreate && (
                        <button
                          onClick={() => onProductCreate(generation.id)}
                          className="text-xs bg-blue-100 hover:bg-blue-200 text-blue-700 px-3 py-1 rounded flex items-center space-x-1"
                        >
                          <ShoppingBag className="h-3 w-3" />
                          <span>Create Product</span>
                        </button>
                      )}
                    </div>
                  )}
                </div>
              </div>

              {/* Generated Image Preview */}
              {generation.image_url && (
                <div className="flex-shrink-0">
                  <div className="w-16 h-16 relative">
                    <img
                      src={generation.image_url}
                      alt="Generated content"
                      className="w-full h-full object-cover rounded border"
                    />
                    {/* Watermark indicator */}
                    <div className="absolute inset-0 bg-black bg-opacity-20 rounded flex items-center justify-center">
                      <span className="text-xs text-white font-medium">PREVIEW</span>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}