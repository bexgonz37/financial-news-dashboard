// Live OHLC API - Real Financial Data from Multiple Providers
import fetch from 'node-fetch';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

// API Keys from environment variables
const FMP_KEY = process.env.FMP_KEY;
const FINNHUB_KEY = process.env.FINNHUB_KEY;
const ALPHAVANTAGE_KEY = process.env.ALPHAVANTAGE_KEY;

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET') return res.status(405).json({ success: false, error: 'Method not allowed' });

  const { ticker, interval = '5min', limit = '100' } = req.query;
  if (!ticker) return res.status(400).json({ success: false, error: 'Missing ticker' });

  const providers = [];

  // FMP
  if (FMP_KEY) {
    providers.push(async () => {
      const r = await fetch(`https://financialmodelingprep.com/api/v3/historical-chart/${interval}/${encodeURIComponent(ticker)}?apikey=${FMP_KEY}&limit=${limit}`, { cache: 'no-store' });
      if (!r.ok) throw new Error('FMP HTTP ' + r.status);
      const j = await r.json();
      if (!Array.isArray(j) || j.length === 0) throw new Error('FMP empty');
      
      const candles = j.map(c => ({
        t: new Date(c.date).getTime(),
        o: parseFloat(c.open),
        h: parseFloat(c.high),
        l: parseFloat(c.low),
        c: parseFloat(c.close),
        v: parseInt(c.volume)
      })).sort((a, b) => a.t - b.t);
      
      return { data: { candles }, provider: 'fmp' };
    });
  }

  // Finnhub
  if (FINNHUB_KEY) {
    providers.push(async () => {
      const r = await fetch(`https://finnhub.io/api/v1/stock/candle?symbol=${encodeURIComponent(ticker)}&resolution=${interval}&token=${FINNHUB_KEY}&count=${limit}`, { cache: 'no-store' });
      if (!r.ok) throw new Error('Finnhub HTTP ' + r.status);
      const j = await r.json();
      if (!j || !j.c || j.c.length === 0) throw new Error('Finnhub empty');
      
      const candles = j.c.map((close, i) => ({
        t: j.t[i] * 1000, // Convert to milliseconds
        o: j.o[i],
        h: j.h[i],
        l: j.l[i],
        c: close,
        v: j.v[i]
      }));
      
      return { data: { candles }, provider: 'finnhub' };
    });
  }

  // Alpha Vantage
  if (ALPHAVANTAGE_KEY) {
    providers.push(async () => {
      const functionName = interval === '1min' ? 'TIME_SERIES_INTRADAY' : 'TIME_SERIES_DAILY';
      const r = await fetch(`https://www.alphavantage.co/query?function=${functionName}&symbol=${encodeURIComponent(ticker)}&apikey=${ALPHAVANTAGE_KEY}&outputsize=compact`, { cache: 'no-store' });
      if (!r.ok) throw new Error('Alpha Vantage HTTP ' + r.status);
      const j = await r.json();
      
      const timeSeriesKey = interval === '1min' ? 'Time Series (1min)' : 'Time Series (Daily)';
      const timeSeries = j[timeSeriesKey];
      if (!timeSeries) throw new Error('Alpha Vantage empty');
      
      const candles = Object.entries(timeSeries)
        .slice(0, parseInt(limit))
        .map(([time, data]) => ({
          t: new Date(time).getTime(),
          o: parseFloat(data['1. open']),
          h: parseFloat(data['2. high']),
          l: parseFloat(data['3. low']),
          c: parseFloat(data['4. close']),
          v: parseInt(data['5. volume'])
        }))
        .sort((a, b) => a.t - b.t);
      
      return { data: { candles }, provider: 'alphavantage' };
    });
  }

  const errors = [];
  for (const p of providers) {
    try {
      const result = await p();
      console.log(`OHLC data from ${result.provider} for ${ticker}: ${result.data.candles.length} candles`);
      return res.json({ success: true, ...result });
    } catch (e) { 
      console.warn(`OHLC provider failed for ${ticker}:`, e.message);
      errors.push(e.message); 
    }
  }
  
  return res.status(502).json({ 
    success: false, 
    error: 'No OHLC data available from any provider', 
    providersTried: providers.length, 
    details: errors 
  });
}