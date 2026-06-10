import { NextResponse } from 'next/server';
import { getRegen } from '@/app/actions/director';

export const dynamic = 'force-dynamic';

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return NextResponse.json({ regen: await getRegen(id) });
}
