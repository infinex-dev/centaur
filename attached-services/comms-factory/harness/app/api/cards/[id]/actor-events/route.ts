import { NextResponse } from 'next/server';
import { getActorRun, getLatestActorRun, listActorRunEvents } from '@/lib/queries';

export const dynamic = 'force-dynamic';

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const url = new URL(request.url);
  const requestedRunId = url.searchParams.get('run_id');
  const requestedRun = requestedRunId ? getActorRun(requestedRunId) : null;
  const latestRun = requestedRun ?? getLatestActorRun(id);
  const events = listActorRunEvents(id, undefined, 120, latestRun?.id ?? requestedRunId ?? undefined);
  return NextResponse.json({ run: latestRun, events });
}
