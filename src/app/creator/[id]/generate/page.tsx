import { notFound } from 'next/navigation';
import { getServerSession } from 'next-auth';
import { getCreatorById } from '@/lib/creator-service';
import GenerationInterface from '@/components/generation/generation-interface';

interface GeneratePageProps {
  params: {
    id: string;
  };
}

export default async function GeneratePage({ params }: GeneratePageProps) {
  const session = await getServerSession();
  
  if (!session?.user?.id) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold mb-4">Authentication Required</h1>
          <p className="text-gray-600">Please sign in to generate content</p>
        </div>
      </div>
    );
  }

  const creator = await getCreatorById(params.id);

  if (!creator) {
    notFound();
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="container mx-auto px-4">
        <GenerationInterface 
          creator={creator} 
          userId={session.user.id}
        />
      </div>
    </div>
  );
}