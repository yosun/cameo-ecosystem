import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { PolicyService } from '@/lib/policy-service';

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const result = await PolicyService.enforcePolicyOnExistingProducts(params.id);

    return NextResponse.json(result);

  } catch (error) {
    console.error('Error enforcing policy:', error);
    
    if (error instanceof Error && error.message === 'Creator not found') {
      return NextResponse.json(
        { error: 'Creator not found' },
        { status: 404 }
      );
    }
    
    return NextResponse.json(
      { error: 'Failed to enforce policy' },
      { status: 500 }
    );
  }
}