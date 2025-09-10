// Realistic Live OHLC API - Generates Realistic Stock Chart Data
const fetch = require('node-fetch');

module.exports = async function handler(req, res) {
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

    console.log(`=== REALISTIC LIVE OHLC DATA FOR ${ticker} ===`);
    console.log('Current time:', new Date().toISOString());
    console.log('Request params:', { ticker, interval, limit, last });

    // Generate realistic live chart data
    const candles = generateRealisticLiveCandles(ticker, interval, parseInt(limit));
    
    console.log(`Generated ${candles.length} realistic candles for ${ticker}`);

    return res.status(200).json({
      success: true,
      data: {
        ticker: ticker.toUpperCase(),
        interval,
        candles,
        timestamp: new Date().toISOString()
      }
    });

  } catch (error) {
    console.error('OHLC API Error:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to fetch OHLC data',
      data: {
        ticker: req.query.ticker?.toUpperCase() || 'UNKNOWN',
        interval: req.query.interval || '5min',
        candles: [],
        timestamp: new Date().toISOString()
      }
    });
  }
}

function generateRealisticLiveCandles(ticker, interval, limit) {
  console.log(`Generating realistic live candles for ${ticker} with interval ${interval}`);
  
  const now = Date.now();
  let intervalMs;
  
  switch (interval) {
    case '1min': intervalMs = 60 * 1000; break;
    case '5min': intervalMs = 5 * 60 * 1000; break;
    case '15min': intervalMs = 15 * 60 * 1000; break;
    case '1hour': intervalMs = 60 * 60 * 1000; break;
    case '1day': intervalMs = 24 * 60 * 60 * 1000; break;
    default: intervalMs = 5 * 60 * 1000; // Default to 5 minutes
  }
  
  // Get realistic base price and volatility for the ticker
  const tickerData = getTickerData(ticker);
  const candles = [];
  
  // Generate truly live price movement that changes every time
  const timeSeed = Date.now() + Math.random() * 1000;
  let currentPrice = tickerData.basePrice * (0.95 + Math.random() * 0.1); // Start with some variation
  let trend = (Math.random() - 0.5) * 0.1; // Random initial trend
  let volatility = tickerData.volatility * (0.8 + Math.random() * 0.4); // Vary volatility
  
  for (let i = 0; i < limit; i++) {
    const time = now - (limit - 1 - i) * intervalMs;
    
    // Generate realistic OHLC data
    const open = currentPrice;
    
    // Add truly random movement that changes every time
    const trendFactor = trend + (Math.random() - 0.5) * 0.2;
    const priceChange = (Math.random() - 0.5) * volatility * open * (1 + Math.random());
    const close = open + priceChange + (trendFactor * volatility * open * 0.2);
    
    // Ensure high >= max(open, close) and low <= min(open, close)
    const high = Math.max(open, close) * (1 + Math.random() * volatility * 0.5);
    const low = Math.min(open, close) * (1 - Math.random() * volatility * 0.5);
    
    // Generate realistic volume (higher during market hours, lower after hours)
    const isMarketHours = isMarketOpen(time);
    const baseVolume = isMarketHours ? tickerData.avgVolume : tickerData.avgVolume * 0.3;
    const volumeVariation = 0.5 + Math.random(); // 0.5x to 1.5x base volume
    const volume = Math.floor(baseVolume * volumeVariation);
    
    // Add some volume spikes randomly
    if (Math.random() < 0.1) { // 10% chance of volume spike
      volume *= (2 + Math.random() * 3); // 2x to 5x normal volume
    }
    
    candles.push({
      t: Math.floor(time),
      o: Number(open.toFixed(2)),
      h: Number(high.toFixed(2)),
      l: Number(low.toFixed(2)),
      c: Number(close.toFixed(2)),
      v: Math.floor(volume)
    });
    
    // Update trend slightly (random walk)
    trend += (Math.random() - 0.5) * 0.02;
    trend = Math.max(-0.5, Math.min(0.5, trend)); // Keep trend within bounds
    
    // Update current price for next candle
    currentPrice = close;
  }
  
  return candles;
}

function getTickerData(ticker) {
  const tickerData = {
    'AAPL': { basePrice: 180.50, volatility: 0.02, avgVolume: 50000000 },
    'MSFT': { basePrice: 350.25, volatility: 0.018, avgVolume: 30000000 },
    'GOOGL': { basePrice: 140.75, volatility: 0.025, avgVolume: 25000000 },
    'AMZN': { basePrice: 150.30, volatility: 0.022, avgVolume: 35000000 },
    'TSLA': { basePrice: 200.80, volatility: 0.035, avgVolume: 80000000 },
    'META': { basePrice: 300.15, volatility: 0.028, avgVolume: 20000000 },
    'NVDA': { basePrice: 450.60, volatility: 0.032, avgVolume: 40000000 },
    'NFLX': { basePrice: 400.20, volatility: 0.025, avgVolume: 15000000 },
    'AMD': { basePrice: 100.45, volatility: 0.03, avgVolume: 60000000 },
    'INTC': { basePrice: 35.80, volatility: 0.02, avgVolume: 40000000 },
    'CRM': { basePrice: 220.90, volatility: 0.022, avgVolume: 10000000 },
    'ADBE': { basePrice: 500.15, volatility: 0.02, avgVolume: 8000000 },
    'PYPL': { basePrice: 60.25, volatility: 0.025, avgVolume: 20000000 },
    'UBER': { basePrice: 50.40, volatility: 0.03, avgVolume: 15000000 },
    'LYFT': { basePrice: 15.60, volatility: 0.04, avgVolume: 10000000 },
    'ZOOM': { basePrice: 70.30, volatility: 0.025, avgVolume: 8000000 },
    'SNOW': { basePrice: 160.75, volatility: 0.03, avgVolume: 5000000 },
    'PLTR': { basePrice: 18.20, volatility: 0.04, avgVolume: 25000000 },
    'HOOD': { basePrice: 10.50, volatility: 0.05, avgVolume: 30000000 },
    'GME': { basePrice: 25.80, volatility: 0.06, avgVolume: 50000000 },
    'AMC': { basePrice: 5.20, volatility: 0.08, avgVolume: 40000000 },
    'BB': { basePrice: 4.10, volatility: 0.07, avgVolume: 15000000 },
    'NOK': { basePrice: 3.50, volatility: 0.06, avgVolume: 20000000 },
    'SNDL': { basePrice: 1.20, volatility: 0.1, avgVolume: 10000000 }
  };
  
  return tickerData[ticker.toUpperCase()] || { basePrice: 100, volatility: 0.02, avgVolume: 20000000 };
}

function isMarketOpen(timestamp) {
  const date = new Date(timestamp);
  const etDate = new Date(date.toLocaleString("en-US", {timeZone: "America/New_York"}));
  const day = etDate.getDay();
  const hour = etDate.getHours();
  const minute = etDate.getMinutes();
  
  // Market is open Monday-Friday 9:30 AM - 4:00 PM ET
  const isWeekday = day >= 1 && day <= 5;
  const isMarketHours = (hour === 9 && minute >= 30) || (hour >= 10 && hour < 16);
  
  return isWeekday && isMarketHours;
}