'use client';

import { useState, useEffect } from 'react';
import { CheckCircle, XCircle, AlertTriangle, Eye, Clock } from 'lucide-react';
import Image from 'next/image';

interface ModerationItem {
  id: string;
  type: string;
  content: {
    prompt?: string;
    imageUrl?: string;
    mode?: string;
  };
  status: string;
  createdAt: string;
  userId: string;
  creatorId?: string;
}

interface ModerationQueue {
  items: ModerationItem[];
  total: number;
}

export function ModerationDashboard() {
  const [queue, setQueue] = useState<ModerationQueue>({ items: [], total: 0 });
  const [isLoading, setIsLoading] = useState(true);
  const [selectedItem, setSelectedItem] = useState<ModerationItem | null>(null);
  const [reviewReason, setReviewReason] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);

  useEffect(() => {
    fetchModerationQueue();
  }, []);

  const fetchModerationQueue = async () => {
    try {
      setIsLoading(true);
      const response = await fetch('/api/admin/moderation');
      const data = await response.json();

      if (data.success) {
        setQueue({
          items: data.items,
          total: data.total
        });
      }
    } catch (error) {
      console.error('Failed to fetch moderation queue:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const processReview = async (contentId: string, approved: boolean) => {
    if (!reviewReason.trim()) {
      alert('Please provide a reason for your decision');
      return;
    }

    try {
      setIsProcessing(true);
      const response = await fetch('/api/admin/moderation', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          contentId,
          approved,
          reason: reviewReason
        }),
      });

      const data = await response.json();

      if (data.success) {
        // Remove item from queue
        setQueue(prev => ({
          ...prev,
          items: prev.items.filter(item => item.id !== contentId),
          total: prev.total - 1
        }));
        setSelectedItem(null);
        setReviewReason('');
      } else {
        throw new Error(data.error);
      }
    } catch (error) {
      console.error('Failed to process review:', error);
      alert('Failed to process review. Please try again.');
    } finally {
      setIsProcessing(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-gray-900">Content Moderation</h2>
        <div className="flex items-center space-x-2 text-sm text-gray-600">
          <Clock className="h-4 w-4" />
          <span>{queue.total} items pending review</span>
        </div>
      </div>

      {queue.items.length === 0 ? (
        <div className="text-center py-12">
          <CheckCircle className="h-12 w-12 text-green-500 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">All caught up!</h3>
          <p className="text-gray-600">No content pending moderation review.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Queue List */}
          <div className="space-y-4">
            <h3 className="text-lg font-medium text-gray-900">Pending Reviews</h3>
            <div className="space-y-3">
              {queue.items.map((item) => (
                <div
                  key={item.id}
                  className={`border rounded-lg p-4 cursor-pointer transition-colors ${
                    selectedItem?.id === item.id
                      ? 'border-blue-500 bg-blue-50'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                  onClick={() => setSelectedItem(item)}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center space-x-2 mb-2">
                        <AlertTriangle className="h-4 w-4 text-yellow-500" />
                        <span className="text-sm font-medium text-gray-900">
                          {item.type} - {item.content.mode}
                        </span>
                      </div>
                      {item.content.prompt && (
                        <p className="text-sm text-gray-600 mb-2 line-clamp-2">
                          {item.content.prompt}
                        </p>
                      )}
                      <div className="text-xs text-gray-500">
                        {new Date(item.createdAt).toLocaleString()}
                      </div>
                    </div>
                    {item.content.imageUrl && (
                      <div className="ml-4 w-16 h-16 relative rounded-lg overflow-hidden">
                        <Image
                          src={item.content.imageUrl}
                          alt="Content preview"
                          fill
                          className="object-cover"
                        />
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Review Panel */}
          <div className="space-y-4">
            <h3 className="text-lg font-medium text-gray-900">Review Details</h3>
            {selectedItem ? (
              <div className="border rounded-lg p-6 space-y-4">
                <div>
                  <h4 className="font-medium text-gray-900 mb-2">Content Details</h4>
                  <div className="space-y-2 text-sm">
                    <div><strong>Type:</strong> {selectedItem.type}</div>
                    <div><strong>Mode:</strong> {selectedItem.content.mode}</div>
                    <div><strong>Created:</strong> {new Date(selectedItem.createdAt).toLocaleString()}</div>
                    <div><strong>User ID:</strong> {selectedItem.userId}</div>
                    {selectedItem.creatorId && (
                      <div><strong>Creator ID:</strong> {selectedItem.creatorId}</div>
                    )}
                  </div>
                </div>

                {selectedItem.content.prompt && (
                  <div>
                    <h4 className="font-medium text-gray-900 mb-2">Prompt</h4>
                    <p className="text-sm text-gray-700 bg-gray-50 p-3 rounded">
                      {selectedItem.content.prompt}
                    </p>
                  </div>
                )}

                {selectedItem.content.imageUrl && (
                  <div>
                    <h4 className="font-medium text-gray-900 mb-2">Generated Image</h4>
                    <div className="relative w-full h-64 rounded-lg overflow-hidden">
                      <Image
                        src={selectedItem.content.imageUrl}
                        alt="Generated content"
                        fill
                        className="object-contain"
                      />
                    </div>
                  </div>
                )}

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Review Reason
                  </label>
                  <textarea
                    value={reviewReason}
                    onChange={(e) => setReviewReason(e.target.value)}
                    placeholder="Explain your decision..."
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    rows={3}
                  />
                </div>

                <div className="flex space-x-3">
                  <button
                    onClick={() => processReview(selectedItem.id, true)}
                    disabled={isProcessing || !reviewReason.trim()}
                    className="flex-1 flex items-center justify-center space-x-2 px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <CheckCircle className="h-4 w-4" />
                    <span>Approve</span>
                  </button>
                  <button
                    onClick={() => processReview(selectedItem.id, false)}
                    disabled={isProcessing || !reviewReason.trim()}
                    className="flex-1 flex items-center justify-center space-x-2 px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <XCircle className="h-4 w-4" />
                    <span>Reject</span>
                  </button>
                </div>
              </div>
            ) : (
              <div className="border rounded-lg p-6 text-center text-gray-500">
                <Eye className="h-8 w-8 mx-auto mb-2" />
                <p>Select an item from the queue to review</p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}