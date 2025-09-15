import { providerManager } from '../lib/provider-manager.js';

export default async function handler(req, res) {
  const env = n => {
    const val = process.env[n];
    return val ? '✔' : '✖';
  };
  
  const providerStatus = providerManager.getStatus();
  
  res.status(200).json({
    ok: true,
    providers: {
      FINNHUB: env('FINNHUB_KEY'),
      FMP: env('FMP_API_KEY'),
      ALPHAVANTAGE: env('ALPHA_VANTAGE_KEY')
    },
    providerStatus: providerStatus,
    routes: {
      enhanced_news: 'GET /api/enhanced-news',
      scanner: 'GET /api/dynamic-stocks-scanner',
      data: 'GET /api/data?ticker=AAPL&type=quote',
      health: 'GET /api/health'
    },
    ts: Date.now()
  });
}
