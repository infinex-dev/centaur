import { NextResponse } from 'next/server';
import { getLatestGrounderRun } from '@/lib/queries';

export const dynamic = 'force-dynamic';

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return NextResponse.json({ run: getLatestGrounderRun(id) });
}
