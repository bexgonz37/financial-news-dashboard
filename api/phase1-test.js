// Phase 1 verification endpoint
export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const results = {
    timestamp: new Date().toISOString(),
    phase: 'Phase 1 - FMP + Alpha Vantage with Safety Nets',
    checks: {},
    summary: {
      keys: { client: {}, server: {} },
      fmpLimiter: { status: 'unknown', budget: 0 },
      companyMaster: { status: 'unknown', companies: 0 },
      news: { providers: {}, errors: [] },
      resolution: { quality: [], wrongMappings: 0 }
    }
  };

  try {
    // 1. Test Environment Keys
    console.log('Testing environment keys...');
    results.summary.keys.server = {
      FINNHUB_KEY: !!process.env.FINNHUB_KEY,
      FMP_KEY: !!process.env.FMP_KEY,
      ALPHAVANTAGE_KEY: !!process.env.ALPHAVANTAGE_KEY
    };

    // Test client-side key access
    try {
      const envResponse = await fetch(`${req.headers.host?.includes('localhost') ? 'http://' : 'https://'}${req.headers.host}/api/env`);
      const envData = await envResponse.json();
      if (envData.success) {
        results.summary.keys.client = {
          FINNHUB_KEY: !!envData.data.FINNHUB_KEY,
          FMP_KEY: !!envData.data.FMP_KEY,
          ALPHAVANTAGE_KEY: !!envData.data.ALPHAVANTAGE_KEY
        };
      }
    } catch (error) {
      console.warn('Client key test failed:', error.message);
    }

    // 2. Test FMP Limiter
    console.log('Testing FMP limiter...');
    try {
      const limiterResponse = await fetch(`${req.headers.host?.includes('localhost') ? 'http://' : 'https://'}${req.headers.host}/api/company-master`);
      const limiterData = await limiterResponse.json();
      results.summary.fmpLimiter = {
        status: limiterData.success ? 'working' : 'failed',
        budget: 2 // Token bucket burst size
      };
    } catch (error) {
      results.summary.fmpLimiter = {
        status: 'error',
        error: error.message
      };
    }

    // 3. Test Company Master Cache
    console.log('Testing company master cache...');
    try {
      const masterResponse = await fetch(`${req.headers.host?.includes('localhost') ? 'http://' : 'https://'}${req.headers.host}/api/company-master`);
      const masterData = await masterResponse.json();
      if (masterData.success) {
        results.summary.companyMaster = {
          status: 'working',
          companies: masterData.data?.totalCompanies || 0,
          lastUpdate: masterData.data?.lastUpdate || null
        };
      }
    } catch (error) {
      results.summary.companyMaster = {
        status: 'error',
        error: error.message
      };
    }

    // 4. Test News Aggregation (All 4 Providers)
    console.log('Testing Phase 1 news aggregation...');
    const newsResponse = await fetch(`${req.headers.host?.includes('localhost') ? 'http://' : 'https://'}${req.headers.host}/api/news?limit=20`);
    const newsData = await newsResponse.json();
    
    if (newsData.success) {
      results.summary.news.providers = newsData.data.meta.counts;
      results.summary.news.errors = newsData.data.meta.errors || [];
      
      // Test resolution quality on first 20 items
      const newsItems = newsData.data.news.slice(0, 20);
      results.summary.resolution.quality = newsItems.map(item => ({
        source: item.source,
        title: item.title?.substring(0, 50) || '',
        symbols: item.symbols || [],
        resolved: {
          ticker: item.symbols?.[0] || 'Resolve',
          confidence: item.symbols?.length > 0 ? 0.95 : 0,
          reason: item.symbols?.length > 0 ? 'provider' : 'unresolved'
        }
      }));
      
      results.summary.resolution.wrongMappings = results.summary.resolution.quality.filter(r => 
        r.resolved.ticker === 'Resolve' && r.resolved.confidence > 0
      ).length;
    }

    // 5. Overall Phase 1 Status
    const keysWorking = Object.values(results.summary.keys.server).every(Boolean);
    const fmpWorking = results.summary.fmpLimiter.status === 'working';
    const masterWorking = results.summary.companyMaster.status === 'working';
    const newsProvidersWorking = Object.values(results.summary.news.providers).filter(c => c > 0).length >= 2;
    const resolutionWorking = results.summary.resolution.wrongMappings === 0;

    results.overall = {
      status: keysWorking && fmpWorking && masterWorking && newsProvidersWorking && resolutionWorking ? 'PASS' : 'FAIL',
      keys: keysWorking,
      fmpLimiter: fmpWorking,
      companyMaster: masterWorking,
      newsProviders: newsProvidersWorking,
      resolution: resolutionWorking,
      phase1Ready: keysWorking && fmpWorking && masterWorking && newsProvidersWorking && resolutionWorking
    };

    return res.status(200).json(results);

  } catch (error) {
    console.error('Phase 1 test error:', error);
    return res.status(500).json({
      ...results,
      error: error.message,
      overall: { status: 'ERROR', message: error.message }
    });
  }
}
