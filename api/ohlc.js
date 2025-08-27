// api/ohlc.js
// GET /api/ohlc?ticker=NVDA&interval=1min&limit=240
export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const apiKey = process.env.ALPHAVANTAGE_KEY;
    if (!apiKey) return res.status(500).json({ error: 'Missing ALPHAVANTAGE_KEY' });

    const ticker = (req.query.ticker || '').toUpperCase();
    const interval = (req.query.interval || '1min'); // 1min, 5min, 15min
    const limit = Math.min(parseInt(req.query.limit || '180', 10), 1000);
    if (!ticker) return res.status(400).json({ error: 'ticker required' });

    const url = `https://www.alphavantage.co/query?function=TIME_SERIES_INTRADAY&symbol=${encodeURIComponent(ticker)}&interval=${encodeURIComponent(interval)}&outputsize=compact&datatype=json&apikey=${apiKey}`;
    const r = await fetch(url);
    if (!r.ok) throw new Error(`Alpha Vantage error: ${r.status} ${r.statusText}`);
    const data = await r.json();

    const key = Object.keys(data).find(k => k.includes('Time Series'));
    const series = key ? data[key] : null;
    if (!series) return res.status(200).json({ ticker, interval, candles: [] });

    const candles = Object.entries(series)
      .map(([ts, v]) => ({
        t: new Date(ts + 'Z').toISOString(),
        o: parseFloat(v['1. open']),
        h: parseFloat(v['2. high']),
        l: parseFloat(v['3. low']),
        c: parseFloat(v['4. close']),
        v: parseFloat(v['5. volume'])
      }))
      .sort((a,b) => new Date(a.t) - new Date(b.t))
      .slice(-limit);

    res.status(200).json({ ticker, interval, candles });
  } catch (e) {
    console.error('ohlc error:', e);
    res.status(500).json({ error: 'Internal server error', message: e.message });
  }
}
