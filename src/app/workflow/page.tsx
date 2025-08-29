"use client"

import { useSearchParams } from 'next/navigation'
import MainNavigation from '@/components/navigation/main-nav'
import GenerationFlow from '@/components/workflow/generation-flow'

export default function WorkflowPage() {
  const searchParams = useSearchParams()
  const creatorId = searchParams.get('creator')
  const generationId = searchParams.get('generation')

  return (
    <div className="min-h-screen bg-gray-50">
      <MainNavigation />
      
      <main className="py-8">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="mb-8">
            <h1 className="text-3xl font-bold text-gray-900">Content Creation Workflow</h1>
            <p className="mt-2 text-lg text-gray-600">
              Follow the guided workflow to create and monetize personalized content
            </p>
          </div>
          
          <GenerationFlow 
            creatorId={creatorId || undefined}
            generationId={generationId || undefined}
          />
        </div>
      </main>
    </div>
  )
}