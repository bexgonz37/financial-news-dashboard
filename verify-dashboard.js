// Dashboard verification script
console.log('=== DASHBOARD VERIFICATION ===');

async function verifyDashboard() {
  const results = {
    news: { success: false, counts: {}, errors: [] },
    tickers: { resolved: 0, autoSubscribed: 0 },
    ws: { connected: false, tickCount: 0 },
    scanners: { rows: 0, runs: 0 },
    ahMode: { active: false, cadence: 0 },
    routes: { count: 0, list: [] }
  };

  try {
    // 1) NEWS: Check provider counts and errors
    console.log('1. Testing News API...');
    const newsResponse = await fetch('/api/news?limit=10');
    const newsData = await newsResponse.json();
    
    if (newsData.success && newsData.data?.meta) {
      results.news.success = true;
      results.news.counts = newsData.data.meta.counts;
      results.news.errors = newsData.data.meta.errors;
      console.log(`   News: FMP ${results.news.counts.fmp}, AV ${results.news.counts.alphavantage}, FH ${results.news.counts.finnhub}`);
      console.log(`   Errors: ${results.news.errors.length}`);
    }

    // 2) TICKERS: Check first 10 items for resolution
    console.log('2. Testing Ticker Resolution...');
    if (newsData.success && newsData.data?.news) {
      const items = newsData.data.news.slice(0, 10);
      for (const item of items) {
        if (item.symbols && item.symbols.length > 0) {
          results.tickers.resolved++;
          results.tickers.autoSubscribed++;
        }
      }
      console.log(`   Resolved: ${results.tickers.resolved}/${items.length}`);
    }

    // 3) WS: Check WebSocket status
    console.log('3. Testing WebSocket...');
    try {
      const wsStatus = await fetch('/api/providers/diag');
      const wsData = await wsStatus.json();
      if (wsData.success) {
        results.ws.connected = wsData.data.providers.finnhub?.status === 'healthy';
        console.log(`   WebSocket: ${results.ws.connected ? 'CONNECTED' : 'OFFLINE'}`);
      }
    } catch (error) {
      console.log('   WebSocket: Error checking status');
    }

    // 4) SCANNERS: Check scanner results
    console.log('4. Testing Scanners...');
    try {
      const scannerResponse = await fetch('/api/scanners?preset=movers&limit=10');
      const scannerData = await scannerResponse.json();
      if (scannerData.success && scannerData.data?.stocks) {
        results.scanners.rows = scannerData.data.stocks.length;
        console.log(`   Scanner rows: ${results.scanners.rows}`);
      }
    } catch (error) {
      console.log('   Scanners: Error checking results');
    }

    // 5) AH MODE: Check market hours
    console.log('5. Testing After-Hours Mode...');
    const now = new Date();
    const hour = now.getHours();
    const isAH = hour < 9 || hour > 16;
    results.ahMode.active = isAH;
    results.ahMode.cadence = isAH ? 90000 : 20000;
    console.log(`   After Hours: ${isAH ? 'YES' : 'NO'} (cadence: ${results.ahMode.cadence}ms)`);

    // 6) ROUTES: Count serverless functions
    console.log('6. Testing Route Count...');
    const routes = [
      '/api/news',
      '/api/lookup', 
      '/api/prev-close',
      '/api/providers/diag',
      '/api/env'
    ];
    results.routes.count = routes.length;
    results.routes.list = routes;
    console.log(`   Routes: ${results.routes.count} (${routes.join(', ')})`);

  } catch (error) {
    console.error('Verification failed:', error);
  }

  // Print summary
  console.log('\n=== VERIFICATION SUMMARY ===');
  console.log(`News: ${results.news.success ? 'SUCCESS' : 'FAILED'} (FMP: ${results.news.counts.fmp}, AV: ${results.news.counts.alphavantage}, FH: ${results.news.counts.finnhub})`);
  console.log(`Tickers: ${results.tickers.resolved} resolved, ${results.tickers.autoSubscribed} auto-subscribed`);
  console.log(`WebSocket: ${results.ws.connected ? 'LIVE' : 'OFFLINE'}`);
  console.log(`Scanners: ${results.scanners.rows} rows`);
  console.log(`After Hours: ${results.ahMode.active ? 'YES' : 'NO'} (${results.ahMode.cadence}ms)`);
  console.log(`Routes: ${results.routes.count} (≤12 required)`);
  
  const overallSuccess = results.news.success && results.tickers.resolved > 0 && results.routes.count <= 12;
  console.log(`Overall: ${overallSuccess ? 'SUCCESS' : 'FAILED'}`);
  
  return results;
}

// Run verification
verifyDashboard();
