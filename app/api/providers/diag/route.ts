import { NextResponse } from 'next/server';

export async function GET() {
  const clientHas = {
    ALPHAVANTAGE_KEY: !!process.env.ALPHAVANTAGE_KEY,
    FMP_KEY: !!process.env.FMP_KEY,
    FINNHUB_KEY: !!process.env.FINNHUB_KEY
  };

  const serverHas = {
    ALPHAVANTAGE_KEY: !!process.env.ALPHAVANTAGE_KEY,
    FMP_KEY: !!process.env.FMP_KEY,
    FINNHUB_KEY: !!process.env.FINNHUB_KEY
  };

  return NextResponse.json({
    clientHas,
    serverHas,
    timestamp: new Date().toISOString()
  });
}
