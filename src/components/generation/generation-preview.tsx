"use client"

import { useState } from 'react'
import Link from 'next/link'
import Image from 'next/image'

interface Generation {
  id: string
  creator_id: string
  mode: string
  prompt?: string
  scene_url?: string
  image_url?: string
  status: string
  creator: {
    id: string
    name: string
    trigger_word?: string
  }
}

interface Product {
  id: string
  type: string
  name: string
  description: string
  price_cents: number
  preview_url?: string
}

interface GenerationPreviewProps {
  generation: Generation
}

export default function GenerationPreview({ generation }: GenerationPreviewProps) {
  const [selectedProduct, setSelectedProduct] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const productTypes = [
    {
      id: 'postcard',
      name: 'Postcard',
      description: 'High-quality printed postcard',
      price_cents: 500,
      icon: (
        <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 4.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
        </svg>
      ),
    },
    {
      id: 'shirt',
      name: 'T-Shirt',
      description: 'Premium cotton t-shirt',
      price_cents: 2500,
      icon: (
        <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
        </svg>
      ),
    },
    {
      id: 'sticker',
      name: 'Sticker',
      description: 'Waterproof vinyl sticker',
      price_cents: 300,
      icon: (
        <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
        </svg>
      ),
    },
    {
      id: 'figurine',
      name: 'Figurine',
      description: '3D printed figurine',
      price_cents: 4500,
      icon: (
        <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
        </svg>
      ),
    },
  ]

  const handleCreateProduct = async (productType: string) => {
    setLoading(true)
    try {
      const response = await fetch('/api/product', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          generation_id: generation.id,
          creator_id: generation.creator_id,
          product_type: productType,
          price_cents: productTypes.find(p => p.id === productType)?.price_cents || 500,
        }),
      })

      if (response.ok) {
        const product = await response.json()
        // Redirect to product page or show success
        window.location.href = `/product/${product.id}`
      } else {
        console.error('Failed to create product')
      }
    } catch (error) {
      console.error('Error creating product:', error)
    } finally {
      setLoading(false)
    }
  }

  const formatPrice = (cents: number) => {
    return `$${(cents / 100).toFixed(2)}`
  }

  return (
    <div className="max-w-6xl mx-auto">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Generated Content */}
        <div>
          <div className="bg-white rounded-lg shadow-lg overflow-hidden">
            <div className="p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-2xl font-bold text-gray-900">Generated Content</h2>
                <span className={`px-3 py-1 rounded-full text-sm font-medium ${
                  generation.status === 'COMPLETED' 
                    ? 'bg-green-100 text-green-800' 
                    : 'bg-yellow-100 text-yellow-800'
                }`}>
                  {generation.status}
                </span>
              </div>

              {generation.image_url ? (
                <div className="aspect-square bg-gray-100 rounded-lg overflow-hidden mb-4">
                  <Image
                    src={generation.image_url}
                    alt="Generated content"
                    width={500}
                    height={500}
                    className="w-full h-full object-cover"
                  />
                </div>
              ) : (
                <div className="aspect-square bg-gray-100 rounded-lg flex items-center justify-center mb-4">
                  <div className="text-center">
                    <svg className="w-12 h-12 text-gray-400 mx-auto mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                    <p className="text-gray-500">Generating...</p>
                  </div>
                </div>
              )}

              <div className="space-y-3">
                <div>
                  <label className="text-sm font-medium text-gray-700">Creator</label>
                  <p className="text-gray-900">{generation.creator.name}</p>
                </div>
                
                <div>
                  <label className="text-sm font-medium text-gray-700">Mode</label>
                  <p className="text-gray-900">{generation.mode}</p>
                </div>

                {generation.prompt && (
                  <div>
                    <label className="text-sm font-medium text-gray-700">Prompt</label>
                    <p className="text-gray-900">{generation.prompt}</p>
                  </div>
                )}

                {generation.creator.trigger_word && (
                  <div>
                    <label className="text-sm font-medium text-gray-700">Trigger Word</label>
                    <code className="bg-gray-100 px-2 py-1 rounded text-sm">{generation.creator.trigger_word}</code>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Product Selection */}
        <div>
          <div className="bg-white rounded-lg shadow-lg p-6">
            <h3 className="text-2xl font-bold text-gray-900 mb-6">Create Products</h3>
            <p className="text-gray-600 mb-6">
              Transform your generated content into physical merchandise. Choose from our available product types:
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {productTypes.map((product) => (
                <div
                  key={product.id}
                  className={`border-2 rounded-lg p-4 cursor-pointer transition-all ${
                    selectedProduct === product.id
                      ? 'border-indigo-500 bg-indigo-50'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                  onClick={() => setSelectedProduct(product.id)}
                >
                  <div className="text-center">
                    <div className={`w-12 h-12 mx-auto mb-3 rounded-lg flex items-center justify-center ${
                      selectedProduct === product.id
                        ? 'bg-indigo-100 text-indigo-600'
                        : 'bg-gray-100 text-gray-600'
                    }`}>
                      {product.icon}
                    </div>
                    <h4 className="font-semibold text-gray-900 mb-1">{product.name}</h4>
                    <p className="text-sm text-gray-600 mb-2">{product.description}</p>
                    <p className="font-bold text-indigo-600">{formatPrice(product.price_cents)}</p>
                  </div>
                </div>
              ))}
            </div>

            {selectedProduct && (
              <div className="mt-6 p-4 bg-gray-50 rounded-lg">
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="font-semibold text-gray-900">
                      {productTypes.find(p => p.id === selectedProduct)?.name}
                    </h4>
                    <p className="text-sm text-gray-600">
                      {productTypes.find(p => p.id === selectedProduct)?.description}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="font-bold text-lg text-indigo-600">
                      {formatPrice(productTypes.find(p => p.id === selectedProduct)?.price_cents || 0)}
                    </p>
                  </div>
                </div>
                
                <button
                  onClick={() => handleCreateProduct(selectedProduct)}
                  disabled={loading || generation.status !== 'COMPLETED'}
                  className="w-full mt-4 bg-indigo-600 hover:bg-indigo-700 disabled:bg-gray-400 text-white py-3 px-4 rounded-lg font-medium transition-colors"
                >
                  {loading ? 'Creating Product...' : 'Create Product'}
                </button>
              </div>
            )}

            {generation.status !== 'COMPLETED' && (
              <div className="mt-6 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
                <div className="flex items-center">
                  <svg className="w-5 h-5 text-yellow-600 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 15.5c-.77.833.192 2.5 1.732 2.5z" />
                  </svg>
                  <p className="text-yellow-800 text-sm">
                    Please wait for the generation to complete before creating products.
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* Quick Actions */}
          <div className="mt-6 bg-white rounded-lg shadow-lg p-6">
            <h4 className="font-semibold text-gray-900 mb-4">Quick Actions</h4>
            <div className="space-y-3">
              <Link
                href={`/creator/${generation.creator_id}/generate`}
                className="block w-full text-center bg-gray-100 hover:bg-gray-200 text-gray-700 py-2 px-4 rounded-lg transition-colors"
              >
                Generate More Content
              </Link>
              <Link
                href="/stores"
                className="block w-full text-center bg-green-100 hover:bg-green-200 text-green-700 py-2 px-4 rounded-lg transition-colors"
              >
                Browse Stores
              </Link>
              <Link
                href={`/creator/${generation.creator_id}`}
                className="block w-full text-center bg-blue-100 hover:bg-blue-200 text-blue-700 py-2 px-4 rounded-lg transition-colors"
              >
                View Creator Profile
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}