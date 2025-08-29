"use client"

import { useState, useEffect } from 'react'
import Link from 'next/link'
import Image from 'next/image'

interface Creator {
  id: string
  name: string
  status: string
  lora_url?: string
  trigger_word?: string
}

interface Generation {
  id: string
  creator_id: string
  mode: string
  prompt?: string
  scene_url?: string
  image_url?: string
  status: string
  creator: Creator
}

interface GenerationFlowProps {
  creatorId?: string
  generationId?: string
}

export default function GenerationFlow({ creatorId, generationId }: GenerationFlowProps) {
  const [currentStep, setCurrentStep] = useState(1)
  const [selectedCreator, setSelectedCreator] = useState<Creator | null>(null)
  const [generations, setGenerations] = useState<Generation[]>([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (creatorId) {
      fetchCreator(creatorId)
      setCurrentStep(2)
    }
  }, [creatorId])

  useEffect(() => {
    if (generationId) {
      fetchGeneration(generationId)
      setCurrentStep(3)
    }
  }, [generationId])

  const fetchCreator = async (id: string) => {
    try {
      const response = await fetch(`/api/creator/${id}`)
      if (response.ok) {
        const creator = await response.json()
        setSelectedCreator(creator)
      }
    } catch (error) {
      console.error('Failed to fetch creator:', error)
    }
  }

  const fetchGeneration = async (id: string) => {
    try {
      const response = await fetch(`/api/generations/${id}`)
      if (response.ok) {
        const generation = await response.json()
        setGenerations([generation])
        setSelectedCreator(generation.creator)
      }
    } catch (error) {
      console.error('Failed to fetch generation:', error)
    }
  }

  const steps = [
    {
      id: 1,
      name: 'Select Creator',
      description: 'Choose a creator with a trained LoRA model',
      completed: currentStep > 1,
      current: currentStep === 1,
    },
    {
      id: 2,
      name: 'Generate Content',
      description: 'Create personalized content using AI',
      completed: currentStep > 2,
      current: currentStep === 2,
    },
    {
      id: 3,
      name: 'Create Products',
      description: 'Transform content into merchandise',
      completed: currentStep > 3,
      current: currentStep === 3,
    },
    {
      id: 4,
      name: 'Shop & Purchase',
      description: 'Browse stores and complete purchase',
      completed: currentStep > 4,
      current: currentStep === 4,
    },
  ]

  return (
    <div className="max-w-4xl mx-auto">
      {/* Progress Steps */}
      <div className="mb-8">
        <nav aria-label="Progress">
          <ol className="flex items-center">
            {steps.map((step, stepIdx) => (
              <li key={step.name} className={`${stepIdx !== steps.length - 1 ? 'pr-8 sm:pr-20' : ''} relative`}>
                <div className="flex items-center">
                  <div className="relative flex h-8 w-8 items-center justify-center">
                    {step.completed ? (
                      <div className="h-8 w-8 rounded-full bg-indigo-600 flex items-center justify-center">
                        <svg className="h-5 w-5 text-white" viewBox="0 0 20 20" fill="currentColor">
                          <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                        </svg>
                      </div>
                    ) : step.current ? (
                      <div className="h-8 w-8 rounded-full border-2 border-indigo-600 bg-white flex items-center justify-center">
                        <span className="text-indigo-600 font-medium text-sm">{step.id}</span>
                      </div>
                    ) : (
                      <div className="h-8 w-8 rounded-full border-2 border-gray-300 bg-white flex items-center justify-center">
                        <span className="text-gray-500 font-medium text-sm">{step.id}</span>
                      </div>
                    )}
                  </div>
                  <div className="ml-4 min-w-0 flex-1">
                    <p className={`text-sm font-medium ${step.current ? 'text-indigo-600' : step.completed ? 'text-gray-900' : 'text-gray-500'}`}>
                      {step.name}
                    </p>
                    <p className="text-sm text-gray-500">{step.description}</p>
                  </div>
                </div>
                {stepIdx !== steps.length - 1 && (
                  <div className="absolute top-4 left-4 -ml-px mt-0.5 h-full w-0.5 bg-gray-300" aria-hidden="true" />
                )}
              </li>
            ))}
          </ol>
        </nav>
      </div>

      {/* Step Content */}
      <div className="bg-white rounded-lg shadow p-6">
        {currentStep === 1 && (
          <div>
            <h2 className="text-2xl font-bold text-gray-900 mb-4">Select a Creator</h2>
            <p className="text-gray-600 mb-6">
              Choose from our featured creators who have trained LoRA models ready for content generation.
            </p>
            <div className="flex justify-center">
              <Link
                href="/creators"
                className="bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-3 rounded-lg font-medium"
              >
                Browse Creators
              </Link>
            </div>
          </div>
        )}

        {currentStep === 2 && selectedCreator && (
          <div>
            <h2 className="text-2xl font-bold text-gray-900 mb-4">Generate Content</h2>
            <div className="bg-gray-50 rounded-lg p-4 mb-6">
              <div className="flex items-center">
                <div className="w-12 h-12 bg-gradient-to-br from-indigo-400 to-purple-500 rounded-full flex items-center justify-center mr-4">
                  <span className="text-white font-bold">
                    {selectedCreator.name.charAt(0).toUpperCase()}
                  </span>
                </div>
                <div>
                  <h3 className="font-semibold text-gray-900">{selectedCreator.name}</h3>
                  {selectedCreator.trigger_word && (
                    <p className="text-sm text-gray-600">
                      Trigger: <code className="bg-gray-200 px-2 py-1 rounded text-xs">{selectedCreator.trigger_word}</code>
                    </p>
                  )}
                </div>
              </div>
            </div>
            <p className="text-gray-600 mb-6">
              Use Photo Mode to upload a scene or Text Mode to describe what you want to generate.
            </p>
            <div className="flex justify-center">
              <Link
                href={`/creator/${selectedCreator.id}/generate`}
                className="bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-3 rounded-lg font-medium"
              >
                Start Generating
              </Link>
            </div>
          </div>
        )}

        {currentStep === 3 && generations.length > 0 && (
          <div>
            <h2 className="text-2xl font-bold text-gray-900 mb-4">Create Products</h2>
            <p className="text-gray-600 mb-6">
              Transform your generated content into physical merchandise like postcards, shirts, and more.
            </p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {generations.map((generation) => (
                <div key={generation.id} className="border rounded-lg p-4">
                  {generation.image_url && (
                    <div className="aspect-square bg-gray-100 rounded-lg mb-4 relative overflow-hidden">
                      <Image
                        src={generation.image_url}
                        alt="Generated content"
                        fill
                        className="object-cover"
                      />
                    </div>
                  )}
                  <div className="flex justify-between items-center">
                    <div>
                      <p className="font-medium text-gray-900">Generated Content</p>
                      <p className="text-sm text-gray-600">{generation.mode} Mode</p>
                    </div>
                    <Link
                      href={`/generation/${generation.id}/create-product`}
                      className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-md text-sm font-medium"
                    >
                      Create Product
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {currentStep === 4 && (
          <div>
            <h2 className="text-2xl font-bold text-gray-900 mb-4">Shop & Purchase</h2>
            <p className="text-gray-600 mb-6">
              Browse available stores and complete your purchase. Creators automatically receive royalties.
            </p>
            <div className="flex justify-center">
              <Link
                href="/stores"
                className="bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-3 rounded-lg font-medium"
              >
                Browse Stores
              </Link>
            </div>
          </div>
        )}
      </div>

      {/* Quick Actions */}
      <div className="mt-8 bg-gray-50 rounded-lg p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Quick Actions</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <Link
            href="/creators"
            className="flex items-center p-3 bg-white rounded-lg hover:bg-gray-50 transition-colors"
          >
            <div className="w-8 h-8 bg-purple-100 rounded-lg flex items-center justify-center mr-3">
              <svg className="w-4 h-4 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
              </svg>
            </div>
            <span className="text-sm font-medium text-gray-900">Browse Creators</span>
          </Link>
          
          <Link
            href="/stores"
            className="flex items-center p-3 bg-white rounded-lg hover:bg-gray-50 transition-colors"
          >
            <div className="w-8 h-8 bg-green-100 rounded-lg flex items-center justify-center mr-3">
              <svg className="w-4 h-4 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" />
              </svg>
            </div>
            <span className="text-sm font-medium text-gray-900">Browse Stores</span>
          </Link>
          
          <Link
            href="/creator/new"
            className="flex items-center p-3 bg-white rounded-lg hover:bg-gray-50 transition-colors"
          >
            <div className="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center mr-3">
              <svg className="w-4 h-4 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
              </svg>
            </div>
            <span className="text-sm font-medium text-gray-900">Become Creator</span>
          </Link>
          
          <Link
            href="/store/new"
            className="flex items-center p-3 bg-white rounded-lg hover:bg-gray-50 transition-colors"
          >
            <div className="w-8 h-8 bg-yellow-100 rounded-lg flex items-center justify-center mr-3">
              <svg className="w-4 h-4 text-yellow-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
              </svg>
            </div>
            <span className="text-sm font-medium text-gray-900">Open Store</span>
          </Link>
        </div>
      </div>
    </div>
  )
}