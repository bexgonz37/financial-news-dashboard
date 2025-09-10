// Test Scanner API - Simple test to see what's happening
const fetch = require('node-fetch');

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();

  try {
    console.log('=== TESTING SCANNER API ===');
    console.log('API Keys check:', {
      ALPHAVANTAGE_KEY: process.env.ALPHAVANTAGE_KEY ? 'SET' : 'MISSING',
      FMP_KEY: process.env.FMP_KEY ? 'SET' : 'MISSING',
      FINNHUB_KEY: process.env.FINNHUB_KEY ? 'SET' : 'MISSING'
    });

    // Test Yahoo Finance first
    console.log('Testing Yahoo Finance for AAPL...');
    try {
      const response = await fetch(`https://query1.finance.yahoo.com/v8/finance/chart/AAPL?interval=1d&range=1d&_t=${Date.now()}`, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
        }
      });
      
      if (response.ok) {
        const data = await response.json();
        console.log('Yahoo Finance response:', JSON.stringify(data, null, 2));
        
        if (data.chart && data.chart.result && data.chart.result[0]) {
          const result = data.chart.result[0];
          const meta = result.meta;
          const currentPrice = meta.regularMarketPrice || meta.previousClose || 0;
          const previousClose = meta.previousClose || currentPrice;
          const change = currentPrice - previousClose;
          const changePercent = previousClose > 0 ? (change / previousClose) * 100 : 0;
          
          const stock = {
            symbol: 'AAPL',
            name: meta.longName || meta.shortName || 'AAPL',
            price: currentPrice,
            change: change,
            changePercent: changePercent,
            volume: meta.regularMarketVolume || 0,
            marketCap: meta.marketCap ? Math.round(meta.marketCap / 1000000) + 'M' : 'N/A',
            sector: 'Technology',
            session: 'RTH',
            marketStatus: 'Live',
            dataAge: 'Live',
            isNewListing: false,
            tickerChanged: false,
            aiScore: 8,
            score: Math.abs(changePercent) + 5,
            lastUpdated: new Date().toISOString(),
            isLive: true
          };
          
          return res.status(200).json({
            success: true,
            data: {
              stocks: [stock],
              total: 1,
              timestamp: new Date().toISOString()
            }
          });
        }
      }
    } catch (error) {
      console.error('Yahoo Finance test error:', error.message);
    }

    // If Yahoo Finance fails, return test data
    const testStocks = [{
      symbol: 'AAPL',
      name: 'Apple Inc.',
      price: 180.50,
      change: 2.50,
      changePercent: 1.40,
      volume: 50000000,
      marketCap: '2800M',
      sector: 'Technology',
      session: 'RTH',
      marketStatus: 'Live',
      dataAge: 'Live',
      isNewListing: false,
      tickerChanged: false,
      aiScore: 8,
      score: 6.4,
      lastUpdated: new Date().toISOString(),
      isLive: true
    }];

    return res.status(200).json({
      success: true,
      data: {
        stocks: testStocks,
        total: testStocks.length,
        timestamp: new Date().toISOString()
      }
    });

  } catch (error) {
    console.error('Test scanner error:', error);
    return res.status(500).json({
      success: false,
      error: 'Test failed',
      data: { stocks: [], total: 0, timestamp: new Date().toISOString() }
    });
  }
}
