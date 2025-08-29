import { notFound } from 'next/navigation';
import { getCreatorById } from '@/lib/creator-service';
import CreatorProfileForm from '@/components/creator/creator-profile-form';

interface EditCreatorPageProps {
  params: {
    id: string;
  };
}

export default async function EditCreatorPage({ params }: EditCreatorPageProps) {
  const creator = await getCreatorById(params.id);

  if (!creator) {
    notFound();
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <CreatorProfileForm 
        initialData={{
          name: creator.name,
          email: creator.email,
          royalty_bps: creator.royalty_bps,
          min_price_cents: creator.min_price_cents,
          max_discount_bps: creator.max_discount_bps,
          allow_third_party_stores: creator.allow_third_party_stores,
        }}
        isEditing={true}
      />
    </div>
  );
}