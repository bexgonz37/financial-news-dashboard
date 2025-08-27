// Intraday candles for sparklines & modal chart
// Uses FMP historical chart endpoint (1min)

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const { ticker, interval = '1min', limit = 120 } = req.query;
    const fmpKey = process.env.FMP_KEY;
    if (!ticker) return res.status(400).json({ error: 'Missing ticker' });
    if (!fmpKey) return res.status(500).json({ error: 'Missing FMP_KEY' });

    // Only 1min supported here; you can extend to 5min/15min by mapping paths.
    const path = `historical-chart/1min/${encodeURIComponent(ticker.toUpperCase())}`;
    const url = `https://financialmodelingprep.com/api/v3/${path}?apikey=${fmpKey}`;

    const r = await fetch(url);
    if (!r.ok) throw new Error(`FMP error: ${r.status} ${r.statusText}`);
    const arr = await r.json();

    // FMP returns newest first; trim + reverse to oldest->newest
    const max = Math.min(parseInt(limit, 10) || 120, arr.length || 0);
    const sliced = arr.slice(0, max).reverse();

    const candles = sliced.map(k => ({
      t: new Date(k.date).toISOString(),
      o: Number(k.open),
      h: Number(k.high),
      l: Number(k.low),
      c: Number(k.close),
      v: Number(k.volume || 0)
    }));

    res.status(200).json({ ticker: ticker.toUpperCase(), interval: '1min', candles });
  } catch (err) {
    console.error('ohlc error:', err);
    res.status(500).json({ error: 'Internal server error', message: err.message });
  }
}
