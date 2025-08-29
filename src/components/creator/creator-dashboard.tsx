'use client';

import { Creator, LoRAStatus } from '@prisma/client';
import { useState } from 'react';
import Link from 'next/link';

interface CreatorDashboardProps {
  creator: Creator;
}

export default function CreatorDashboard({ creator }: CreatorDashboardProps) {
  const [isRefreshing, setIsRefreshing] = useState(false);

  const getStatusColor = (status: LoRAStatus) => {
    switch (status) {
      case LoRAStatus.PENDING:
        return 'bg-yellow-100 text-yellow-800';
      case LoRAStatus.TRAINING:
        return 'bg-blue-100 text-blue-800';
      case LoRAStatus.READY:
        return 'bg-green-100 text-green-800';
      case LoRAStatus.FAILED:
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const getStatusIcon = (status: LoRAStatus) => {
    switch (status) {
      case LoRAStatus.PENDING:
        return (
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        );
      case LoRAStatus.TRAINING:
        return (
          <svg className="w-5 h-5 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
        );
      case LoRAStatus.READY:
        return (
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        );
      case LoRAStatus.FAILED:
        return (
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        );
      default:
        return null;
    }
  };

  const handleRefreshStatus = async () => {
    setIsRefreshing(true);
    try {
      // This would typically call an API to refresh the status
      await fetch(`/api/creator/${creator.id}/status`, {
        method: 'POST',
      });
      // Refresh the page or update state
      window.location.reload();
    } catch (error) {
      console.error('Failed to refresh status:', error);
    } finally {
      setIsRefreshing(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="bg-white shadow-sm rounded-lg p-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">{creator.name}</h1>
            <p className="text-sm text-gray-600">{creator.email}</p>
          </div>
          <Link
            href={`/creator/${creator.id}/edit`}
            className="px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
          >
            Edit Profile
          </Link>
        </div>
      </div>

      {/* LoRA Status */}
      <div className="bg-white shadow-sm rounded-lg p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-medium text-gray-900">LoRA Training Status</h2>
          <button
            onClick={handleRefreshStatus}
            disabled={isRefreshing}
            className="px-3 py-1 text-sm border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50"
          >
            {isRefreshing ? 'Refreshing...' : 'Refresh'}
          </button>
        </div>

        <div className="flex items-center space-x-3 mb-4">
          <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${getStatusColor(creator.status)}`}>
            {getStatusIcon(creator.status)}
            <span className="ml-2 capitalize">{creator.status.toLowerCase()}</span>
          </span>
        </div>

        {creator.status === LoRAStatus.PENDING && (
          <div className="bg-yellow-50 border border-yellow-200 rounded-md p-4">
            <div className="flex">
              <div className="flex-shrink-0">
                <svg className="h-5 w-5 text-yellow-400" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                </svg>
              </div>
              <div className="ml-3">
                <h3 className="text-sm font-medium text-yellow-800">Training Queued</h3>
                <div className="mt-2 text-sm text-yellow-700">
                  <p>Your LoRA training has been queued and will start shortly. This typically takes 10-15 minutes.</p>
                </div>
              </div>
            </div>
          </div>
        )}

        {creator.status === LoRAStatus.TRAINING && (
          <div className="bg-blue-50 border border-blue-200 rounded-md p-4">
            <div className="flex">
              <div className="flex-shrink-0">
                <svg className="h-5 w-5 text-blue-400 animate-spin" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M4 2a1 1 0 011 1v2.101a7.002 7.002 0 0111.601 2.566 1 1 0 11-1.885.666A5.002 5.002 0 005.999 7H9a1 1 0 010 2H4a1 1 0 01-1-1V3a1 1 0 011-1zm.008 9.057a1 1 0 011.276.61A5.002 5.002 0 0014.001 13H11a1 1 0 110-2h5a1 1 0 011 1v5a1 1 0 11-2 0v-2.101a7.002 7.002 0 01-11.601-2.566 1 1 0 01.61-1.276z" clipRule="evenodd" />
                </svg>
              </div>
              <div className="ml-3">
                <h3 className="text-sm font-medium text-blue-800">Training in Progress</h3>
                <div className="mt-2 text-sm text-blue-700">
                  <p>Your LoRA model is currently being trained. This process typically takes 10-15 minutes.</p>
                  {creator.fal_job_id && (
                    <p className="mt-1">Job ID: <code className="text-xs bg-blue-100 px-1 rounded">{creator.fal_job_id}</code></p>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {creator.status === LoRAStatus.READY && (
          <div className="bg-green-50 border border-green-200 rounded-md p-4">
            <div className="flex">
              <div className="flex-shrink-0">
                <svg className="h-5 w-5 text-green-400" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                </svg>
              </div>
              <div className="ml-3 flex-1">
                <h3 className="text-sm font-medium text-green-800">LoRA Ready!</h3>
                <div className="mt-2 text-sm text-green-700">
                  <p>Your LoRA model has been successfully trained and is ready for content generation.</p>
                  {creator.trigger_word && (
                    <p className="mt-1">
                      <strong>Trigger word:</strong> <code className="text-xs bg-green-100 px-1 rounded">{creator.trigger_word}</code>
                    </p>
                  )}
                </div>
                <div className="mt-4 flex space-x-3">
                  <Link
                    href={`/creator/${creator.id}/generate`}
                    className="inline-flex items-center px-3 py-2 border border-transparent text-sm leading-4 font-medium rounded-md text-white bg-green-600 hover:bg-green-700"
                  >
                    Start Generating
                  </Link>
                  <Link
                    href={`/workflow?creator=${creator.id}`}
                    className="inline-flex items-center px-3 py-2 border border-green-300 text-sm leading-4 font-medium rounded-md text-green-700 bg-white hover:bg-green-50"
                  >
                    View Workflow
                  </Link>
                </div>
              </div>
            </div>
          </div>
        )}

        {creator.status === LoRAStatus.FAILED && (
          <div className="bg-red-50 border border-red-200 rounded-md p-4">
            <div className="flex">
              <div className="flex-shrink-0">
                <svg className="h-5 w-5 text-red-400" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                </svg>
              </div>
              <div className="ml-3">
                <h3 className="text-sm font-medium text-red-800">Training Failed</h3>
                <div className="mt-2 text-sm text-red-700">
                  <p>Unfortunately, your LoRA training failed. Please try uploading different images or contact support.</p>
                  <div className="mt-3">
                    <Link
                      href={`/creator/${creator.id}/retrain`}
                      className="text-sm font-medium text-red-600 hover:text-red-500"
                    >
                      Try again with new images →
                    </Link>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Licensing Settings */}
      <div className="bg-white shadow-sm rounded-lg p-6">
        <h2 className="text-lg font-medium text-gray-900 mb-4">Licensing Settings</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <dt className="text-sm font-medium text-gray-500">Royalty Rate</dt>
            <dd className="mt-1 text-sm text-gray-900">{creator.royalty_bps / 100}%</dd>
          </div>
          <div>
            <dt className="text-sm font-medium text-gray-500">Minimum Price</dt>
            <dd className="mt-1 text-sm text-gray-900">${(creator.min_price_cents / 100).toFixed(2)}</dd>
          </div>
          <div>
            <dt className="text-sm font-medium text-gray-500">Maximum Discount</dt>
            <dd className="mt-1 text-sm text-gray-900">{creator.max_discount_bps / 100}%</dd>
          </div>
          <div>
            <dt className="text-sm font-medium text-gray-500">Third-party Stores</dt>
            <dd className="mt-1 text-sm text-gray-900">
              {creator.allow_third_party_stores ? 'Allowed' : 'Not Allowed'}
            </dd>
          </div>
        </div>
      </div>

      {/* Quick Actions */}
      {creator.status === LoRAStatus.READY && (
        <div className="bg-white shadow-sm rounded-lg p-6">
          <h2 className="text-lg font-medium text-gray-900 mb-4">Quick Actions</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <Link
              href={`/creator/${creator.id}/generate`}
              className="flex items-center p-4 bg-indigo-50 rounded-lg hover:bg-indigo-100 transition-colors"
            >
              <div className="w-10 h-10 bg-indigo-100 rounded-lg flex items-center justify-center mr-3">
                <svg className="w-5 h-5 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
              </div>
              <div>
                <p className="font-medium text-gray-900">Generate Content</p>
                <p className="text-sm text-gray-600">Create AI content</p>
              </div>
            </Link>
            
            <Link
              href={`/creator/${creator.id}/licensing`}
              className="flex items-center p-4 bg-green-50 rounded-lg hover:bg-green-100 transition-colors"
            >
              <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center mr-3">
                <svg className="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                </svg>
              </div>
              <div>
                <p className="font-medium text-gray-900">Licensing</p>
                <p className="text-sm text-gray-600">Manage royalties</p>
              </div>
            </Link>
            
            <Link
              href="/stores"
              className="flex items-center p-4 bg-blue-50 rounded-lg hover:bg-blue-100 transition-colors"
            >
              <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center mr-3">
                <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" />
                </svg>
              </div>
              <div>
                <p className="font-medium text-gray-900">Browse Stores</p>
                <p className="text-sm text-gray-600">See your products</p>
              </div>
            </Link>
            
            <Link
              href={`/workflow?creator=${creator.id}`}
              className="flex items-center p-4 bg-purple-50 rounded-lg hover:bg-purple-100 transition-colors"
            >
              <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center mr-3">
                <svg className="w-5 h-5 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
              </div>
              <div>
                <p className="font-medium text-gray-900">Workflow Guide</p>
                <p className="text-sm text-gray-600">Step-by-step</p>
              </div>
            </Link>
          </div>
        </div>
      )}

      {/* Training Images */}
      <div className="bg-white shadow-sm rounded-lg p-6">
        <h2 className="text-lg font-medium text-gray-900 mb-4">Training Images</h2>
        {creator.training_images.length > 0 ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
            {creator.training_images.map((imageUrl, index) => (
              <div key={index} className="relative">
                <img
                  src={imageUrl}
                  alt={`Training image ${index + 1}`}
                  className="w-full h-24 object-cover rounded-lg border border-gray-200"
                />
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-gray-500">No training images uploaded.</p>
        )}
      </div>
    </div>
  );
}