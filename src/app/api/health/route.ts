import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { validateConfig } from '@/lib/config';

export async function GET() {
  try {
    // Validate configuration
    validateConfig();
    
    // Test database connection
    await prisma.$connect();
    
    return NextResponse.json({
      status: 'healthy',
      timestamp: new Date().toISOString(),
      services: {
        database: 'connected',
        config: 'valid',
      },
    });
  } catch (error) {
    console.error('Health check failed:', error);
    
    return NextResponse.json(
      {
        status: 'unhealthy',
        timestamp: new Date().toISOString(),
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  } finally {
    await prisma.$disconnect();
  }
}