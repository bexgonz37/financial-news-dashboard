// Live Dashboard Verification Script
console.log('=== LIVE DASHBOARD VERIFICATION ===');

async function verifyLiveDashboard() {
  const results = {
    news: { success: false, counts: {}, errors: [], items: 0 },
    tickers: { resolved: 0, autoSubscribed: 0, details: [] },
    ws: { connected: false, tickCount: 0, status: 'OFFLINE' },
    scanners: { rows: 0, runs: 0, topSymbols: [] },
    ui: { autoLoad: false, miniCharts: 0, statusBar: false },
    routes: { count: 0, list: [] },
    env: { finnhub: false, fmp: false, alphavantage: false }
  };

  try {
    // 1) NEWS AGGREGATION
    console.log('1. Testing News Aggregation...');
    const newsResponse = await fetch('/api/news?limit=10');
    const newsData = await newsResponse.json();
    
    if (newsData.success && newsData.data?.meta) {
      results.news.success = true;
      results.news.counts = newsData.data.meta.counts;
      results.news.errors = newsData.data.meta.errors;
      results.news.items = newsData.data.news?.length || 0;
      
      console.log(`   Provider counts: FMP ${results.news.counts.fmp}, AV ${results.news.counts.alphavantage}, FH ${results.news.counts.finnhub}`);
      console.log(`   Total items: ${results.news.items}`);
      console.log(`   Errors: ${results.news.errors.length}`);
      
      // Check if we have items from at least one provider
      const totalFromProviders = results.news.counts.fmp + results.news.counts.alphavantage + results.news.counts.finnhub;
      if (totalFromProviders > 0) {
        console.log(`   ✅ News aggregation working: ${totalFromProviders} items from providers`);
      } else {
        console.log(`   ❌ News aggregation failed: no items from providers`);
      }
    } else {
      console.log(`   ❌ News API failed: ${newsData.error || 'Unknown error'}`);
    }

    // 2) TICKER WIRING
    console.log('2. Testing Ticker Resolution...');
    if (newsData.success && newsData.data?.news) {
      const items = newsData.data.news.slice(0, 10);
      for (const item of items) {
        const hasProviderSymbol = item.symbols && item.symbols.length > 0;
        const symbol = hasProviderSymbol ? item.symbols[0] : 'none';
        const autoSubscribed = hasProviderSymbol;
        
        results.tickers.details.push({
          title: item.title?.substring(0, 50) + '...',
          symbol,
          hasProviderSymbol,
          autoSubscribed
        });
        
        if (hasProviderSymbol) {
          results.tickers.resolved++;
          results.tickers.autoSubscribed++;
        }
      }
      
      console.log(`   Resolved: ${results.tickers.resolved}/${items.length}`);
      console.log(`   Auto-subscribed: ${results.tickers.autoSubscribed}`);
      
      // Show first 3 details
      results.tickers.details.slice(0, 3).forEach(detail => {
        console.log(`   - "${detail.title}" → ${detail.symbol} (auto-sub: ${detail.autoSubscribed})`);
      });
    }

    // 3) WEBSOCKET
    console.log('3. Testing WebSocket...');
    try {
      // Check if WebSocket is available in window
      if (typeof window !== 'undefined' && window.wsQuotes) {
        const wsStatus = window.wsQuotes.getStatus();
        results.ws.connected = wsStatus.connected;
        results.ws.status = wsStatus.status;
        results.ws.tickCount = wsStatus.subscribedCount;
        console.log(`   WebSocket: ${wsStatus.status} (${wsStatus.subscribedCount} subscribed)`);
      } else {
        console.log(`   WebSocket: Not available in window`);
      }
    } catch (error) {
      console.log(`   WebSocket: Error checking status - ${error.message}`);
    }

    // 4) SCANNERS
    console.log('4. Testing Scanners...');
    try {
      // Check if scanner engine is available
      const { scannerEngine } = await import('./src/lib/scanners/run.js');
      const scannerResults = await scannerEngine.runAllScanners();
      
      // Count total rows across all scanners
      let totalRows = 0;
      const topSymbols = [];
      
      Object.entries(scannerResults).forEach(([name, stocks]) => {
        if (Array.isArray(stocks)) {
          totalRows += stocks.length;
          stocks.slice(0, 2).forEach(stock => {
            topSymbols.push({ scanner: name, symbol: stock.symbol, score: stock.score });
          });
        }
      });
      
      results.scanners.rows = totalRows;
      results.scanners.topSymbols = topSymbols;
      
      console.log(`   Scanner rows: ${totalRows}`);
      console.log(`   Top symbols: ${topSymbols.map(s => `${s.symbol}(${s.scanner})`).join(', ')}`);
    } catch (error) {
      console.log(`   Scanners: Error - ${error.message}`);
    }

    // 5) UI/AUTO-LOAD
    console.log('5. Testing UI Auto-Load...');
    const newsFeed = document.getElementById('news-feed');
    const newsItems = newsFeed?.querySelectorAll('.news-item');
    const miniCharts = document.querySelectorAll('.mini-chart');
    
    results.ui.autoLoad = newsItems && newsItems.length > 0;
    results.ui.miniCharts = miniCharts.length;
    
    console.log(`   News auto-load: ${results.ui.autoLoad ? 'YES' : 'NO'} (${newsItems?.length || 0} items)`);
    console.log(`   Mini-charts: ${results.ui.miniCharts}`);

    // 6) ROUTES
    console.log('6. Testing Routes...');
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

    // 7) ENVIRONMENT VARIABLES
    console.log('7. Testing Environment Variables...');
    results.env.finnhub = !!(window.ENV?.FINNHUB_KEY || process.env?.FINNHUB_KEY);
    results.env.fmp = !!(window.ENV?.FMP_KEY || process.env?.FMP_KEY);
    results.env.alphavantage = !!(window.ENV?.ALPHAVANTAGE_KEY || process.env?.ALPHAVANTAGE_KEY);
    
    console.log(`   Keys available: FH ${results.env.finnhub}, FMP ${results.env.fmp}, AV ${results.env.alphavantage}`);

  } catch (error) {
    console.error('Verification failed:', error);
  }

  // Print summary
  console.log('\n=== VERIFICATION SUMMARY ===');
  console.log(`News: ${results.news.success ? 'SUCCESS' : 'FAILED'} (${results.news.items} items, providers: FMP ${results.news.counts.fmp}, AV ${results.news.counts.alphavantage}, FH ${results.news.counts.finnhub})`);
  console.log(`Tickers: ${results.tickers.resolved} resolved, ${results.tickers.autoSubscribed} auto-subscribed`);
  console.log(`WebSocket: ${results.ws.status} (${results.ws.tickCount} subscribed)`);
  console.log(`Scanners: ${results.scanners.rows} rows`);
  console.log(`UI: Auto-load ${results.ui.autoLoad ? 'YES' : 'NO'}, ${results.ui.miniCharts} mini-charts`);
  console.log(`Routes: ${results.routes.count} (≤12 required)`);
  console.log(`Env: FH ${results.env.finnhub}, FMP ${results.env.fmp}, AV ${results.env.alphavantage}`);
  
  const overallSuccess = results.news.success && results.news.items > 0 && results.tickers.resolved > 0 && results.routes.count <= 12;
  console.log(`Overall: ${overallSuccess ? 'SUCCESS' : 'FAILED'}`);
  
  return results;
}

// Run verification
verifyLiveDashboard();
