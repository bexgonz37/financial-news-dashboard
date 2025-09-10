// Test All APIs - Debug Endpoint
const fetch = require('node-fetch');

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();

  try {
    console.log('=== TESTING ALL APIS ===');
    
    const results = {
      news: null,
      scanner: null,
      ohlc: null,
      liveData: null
    };

    // Test News API
    try {
      console.log('Testing News API...');
      const newsResponse = await fetch(`${req.headers.host ? 'https://' + req.headers.host : 'http://localhost:3000'}/api/enhanced-news?limit=5`);
      if (newsResponse.ok) {
        const newsData = await newsResponse.json();
        results.news = {
          success: true,
          count: newsData.data?.news?.length || 0,
          sample: newsData.data?.news?.[0] || null
        };
        console.log('✅ News API working:', results.news.count, 'items');
      } else {
        results.news = { success: false, error: `HTTP ${newsResponse.status}` };
        console.log('❌ News API failed:', newsResponse.status);
      }
    } catch (error) {
      results.news = { success: false, error: error.message };
      console.log('❌ News API error:', error.message);
    }

    // Test Scanner API
    try {
      console.log('Testing Scanner API...');
      const scannerResponse = await fetch(`${req.headers.host ? 'https://' + req.headers.host : 'http://localhost:3000'}/api/dynamic-stocks-scanner`);
      if (scannerResponse.ok) {
        const scannerData = await scannerResponse.json();
        results.scanner = {
          success: true,
          count: scannerData.data?.stocks?.length || 0,
          sample: scannerData.data?.stocks?.[0] || null
        };
        console.log('✅ Scanner API working:', results.scanner.count, 'stocks');
      } else {
        results.scanner = { success: false, error: `HTTP ${scannerResponse.status}` };
        console.log('❌ Scanner API failed:', scannerResponse.status);
      }
    } catch (error) {
      results.scanner = { success: false, error: error.message };
      console.log('❌ Scanner API error:', error.message);
    }

    // Test OHLC API
    try {
      console.log('Testing OHLC API...');
      const ohlcResponse = await fetch(`${req.headers.host ? 'https://' + req.headers.host : 'http://localhost:3000'}/api/ohlc?ticker=AAPL&limit=10`);
      if (ohlcResponse.ok) {
        const ohlcData = await ohlcResponse.json();
        results.ohlc = {
          success: true,
          count: ohlcData.data?.candles?.length || 0,
          sample: ohlcData.data?.candles?.[0] || null
        };
        console.log('✅ OHLC API working:', results.ohlc.count, 'candles');
      } else {
        results.ohlc = { success: false, error: `HTTP ${ohlcResponse.status}` };
        console.log('❌ OHLC API failed:', ohlcResponse.status);
      }
    } catch (error) {
      results.ohlc = { success: false, error: error.message };
      console.log('❌ OHLC API error:', error.message);
    }

    // Test Live Data API
    try {
      console.log('Testing Live Data API...');
      const liveResponse = await fetch(`${req.headers.host ? 'https://' + req.headers.host : 'http://localhost:3000'}/api/live-data?ticker=AAPL`);
      if (liveResponse.ok) {
        const liveData = await liveResponse.json();
        results.liveData = {
          success: true,
          data: liveData.data || null
        };
        console.log('✅ Live Data API working');
      } else {
        results.liveData = { success: false, error: `HTTP ${liveResponse.status}` };
        console.log('❌ Live Data API failed:', liveResponse.status);
      }
    } catch (error) {
      results.liveData = { success: false, error: error.message };
      console.log('❌ Live Data API error:', error.message);
    }

    return res.status(200).json({
      success: true,
      timestamp: new Date().toISOString(),
      results: results
    });

  } catch (error) {
    console.error('Test all APIs error:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to test APIs',
      message: error.message
    });
  }
}
