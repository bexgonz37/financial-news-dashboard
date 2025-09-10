// OHLC Data API - Real APIs Only
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

    console.log(`=== FETCHING LIVE OHLC DATA FOR ${ticker} FROM ALL APIS ===`);

    // Try multiple real data sources
    const dataSources = [
      () => fetchFromYahooFinance(ticker, interval, limit, last),
      () => fetchFromAlphaVantage(ticker, interval, limit, last),
      () => fetchFromFinnhub(ticker, interval, limit, last)
    ];
    
    for (let i = 0; i < dataSources.length; i++) {
      const sourceName = ['Yahoo Finance', 'Alpha Vantage', 'Finnhub'][i];
      try {
        console.log(`Trying ${sourceName} for ${ticker}...`);
        const candles = await dataSources[i]();
        if (candles && candles.length > 0) {
          console.log(`✅ ${sourceName} successfully fetched ${candles.length} candles for ${ticker}`);
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
      } catch (error) {
        console.warn(`❌ ${sourceName} failed for ${ticker}:`, error.message);
        continue;
      }
    }
    
    // If no data from any source, return empty array
    console.log(`❌ No live data found for ${ticker} from any API, returning empty array`);
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
    
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${ticker}?interval=${yahooInterval}&range=1d&includePrePost=false&events=div%2Csplit&_t=${Date.now()}`;
    console.log(`Yahoo Finance URL: ${url}`);
    
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
      }
    });
    
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
        })).filter(candle => candle.close > 0);
        
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
      
      console.log(`Alpha Vantage returned ${filteredCandles.length} candles for ${ticker}`);
      return filteredCandles;
    }
    
    throw new Error('No time series data from Alpha Vantage');
  } catch (error) {
    console.error(`Alpha Vantage error for ${ticker}:`, error.message);
    throw error;
  }
}

async function fetchFromFinnhub(ticker, interval, limit, last) {
  try {
    const apiKey = process.env.FINNHUB_KEY;
    if (!apiKey) {
      throw new Error('Finnhub API key not configured');
    }
    
    console.log(`Trying Finnhub for ${ticker}`);
    
    // Convert interval to Finnhub format
    const finnhubInterval = interval === '1min' ? '1' : 
                           interval === '5min' ? '5' : 
                           interval === '1hour' ? '60' : 
                           interval === '1day' ? 'D' : '5';
    
    const from = Math.floor((Date.now() - 24 * 60 * 60 * 1000) / 1000); // 24 hours ago
    const to = Math.floor(Date.now() / 1000);
    
    const response = await fetch(
      `https://finnhub.io/api/v1/stock/candle?symbol=${ticker}&resolution=${finnhubInterval}&from=${from}&to=${to}&token=${apiKey}&_t=${Date.now()}`
    );
    
    if (!response.ok) {
      if (response.status === 403) {
        console.log('Finnhub API 403 - API key invalid or rate limited, skipping');
        throw new Error('Finnhub API 403 - API key invalid or rate limited');
      }
      throw new Error(`Finnhub API error: ${response.status}`);
    }
    
    const data = await response.json();
    
    if (data.s === 'ok' && data.c && data.c.length > 0) {
      const candles = data.c.map((close, index) => ({
        time: data.t[index] * 1000, // Convert to milliseconds
        open: data.o[index] || close,
        high: data.h[index] || close,
        low: data.l[index] || close,
        close: close,
        volume: data.v[index] || 0
      })).filter(candle => candle.close > 0);
      
      console.log(`Finnhub raw candles length: ${candles.length}`);
      
      // Apply limit and last filters
      let filteredCandles = candles;
      if (last) {
        filteredCandles = candles.slice(-parseInt(last));
      } else if (limit) {
        filteredCandles = candles.slice(-parseInt(limit));
      }
      
      console.log(`Finnhub returned ${filteredCandles.length} candles for ${ticker}`);
      return filteredCandles;
    }
    
    throw new Error('No valid data from Finnhub');
  } catch (error) {
    console.error(`Finnhub error for ${ticker}:`, error.message);
    throw error;
  }
}