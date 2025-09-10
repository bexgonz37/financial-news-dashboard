// OHLC Data API - Simple and Working
export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const { ticker, interval = '5min', limit = 100, last } = req.query;

    if (!ticker) {
      return res.status(400).json({ error: 'Ticker parameter is required' });
    }

    console.log(`=== FETCHING OHLC DATA FOR ${ticker} ===`);

    // Try Yahoo Finance first (most reliable)
    const candles = await fetchFromYahooFinance(ticker, interval, limit, last);
    
    if (candles && candles.length > 0) {
      console.log(`✅ Successfully fetched ${candles.length} candles for ${ticker}`);
      return res.status(200).json({
        success: true,
        data: {
          ticker: ticker.toUpperCase(),
          interval,
          candles,
          timestamp: new Date().toISOString()
        }
      });
    }

    // If no data, return empty array
    console.log(`❌ No data found for ${ticker}, returning empty array`);
    return res.status(200).json({
      success: true,
      data: {
        ticker: ticker.toUpperCase(),
        interval,
        candles: [],
        timestamp: new Date().toISOString()
      }
    });

  } catch (error) {
    console.error('OHLC API Error:', error);
    return res.status(500).json({ 
      success: false, 
      error: 'Failed to fetch OHLC data',
      message: error.message 
    });
  }
}

async function fetchFromYahooFinance(ticker, interval, limit, last) {
  try {
    console.log(`Trying Yahoo Finance for ${ticker} with interval ${interval}`);
    
    // Convert interval to Yahoo Finance format
    const yahooInterval = interval === '1min' ? '1m' : 
                         interval === '5min' ? '5m' : 
                         interval === '1hour' ? '1h' : 
                         interval === '1day' ? '1d' : '5m';
    
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${ticker}?interval=${yahooInterval}&range=1d&_t=${Date.now()}`;
    console.log(`Yahoo Finance URL: ${url}`);
    
    const response = await fetch(url);
    console.log(`Yahoo Finance response status: ${response.status}`);
    
    if (!response.ok) {
      throw new Error(`Yahoo Finance API error: ${response.status}`);
    }
    
    const data = await response.json();
    console.log(`Yahoo Finance response received`);
    
    if (data.chart && data.chart.result && data.chart.result[0]) {
      const result = data.chart.result[0];
      const timestamps = result.timestamp;
      const quotes = result.indicators.quote[0];
      
      if (timestamps && timestamps.length > 0 && quotes) {
        const candles = timestamps.map((timestamp, index) => ({
          time: timestamp * 1000, // Convert to milliseconds
          open: quotes.open[index] || 0,
          high: quotes.high[index] || 0,
          low: quotes.low[index] || 0,
          close: quotes.close[index] || 0,
          volume: quotes.volume[index] || 0
        })).filter(candle => candle.close > 0); // Only filter out candles with no close price
        
        console.log(`Yahoo Finance raw candles length: ${candles.length}`);
        
        // Apply limit and last filters
        let filteredCandles = candles;
        if (last) {
          filteredCandles = candles.slice(-parseInt(last));
        } else if (limit) {
          filteredCandles = candles.slice(-parseInt(limit));
        }
        
        console.log(`Yahoo Finance final candles length: ${filteredCandles.length}`);
        return filteredCandles;
      }
    }
    
    throw new Error('No valid data from Yahoo Finance');
  } catch (error) {
    console.error(`Yahoo Finance error for ${ticker}:`, error.message);
    throw error;
  }
}