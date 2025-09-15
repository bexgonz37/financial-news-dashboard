// Live Quotes API - Real Financial Data from Multiple Providers
import fetch from 'node-fetch';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

// API Keys from environment variables
const FMP_KEY = process.env.FMP_KEY;
const FINNHUB_KEY = process.env.FINNHUB_KEY;
const ALPHAVANTAGE_KEY = process.env.ALPHAVANTAGE_KEY;
const IEX_CLOUD_KEY = process.env.IEX_CLOUD_KEY;

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET') return res.status(405).json({ success: false, error: 'Method not allowed' });

  const { ticker, type = 'quote' } = req.query;
  if (!ticker) return res.status(400).json({ success: false, error: 'Missing ticker' });

  const providers = [];

  // Finnhub
  if (FINNHUB_KEY) {
    providers.push(async () => {
      const r = await fetch(`https://finnhub.io/api/v1/quote?symbol=${encodeURIComponent(ticker)}&token=${FINNHUB_KEY}`, { cache: 'no-store' });
      if (!r.ok) throw new Error('Finnhub HTTP ' + r.status);
      const j = await r.json();
      if (!j || !j.c) throw new Error('Finnhub empty');
      return { 
        price: j.c, 
        change: j.d, 
        changePercent: j.dp, 
        volume: j.v, 
        provider: 'finnhub',
        timestamp: new Date().toISOString()
      };
    });
  }

  // FMP
  if (FMP_KEY) {
    providers.push(async () => {
      const r = await fetch(`https://financialmodelingprep.com/api/v3/quote/${encodeURIComponent(ticker)}?apikey=${FMP_KEY}`, { cache: 'no-store' });
      if (!r.ok) throw new Error('FMP HTTP ' + r.status);
      const j = await r.json();
      const q = Array.isArray(j) ? j[0] : null;
      if (!q || !q.price) throw new Error('FMP empty');
      return { 
        price: q.price, 
        change: q.change, 
        changePercent: q.changesPercentage, 
        volume: q.volume, 
        provider: 'fmp',
        timestamp: new Date().toISOString()
      };
    });
  }

  // Alpha Vantage (fallback)
  if (ALPHAVANTAGE_KEY) {
    providers.push(async () => {
      const r = await fetch(`https://www.alphavantage.co/query?function=GLOBAL_QUOTE&symbol=${encodeURIComponent(ticker)}&apikey=${ALPHAVANTAGE_KEY}`, { cache: 'no-store' });
      if (!r.ok) throw new Error('Alpha Vantage HTTP ' + r.status);
      const j = await r.json();
      const g = j && j['Global Quote'];
      if (!g || !g['05. price']) throw new Error('Alpha Vantage empty');
      const price = parseFloat(g['05. price']);
      const change = parseFloat(g['09. change']);
      const changePercent = parseFloat((g['10. change percent'] || '0%').replace('%', ''));
      const volume = parseFloat(g['06. volume']);
      return { 
        price, 
        change, 
        changePercent, 
        volume, 
        provider: 'alphavantage',
        timestamp: new Date().toISOString()
      };
    });
  }

  // IEX Cloud (if available)
  if (IEX_CLOUD_KEY) {
    providers.push(async () => {
      const r = await fetch(`https://cloud.iexapis.com/stable/stock/${encodeURIComponent(ticker)}/quote?token=${IEX_CLOUD_KEY}`, { cache: 'no-store' });
      if (!r.ok) throw new Error('IEX Cloud HTTP ' + r.status);
      const j = await r.json();
      if (!j || !j.latestPrice) throw new Error('IEX Cloud empty');
      return { 
        price: j.latestPrice, 
        change: j.change, 
        changePercent: j.changePercent, 
        volume: j.volume, 
        provider: 'iex',
        timestamp: new Date().toISOString()
      };
    });
  }

  const errors = [];
  for (const p of providers) {
    try {
      const quote = await p();
      console.log(`Live data from ${quote.provider} for ${ticker}:`, quote);
      return res.json({ success: true, data: quote });
    } catch (e) { 
      console.warn(`Provider failed for ${ticker}:`, e.message);
      errors.push(e.message); 
    }
  }
  
  return res.status(502).json({ 
    success: false, 
    error: 'No quotes available from any provider', 
    providersTried: providers.length, 
    details: errors 
  });
}