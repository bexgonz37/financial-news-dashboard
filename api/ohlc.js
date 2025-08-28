// /api/ohlc.js
// Serverless function: returns OHLC candles for a ticker
// Uses Finnhub API (intraday)

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { ticker, interval = '1min', limit = 120 } = req.query;
    if (!ticker) return res.status(400).json({ error: 'Ticker required' });

    const apiKey = process.env.FINNHUB_KEY;
    if (!apiKey) {
      return res.status(500).json({ error: 'Missing FINNHUB_KEY env var' });
    }

    // Map interval to Finnhub resolution
    const resMap = {
      '1min': '1',
      '5min': '5',
      '15min': '15',
      '30min': '30',
      '60min': '60',
      'day': 'D'
    };
    const resolution = resMap[interval] || '1';

    // Time range: last X candles
    const now = Math.floor(Date.now() / 1000);
    const from = now - (limit * 60); // limit minutes back

    const url = `https://finnhub.io/api/v1/stock/candle?symbol=${encodeURIComponent(
      ticker.toUpperCase()
    )}&resolution=${resolution}&from=${from}&to=${now}&token=${apiKey}`;

    const r = await fetch(url);
    if (!r.ok) throw new Error(`Finnhub error ${r.status}`);
    const data = await r.json();

    if (data.s !== 'ok') {
      return res.status(200).json({ candles: [] });
    }

    const candles = data.t.map((t, i) => ({
      t: new Date(t * 1000).toISOString(),
      o: data.o[i],
      h: data.h[i],
      l: data.l[i],
      c: data.c[i],
      v: data.v[i]
    }));

    res.status(200).json({ candles });
  } catch (err) {
    console.error('OHLC error', err);
    res.status(500).json({ error: err.message });
  }
}
