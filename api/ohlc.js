// OHLC Data API - Enhanced with better error handling
module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const { ticker, interval = '1d', outputsize = 'compact' } = req.query;
    const symbol = ticker; // Map ticker to symbol for compatibility
    
    if (!symbol) {
      return res.status(400).json({ error: 'Ticker parameter is required' });
    }

    // Validate interval
    const validIntervals = ['1m', '5m', '15m', '30m', '60m', '1d', '1w', '1M'];
    if (!validIntervals.includes(interval)) {
      return res.status(400).json({ error: 'Invalid interval parameter' });
    }

    // Get OHLC data from Alpha Vantage
    const ohlcData = await fetchOHLCData(symbol, interval, outputsize);
    
    if (!ohlcData) {
      return res.status(404).json({ error: 'No data found for symbol' });
    }

    return res.status(200).json({
      success: true,
      symbol: symbol.toUpperCase(),
      interval,
      candles: ohlcData.candles,
      timestamp: new Date().toISOString()
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

async function fetchOHLCData(symbol, interval, outputsize) {
  const apiKey = process.env.ALPHAVANTAGE_KEY;
  if (!apiKey) {
    throw new Error('Alpha Vantage API key not configured');
  }

  // Map interval to Alpha Vantage function
  let functionName = 'TIME_SERIES_DAILY';
  if (interval === '1m') functionName = 'TIME_SERIES_INTRADAY';
  else if (interval === '5m' || interval === '15m' || interval === '30m' || interval === '60m') {
    functionName = 'TIME_SERIES_INTRADAY';
  } else if (interval === '1w') functionName = 'TIME_SERIES_WEEKLY';
  else if (interval === '1M') functionName = 'TIME_SERIES_MONTHLY';

  let url = `https://www.alphavantage.co/query?function=${functionName}&symbol=${symbol.toUpperCase()}&apikey=${apiKey}`;
  
  if (functionName === 'TIME_SERIES_INTRADAY') {
    url += `&interval=${interval}`;
  }
  
  if (outputsize) {
    url += `&outputsize=${outputsize}`;
  }

  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Alpha Vantage API error: ${response.status}`);
  }

  const data = await response.json();
  
  // Check for API errors
  if (data['Error Message']) {
    throw new Error(data['Error Message']);
  }
  
  if (data['Note']) {
    throw new Error('API rate limit exceeded. Please try again later.');
  }

  // Extract time series data
  let timeSeriesKey = '';
  if (functionName === 'TIME_SERIES_INTRADAY') timeSeriesKey = `Time Series (${interval})`;
  else if (functionName === 'TIME_SERIES_DAILY') timeSeriesKey = 'Time Series (Daily)';
  else if (functionName === 'TIME_SERIES_WEEKLY') timeSeriesKey = 'Weekly Time Series';
  else if (functionName === 'TIME_SERIES_MONTHLY') timeSeriesKey = 'Monthly Time Series';

  const timeSeriesData = data[timeSeriesKey];
  if (!timeSeriesData) {
    throw new Error('No time series data found');
  }

  // Process and format the data for LightweightCharts
  const candles = [];
  const dates = Object.keys(timeSeriesData).sort().reverse(); // Most recent first
  
  for (const date of dates) {
    const candle = timeSeriesData[date];
    const timestamp = new Date(date).getTime(); // Convert to milliseconds
    
    candles.push({
      t: timestamp, // Time in milliseconds
      o: parseFloat(candle['1. open']), // Open
      h: parseFloat(candle['2. high']), // High
      l: parseFloat(candle['3. low']),  // Low
      c: parseFloat(candle['4. close']), // Close
      v: parseInt(candle['5. volume'])  // Volume
    });
  }

  return { candles };
}