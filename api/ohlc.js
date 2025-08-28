// /api/ohlc.js
// Robust OHLC for intraday mini-charts & modal charts.
// Tries current session, then previous session (last=1), widens lookback,
// falls back to 5m/15m if 1m is empty, and finally to daily candles.

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const { ticker, interval = '1min', limit = 180, last = '0' } = req.query;
    if (!ticker) return res.status(400).json({ error: 'Ticker required' });

    const apiKey = process.env.FINNHUB_KEY;
    if (!apiKey) return res.status(500).json({ error: 'Missing FINNHUB_KEY' });

    // Map UI interval to Finnhub resolution
    const resMap = { '1min': '1', '5min': '5', '15min': '15', '30min': '30', '60min': '60', day: 'D' };
    const wantRes = resMap[interval] || '1';
    const now = Math.floor(Date.now() / 1000);

    // Helper: call Finnhub
    async function fetchCandles(resolution, fromTs, toTs) {
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

    // generous lookback (covers closed hours/weekends)
    const minsBack = Math.max(180, parseInt(limit, 10) || 180);
    const from1 = now - minsBack * 60;
    const from2 = now - 3 * 24 * 60 * 60; // 3 days back to catch prior sessions/weekends

    // 1) Try requested resolution around now
    let candles = await fetchCandles(wantRes, from1, now);

    // 2) If empty and last=1 (or empty anyway), widen to prior days
    if ((!candles || candles.length < 2) && last === '1') {
      candles = await fetchCandles(wantRes, from2, now);
    }

    // 3) If still empty, try coarser intraday resolutions
    if (!candles || candles.length < 2) {
      const tryRes = wantRes === '1' ? ['5', '15'] : wantRes === '5' ? ['15'] : [];
      for (const r of tryRes) {
        const alt = await fetchCandles(r, from2, now);
        if (alt && alt.length >= 2) { candles = alt; break; }
      }
    }

    // 4) Last resort: daily candles
    if (!candles || candles.length < 2) {
      const daily = await fetchCandles('D', from2, now);
      if (daily && daily.length >= 2) {
        candles = daily.map(d => ({ t: d.t, o: d.c, h: d.c, l: d.c, c: d.c, v: d.v || 0 }));
      }
    }

    return res.status(200).json({ candles: candles || [] });
  } catch (err) {
    console.error('OHLC error', err);
    return res.status(500).json({ error: err.message });
  }
}
