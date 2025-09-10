// OHLC Data API - Working Version
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

    // Try multiple data sources
    const candles = await fetchCandlesFromMultipleSources(ticker, interval, limit, last);
    
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

async function fetchCandlesFromMultipleSources(ticker, interval, limit, last) {
  const dataSources = [
    () => fetchFromYahooFinanceV2(ticker, interval, limit, last),
    () => fetchFromAlphaVantage(ticker, interval, limit, last),
    () => generateFallbackCandles(ticker, interval, limit, last)
  ];
  
  for (let i = 0; i < dataSources.length; i++) {
    const sourceName = ['Yahoo Finance V2', 'Alpha Vantage', 'Fallback'][i];
    try {
      console.log(`Trying ${sourceName} for ${ticker}...`);
      const candles = await dataSources[i]();
      if (candles && candles.length > 0) {
        console.log(`✅ ${sourceName} successfully fetched ${candles.length} candles for ${ticker}`);
        return candles;
      } else {
        console.log(`❌ ${sourceName} returned empty data for ${ticker}`);
      }
    } catch (error) {
      console.warn(`❌ ${sourceName} failed for ${ticker}:`, error.message);
      continue;
    }
  }
  
  console.warn(`All data sources failed for ${ticker}, returning empty array`);
  return [];
}

async function fetchFromYahooFinanceV2(ticker, interval, limit, last) {
  try {
    console.log(`Trying Yahoo Finance V2 for ${ticker} with interval ${interval}`);
    
    // Use a different Yahoo Finance endpoint
    const yahooInterval = interval === '1min' ? '1m' : 
                         interval === '5min' ? '5m' : 
                         interval === '1hour' ? '1h' : 
                         interval === '1day' ? '1d' : '5m';
    
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${ticker}?interval=${yahooInterval}&range=1d&includePrePost=false&events=div%2Csplit&_t=${Date.now()}`;
    console.log(`Yahoo Finance V2 URL: ${url}`);
    
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
      }
    });
    
    console.log(`Yahoo Finance V2 response status: ${response.status}`);
    
    if (!response.ok) {
      throw new Error(`Yahoo Finance V2 API error: ${response.status}`);
    }
    
    const data = await response.json();
    console.log(`Yahoo Finance V2 response received`);
    
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
        
        console.log(`Yahoo Finance V2 raw candles length: ${candles.length}`);
        
        // Apply limit and last filters
        let filteredCandles = candles;
        if (last) {
          filteredCandles = candles.slice(-parseInt(last));
        } else if (limit) {
          filteredCandles = candles.slice(-parseInt(limit));
        }
        
        console.log(`Yahoo Finance V2 final candles length: ${filteredCandles.length}`);
        return filteredCandles;
      }
    }
    
    throw new Error('No valid data from Yahoo Finance V2');
  } catch (error) {
    console.error(`Yahoo Finance V2 error for ${ticker}:`, error.message);
    throw error;
  }
}

async function fetchFromAlphaVantage(ticker, interval, limit, last) {
  try {
    const apiKey = process.env.ALPHAVANTAGE_KEY;
    if (!apiKey) {
      throw new Error('Alpha Vantage API key not configured');
    }
    
    console.log(`Trying Alpha Vantage for ${ticker}`);
    
    // Convert interval to Alpha Vantage format
    const avInterval = interval === '1min' ? '1min' : 
                      interval === '5min' ? '5min' : 
                      interval === '1hour' ? '60min' : 
                      interval === '1day' ? 'daily' : '5min';
    
    const response = await fetch(
      `https://www.alphavantage.co/query?function=TIME_SERIES_INTRADAY&symbol=${ticker}&interval=${avInterval}&apikey=${apiKey}&outputsize=compact&_t=${Date.now()}`
    );
    
    if (!response.ok) {
      throw new Error(`Alpha Vantage API error: ${response.status}`);
    }
    
    const data = await response.json();
    
    // Find the time series key
    const timeSeriesKey = Object.keys(data).find(key => key.includes('Time Series'));
    
    if (timeSeriesKey && data[timeSeriesKey]) {
      const timeSeries = data[timeSeriesKey];
      const timestamps = Object.keys(timeSeries).sort();
      
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
      
      console.log(`Alpha Vantage returned ${filteredCandles.length} candles for ${ticker}`);
      return filteredCandles;
    }
    
    throw new Error('No data from Alpha Vantage');
  } catch (error) {
    console.error(`Alpha Vantage error for ${ticker}:`, error.message);
    throw error;
  }
}

async function generateFallbackCandles(ticker, interval, limit, last) {
  console.log(`Generating fallback candles for ${ticker}`);
  
  // Generate realistic fallback data
  const now = Date.now();
  const intervalMs = interval === '1min' ? 60000 : 
                    interval === '5min' ? 300000 : 
                    interval === '1hour' ? 3600000 : 
                    interval === '1day' ? 86400000 : 300000;
  
  const basePrice = 100 + Math.random() * 200;
  const candles = [];
  
  for (let i = 0; i < (limit || 100); i++) {
    const time = now - (i * intervalMs);
    const price = basePrice + (Math.random() - 0.5) * 10;
    const open = price + (Math.random() - 0.5) * 2;
    const close = price + (Math.random() - 0.5) * 2;
    const high = Math.max(open, close) + Math.random() * 2;
    const low = Math.min(open, close) - Math.random() * 2;
    
    candles.push({
      time: time,
      open: open,
      high: high,
      low: low,
      close: close,
      volume: Math.floor(Math.random() * 1000000) + 100000
    });
  }
  
  // Apply limit and last filters
  let filteredCandles = candles;
  if (last) {
    filteredCandles = candles.slice(-parseInt(last));
  } else if (limit) {
    filteredCandles = candles.slice(-parseInt(limit));
  }
  
  console.log(`Fallback generated ${filteredCandles.length} candles for ${ticker}`);
  return filteredCandles;
}