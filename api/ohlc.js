// /api/ohlc.js
// Returns OHLC candles for a ticker using Finnhub
// Works intraday even when market is closed by widening the lookback

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const { ticker, interval = '1min', limit = 120, last = '0' } = req.query;
    if (!ticker) return res.status(400).json({ error: 'Ticker required' });

    const apiKey = process.env.FINNHUB_KEY;
    if (!apiKey) return res.status(500).json({ error: 'Missing FINNHUB_KEY' });

    const resMap = { '1min':'1', '5min':'5', '15min':'15', '30min':'30', '60min':'60', day:'D' };
    const resolution = resMap[interval] || '1';

    const now = Math.floor(Date.now() / 1000);

    // base lookback (minutes); widen if last=1 to capture prior session
    const minsBack = Math.max(10, parseInt(limit, 10));
    const back1 = minsBack * 60;
    const back2 = Math.max(back1, 2 * 24 * 60 * 60); // fallback ~2 days

    async function fetchCandles(fromTs, toTs) {
      const url = `https://finnhub.io/api/v1/stock/candle?symbol=${encodeURIComponent(
        ticker.toUpperCase()
      )}&resolution=${resolution}&from=${fromTs}&to=${toTs}&token=${apiKey}`;
      const r = await fetch(url);
      if (!r.ok) throw new Error(`Finnhub error ${r.status}`);
      const data = await r.json();
      if (data.s !== 'ok' || !Array.isArray(data.t) || !data.t.length) return [];
      return data.t.map((t, i) => ({
        t: new Date(t * 1000).toISOString(),
        o: data.o[i],
        h: data.h[i],
        l: data.l[i],
        c: data.c[i],
        v: data.v[i]
      }));
    }

    // Try recent window first
    let candles = await fetchCandles(now - back1, now);

    // If closed / empty, try a wider window (yesterday/last session)
    if ((!candles || candles.length < 2) && last === '1') {
      candles = await fetchCandles(now - back2, now);
    }

    return res.status(200).json({ candles: candles || [] });
  } catch (err) {
    console.error('OHLC error', err);
    return res.status(500).json({ error: err.message });
  }
}
