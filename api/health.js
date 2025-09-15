export default async function handler(req, res) {
  const env = n => (process.env[n] ? '✔' : '✖');
  res.status(200).json({
    ok: true,
    routes: {
      enhanced_news: 'GET /api/enhanced-news',
      scanner: 'GET /api/dynamic-stocks-scanner',
      ohlc: 'GET /api/ohlc?ticker=AAPL',
      quote: 'GET /api/live-data?ticker=AAPL&type=quote'
    },
    env: {
      FINNHUB: env('FINNHUB_KEY'),
      FMP: env('FMP_KEY'),
      IEX: env('IEX_API_KEY'),
      ALPHAVANTAGE: env('ALPHAVANTAGE_KEY'),
      YF_COOKIE: env('YF_COOKIE') // only if you use it
    },
    ts: Date.now()
  });
}
