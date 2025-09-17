import { NextResponse } from 'next/server';
export const runtime = 'nodejs';
export function GET(req: Request) {
  const url = new URL(req.url);
  return NextResponse.json({
    ok: true,
    host: url.host,
    href: url.href,
    vercelUrl: process.env.VERCEL_URL ?? null,
    env: process.env.VERCEL_ENV ?? 'unknown'
  });
}
