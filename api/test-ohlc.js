// Test OHLC API - Simple test to see what's happening
const fetch = require('node-fetch');

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const { ticker = 'AAPL', interval = '5min', limit = 20 } = req.query;

    console.log(`=== TESTING OHLC API FOR ${ticker} ===`);

    // Test Yahoo Finance first
    console.log('Testing Yahoo Finance...');
    try {
      const yahooInterval = interval === '1min' ? '1m' : 
                           interval === '5min' ? '5m' : 
                           interval === '1hour' ? '1h' : 
                           interval === '1day' ? '1d' : '5m';
      
      const range = interval === '1day' ? '1mo' : '5d';
      
      const url = `https://query1.finance.yahoo.com/v8/finance/chart/${ticker}?interval=${yahooInterval}&range=${range}&includePrePost=false&events=div%2Csplit&_t=${Date.now()}`;
      console.log(`Yahoo Finance URL: ${url}`);
      
      const response = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
        }
      });
      
      if (response.ok) {
        const data = await response.json();
        console.log('Yahoo Finance response:', JSON.stringify(data, null, 2));
        
        if (data.chart && data.chart.result && data.chart.result[0]) {
          const result = data.chart.result[0];
          const timestamps = result.timestamp;
          const quotes = result.indicators.quote[0];
          
          if (timestamps && timestamps.length > 0 && quotes) {
            const candles = timestamps.map((timestamp, index) => ({
              time: timestamp * 1000,
              open: quotes.open[index] || 0,
              high: quotes.high[index] || 0,
              low: quotes.low[index] || 0,
              close: quotes.close[index] || 0,
              volume: quotes.volume[index] || 0
            })).filter(candle => candle.close > 0);
            
            console.log(`Yahoo Finance returned ${candles.length} candles`);
            
            return res.status(200).json({
              success: true,
              data: {
                ticker: ticker.toUpperCase(),
                interval,
                candles: candles.slice(-limit),
                timestamp: new Date().toISOString()
              }
            });
          }
        }
      }
    } catch (error) {
      console.error('Yahoo Finance test error:', error.message);
    }

    // If Yahoo Finance fails, return test data
    const testCandles = [];
    const now = Date.now();
    const intervalMs = interval === '1min' ? 60 * 1000 : 
                      interval === '5min' ? 5 * 60 * 1000 : 
                      interval === '1hour' ? 60 * 60 * 1000 : 
                      interval === '1day' ? 24 * 60 * 60 * 1000 : 5 * 60 * 1000;
    
    let currentPrice = 180; // AAPL base price
    
    for (let i = 0; i < limit; i++) {
      const time = now - (limit - 1 - i) * intervalMs;
      const open = currentPrice;
      const high = open * (1 + Math.random() * 0.01);
      const low = open * (1 - Math.random() * 0.01);
      const close = open * (1 + (Math.random() - 0.5) * 0.02);
      const volume = Math.floor(Math.random() * 10000000) + 1000000;

      testCandles.push({
        time: time,
        open: parseFloat(open.toFixed(2)),
        high: parseFloat(high.toFixed(2)),
        low: parseFloat(low.toFixed(2)),
        close: parseFloat(close.toFixed(2)),
        volume: volume
      });
      
      currentPrice = close;
    }

    console.log(`Generated ${testCandles.length} test candles`);

    return res.status(200).json({
      success: true,
      data: {
        ticker: ticker.toUpperCase(),
        interval,
        candles: testCandles,
        timestamp: new Date().toISOString()
      }
    });

  } catch (error) {
    console.error('Test OHLC error:', error);
    return res.status(500).json({ 
      success: false, 
      error: 'Test failed',
      message: error.message 
    });
  }
}
