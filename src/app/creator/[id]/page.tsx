import { notFound } from 'next/navigation';
import { getCreatorById } from '@/lib/creator-service';
import CreatorDashboard from '@/components/creator/creator-dashboard';
import MainNavigation from '@/components/navigation/main-nav';

interface CreatorPageProps {
  params: {
    id: string;
  };
}

export default async function CreatorPage({ params }: CreatorPageProps) {
  const creator = await getCreatorById(params.id);

  if (!creator) {
    notFound();
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <MainNavigation />
      <div className="py-8">
        <CreatorDashboard creator={creator} />
      </div>
    </div>
  );
}