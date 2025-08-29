"use client"

import { useState, useEffect } from 'react'
import Link from 'next/link'
import MainNavigation from '@/components/navigation/main-nav'

interface Creator {
  id: string
  name: string
  status: string
  lora_url?: string
  trigger_word?: string
  createdAt: string
  allow_third_party_stores: boolean
  royalty_bps: number
}

export default function CreatorsPage() {
  const [creators, setCreators] = useState<Creator[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<'all' | 'ready'>('all')

  useEffect(() => {
    async function fetchCreators() {
      try {
        const url = filter === 'ready' ? '/api/creator?ready=true' : '/api/creator'
        const response = await fetch(url)
        if (response.ok) {
          const data = await response.json()
          setCreators(data)
        }
      } catch (error) {
        console.error('Failed to fetch creators:', error)
      } finally {
        setLoading(false)
      }
    }

    fetchCreators()
  }, [filter])

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'READY':
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
            <span className="w-1.5 h-1.5 bg-green-400 rounded-full mr-1.5"></span>
            Ready
          </span>
        )
      case 'TRAINING':
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
            <span className="w-1.5 h-1.5 bg-yellow-400 rounded-full mr-1.5"></span>
            Training
          </span>
        )
      case 'PENDING':
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
            <span className="w-1.5 h-1.5 bg-gray-400 rounded-full mr-1.5"></span>
            Pending
          </span>
        )
      case 'FAILED':
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">
            <span className="w-1.5 h-1.5 bg-red-400 rounded-full mr-1.5"></span>
            Failed
          </span>
        )
      default:
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
            {status}
          </span>
        )
    }
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <MainNavigation />
      
      <main className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
        <div className="px-4 py-6 sm:px-0">
          {/* Header */}
          <div className="mb-8">
            <h1 className="text-3xl font-bold text-gray-900">Creators</h1>
            <p className="mt-2 text-lg text-gray-600">
              Discover creators and generate personalized content using their AI models
            </p>
          </div>

          {/* Filters */}
          <div className="mb-6 flex flex-col sm:flex-row sm:items-center sm:justify-between">
            <div className="flex space-x-4 mb-4 sm:mb-0">
              <button
                onClick={() => setFilter('all')}
                className={`px-4 py-2 text-sm font-medium rounded-md ${
                  filter === 'all'
                    ? 'bg-indigo-100 text-indigo-700'
                    : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                All Creators
              </button>
              <button
                onClick={() => setFilter('ready')}
                className={`px-4 py-2 text-sm font-medium rounded-md ${
                  filter === 'ready'
                    ? 'bg-indigo-100 text-indigo-700'
                    : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                Ready for Generation
              </button>
            </div>
            
            <Link
              href="/creator/new"
              className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700"
            >
              <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
              </svg>
              Become a Creator
            </Link>
          </div>

          {/* Loading state */}
          {loading && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {[...Array(6)].map((_, i) => (
                <div key={i} className="bg-white rounded-lg shadow p-6 animate-pulse">
                  <div className="w-16 h-16 bg-gray-200 rounded-full mx-auto mb-4"></div>
                  <div className="h-4 bg-gray-200 rounded mb-2"></div>
                  <div className="h-3 bg-gray-200 rounded w-2/3 mx-auto mb-4"></div>
                  <div className="h-8 bg-gray-200 rounded"></div>
                </div>
              ))}
            </div>
          )}

          {/* Empty state */}
          {!loading && creators.length === 0 && (
            <div className="text-center py-12">
              <div className="w-16 h-16 bg-gray-200 rounded-full mx-auto mb-4 flex items-center justify-center">
                <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                </svg>
              </div>
              <h3 className="text-lg font-medium text-gray-900 mb-2">
                {filter === 'ready' ? 'No Ready Creators' : 'No Creators Yet'}
              </h3>
              <p className="text-gray-600 mb-6">
                {filter === 'ready' 
                  ? 'No creators have completed LoRA training yet. Check back soon!'
                  : 'Be the first creator to join our platform and start generating personalized content!'
                }
              </p>
              <Link
                href="/creator/new"
                className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700"
              >
                Become a Creator
              </Link>
            </div>
          )}

          {/* Creators grid */}
          {!loading && creators.length > 0 && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {creators.map((creator) => (
                <div key={creator.id} className="bg-white rounded-lg shadow hover:shadow-lg transition-shadow duration-200">
                  <div className="p-6">
                    <div className="text-center mb-4">
                      <div className="w-16 h-16 bg-gradient-to-br from-indigo-400 to-purple-500 rounded-full mx-auto mb-3 flex items-center justify-center">
                        <span className="text-white font-bold text-xl">
                          {creator.name.charAt(0).toUpperCase()}
                        </span>
                      </div>
                      <h3 className="text-lg font-semibold text-gray-900 mb-2">
                        {creator.name}
                      </h3>
                      <div className="mb-3">
                        {getStatusBadge(creator.status)}
                      </div>
                    </div>

                    {creator.trigger_word && (
                      <div className="mb-4">
                        <p className="text-sm text-gray-600 mb-1">Trigger Word:</p>
                        <code className="bg-gray-100 px-2 py-1 rounded text-xs font-mono">
                          {creator.trigger_word}
                        </code>
                      </div>
                    )}

                    <div className="mb-4 text-sm text-gray-600">
                      <div className="flex justify-between items-center mb-1">
                        <span>Royalty Rate:</span>
                        <span className="font-medium">{creator.royalty_bps / 100}%</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span>Third-party Stores:</span>
                        <span className={`font-medium ${creator.allow_third_party_stores ? 'text-green-600' : 'text-red-600'}`}>
                          {creator.allow_third_party_stores ? 'Allowed' : 'Restricted'}
                        </span>
                      </div>
                    </div>

                    <div className="flex space-x-2">
                      <Link
                        href={`/creator/${creator.id}`}
                        className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white text-center py-2 px-4 rounded-md text-sm font-medium"
                      >
                        View Profile
                      </Link>
                      {creator.status === 'READY' && (
                        <Link
                          href={`/creator/${creator.id}/generate`}
                          className="flex-1 bg-green-600 hover:bg-green-700 text-white text-center py-2 px-4 rounded-md text-sm font-medium"
                        >
                          Generate
                        </Link>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </main>
    </div>
  )
}