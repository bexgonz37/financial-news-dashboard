// OHLC Data API - Live Data Only
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

    console.log(`=== FETCHING LIVE OHLC DATA FOR ${ticker} ===`);

    // Try Alpha Vantage first (most reliable)
    const candles = await fetchFromAlphaVantage(ticker, interval, limit, last);
    
    if (candles && candles.length > 0) {
      console.log(`✅ Successfully fetched ${candles.length} live candles for ${ticker}`);
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

    // If no live data, return empty array (NO FALLBACK)
    console.log(`❌ No live data found for ${ticker}, returning empty array`);
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

async function fetchFromAlphaVantage(ticker, interval, limit, last) {
  try {
    const apiKey = process.env.ALPHAVANTAGE_KEY;
    if (!apiKey) {
      console.log('Alpha Vantage API key not configured');
      return [];
    }
    
    console.log(`Fetching live data from Alpha Vantage for ${ticker}`);
    
    // Convert interval to Alpha Vantage format
    const avInterval = interval === '1min' ? '1min' : 
                      interval === '5min' ? '5min' : 
                      interval === '1hour' ? '60min' : 
                      interval === '1day' ? 'daily' : '5min';
    
    const response = await fetch(
      `https://www.alphavantage.co/query?function=TIME_SERIES_INTRADAY&symbol=${ticker}&interval=${avInterval}&apikey=${apiKey}&outputsize=compact&_t=${Date.now()}`
    );
    
    console.log(`Alpha Vantage response status: ${response.status}`);
    
    if (!response.ok) {
      throw new Error(`Alpha Vantage API error: ${response.status}`);
    }
    
    const data = await response.json();
    console.log(`Alpha Vantage response received for ${ticker}`);
    
    // Check for API error messages
    if (data['Error Message']) {
      throw new Error(`Alpha Vantage error: ${data['Error Message']}`);
    }
    
    if (data['Note']) {
      throw new Error(`Alpha Vantage rate limited: ${data['Note']}`);
    }
    
    // Find the time series key
    const timeSeriesKey = Object.keys(data).find(key => key.includes('Time Series'));
    
    if (timeSeriesKey && data[timeSeriesKey]) {
      const timeSeries = data[timeSeriesKey];
      const timestamps = Object.keys(timeSeries).sort();
      
      console.log(`Alpha Vantage found ${timestamps.length} data points for ${ticker}`);
      
      const candles = timestamps.map(timestamp => {
        const quote = timeSeries[timestamp];
        return {
          time: new Date(timestamp).getTime(),
          open: parseFloat(quote['1. open']),
          high: parseFloat(quote['2. high']),
          low: parseFloat(quote['3. low']),
          close: parseFloat(quote['4. close']),
          volume: parseInt(quote['5. volume'])
        };
      }).filter(candle => candle.close > 0);
      
      // Apply limit and last filters
      let filteredCandles = candles;
      if (last) {
        filteredCandles = candles.slice(-parseInt(last));
      } else if (limit) {
        filteredCandles = candles.slice(-parseInt(limit));
      }
      
      console.log(`Alpha Vantage returned ${filteredCandles.length} live candles for ${ticker}`);
      return filteredCandles;
    }
    
    throw new Error('No time series data from Alpha Vantage');
  } catch (error) {
    console.error(`Alpha Vantage error for ${ticker}:`, error.message);
    throw error;
  }
}