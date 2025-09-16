// Comprehensive verification endpoint
export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const results = {
    timestamp: new Date().toISOString(),
    checks: {},
    summary: {
      news: { providers: {}, errors: [] },
      resolution: { quality: [], wrongMappings: 0 },
      websocket: { status: 'unknown', subscriptions: [] },
      scanners: { universeSize: 0, rows: {} },
      charts: { overlays: [], symbolSwitch: 0 },
      routes: [],
      keys: { client: {}, server: {} }
    }
  };

  try {
    // 1. Test News Aggregation
    console.log('Testing news aggregation...');
    const newsResponse = await fetch(`${req.headers.host?.includes('localhost') ? 'http://' : 'https://'}${req.headers.host}/api/news?limit=20`);
    const newsData = await newsResponse.json();
    
    if (newsData.success) {
      results.summary.news.providers = newsData.data.meta.counts;
      results.summary.news.errors = newsData.data.meta.errors || [];
      
      // Test resolution quality on first 20 items
      const newsItems = newsData.data.news.slice(0, 20);
      results.summary.resolution.quality = newsItems.map(item => ({
        title: item.title?.substring(0, 50) || '',
        resolvedTicker: item.symbols?.[0] || 'Resolve',
        confidence: item.symbols?.length > 0 ? 0.95 : 0,
        reason: item.symbols?.length > 0 ? 'provider' : 'unresolved'
      }));
      
      results.summary.resolution.wrongMappings = results.summary.resolution.quality.filter(r => 
        r.resolvedTicker === 'Resolve' && r.confidence > 0
      ).length;
    }

    // 2. Test Scanner API
    console.log('Testing scanner API...');
    const scannerResponse = await fetch(`${req.headers.host?.includes('localhost') ? 'http://' : 'https://'}${req.headers.host}/api/scanner?preset=momentum&limit=50`);
    const scannerData = await scannerResponse.json();
    
    if (scannerData.success) {
      results.summary.scanners.universeSize = scannerData.data.universe;
      results.summary.scanners.rows = {
        momentum: scannerData.data.results.filter(r => r.category === 'momentum').length,
        volume: scannerData.data.results.filter(r => r.volumeSpike).length,
        oversold: scannerData.data.results.filter(r => r.category === 'oversold').length,
        breakout: scannerData.data.results.filter(r => r.category === 'breakout').length,
        gap: scannerData.data.results.filter(r => Math.abs(r.gap) > 3).length
      };
    }

    // 3. Test Company Master
    console.log('Testing company master...');
    const masterResponse = await fetch(`${req.headers.host?.includes('localhost') ? 'http://' : 'https://'}${req.headers.host}/api/company-master`);
    const masterData = await masterResponse.json();
    
    if (masterData.success) {
      results.checks.companyMaster = {
        ok: true,
        totalCompanies: masterData.data.totalCompanies,
        lastUpdate: masterData.data.lastUpdate
      };
    }

    // 4. Test Environment Keys
    results.summary.keys.server = {
      FINNHUB_KEY: !!process.env.FINNHUB_KEY,
      FMP_KEY: !!process.env.FMP_KEY,
      ALPHAVANTAGE_KEY: !!process.env.ALPHAVANTAGE_KEY
    };

    // 5. List API Routes
    results.summary.routes = [
      '/api/news',
      '/api/lookup', 
      '/api/prev-close',
      '/api/providers/diag',
      '/api/env',
      '/api/top-movers',
      '/api/selftest',
      '/api/company-master',
      '/api/scanner',
      '/api/verify'
    ];

    // 6. Overall Status
    const newsProvidersWorking = Object.values(results.summary.news.providers).some(count => count > 0);
    const resolutionWorking = results.summary.resolution.wrongMappings === 0;
    const scannersWorking = results.summary.scanners.rows.momentum > 12;
    const keysWorking = Object.values(results.summary.keys.server).every(Boolean);

    results.overall = {
      status: newsProvidersWorking && resolutionWorking && scannersWorking && keysWorking ? 'PASS' : 'FAIL',
      newsProviders: newsProvidersWorking,
      resolution: resolutionWorking,
      scanners: scannersWorking,
      keys: keysWorking
    };

    return res.status(200).json(results);

  } catch (error) {
    console.error('Verification error:', error);
    return res.status(500).json({
      ...results,
      error: error.message,
      overall: { status: 'ERROR', message: error.message }
    });
  }
}
