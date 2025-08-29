import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { PolicyService } from '@/lib/policy-service';

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const report = await PolicyService.getCreatorPolicyReport(params.id);

    return NextResponse.json({ report });

  } catch (error) {
    console.error('Error fetching policy report:', error);
    
    if (error instanceof Error && error.message === 'Creator not found') {
      return NextResponse.json(
        { error: 'Creator not found' },
        { status: 404 }
      );
    }
    
    return NextResponse.json(
      { error: 'Failed to fetch policy report' },
      { status: 500 }
    );
  }
}