// Live Data API - Robust with Yahoo Finance fallback
const fetch = require('node-fetch');

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();

  try {
    const { ticker, type = 'quote' } = req.query;
    
    if (!ticker) {
      return res.status(400).json({
        success: false,
        error: 'Ticker parameter is required'
      });
    }

    console.log(`=== FETCHING LIVE DATA FOR ${ticker} ===`);
    console.log('API Keys check:', {
      ALPHAVANTAGE_KEY: process.env.ALPHAVANTAGE_KEY ? 'SET' : 'MISSING',
      FINNHUB_KEY: process.env.FINNHUB_KEY ? 'SET' : 'MISSING'
    });

    let liveData = {};

    // Try Yahoo Finance first (most reliable)
    try {
      console.log(`Trying Yahoo Finance for ${ticker}...`);
      const response = await fetch(`https://query1.finance.yahoo.com/v8/finance/chart/${ticker}?interval=1d&range=1d&_t=${Date.now()}`, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
        }
      });
      
      if (response.ok) {
        const data = await response.json();
        
        if (data.chart && data.chart.result && data.chart.result[0]) {
          const result = data.chart.result[0];
          const meta = result.meta;
          const currentPrice = meta.regularMarketPrice || meta.previousClose || 0;
          const previousClose = meta.previousClose || currentPrice;
          const change = currentPrice - previousClose;
          const changePercent = previousClose > 0 ? (change / previousClose) * 100 : 0;
          
          liveData = {
            symbol: ticker,
            price: currentPrice,
            change: change,
            changePercent: changePercent,
            volume: meta.regularMarketVolume || 0,
            high: meta.regularMarketDayHigh || currentPrice,
            low: meta.regularMarketDayLow || currentPrice,
            open: meta.regularMarketOpen || currentPrice,
            previousClose: previousClose,
            timestamp: new Date().toISOString(),
            source: 'Yahoo Finance'
          };
          
          console.log(`✅ Yahoo Finance returned live data for ${ticker}: $${currentPrice} (${changePercent.toFixed(2)}%)`);
        }
      }
    } catch (error) {
      console.warn(`Yahoo Finance live data failed for ${ticker}:`, error.message);
    }

    // Try Alpha Vantage if Yahoo Finance fails
    if (!liveData.symbol) {
      try {
        const apiKey = process.env.ALPHAVANTAGE_KEY;
        if (apiKey) {
          console.log(`Trying Alpha Vantage for ${ticker}...`);
          const response = await fetch(`https://www.alphavantage.co/query?function=GLOBAL_QUOTE&symbol=${ticker}&apikey=${apiKey}&_t=${Date.now()}`);
          const data = await response.json();
          
          if (data['Global Quote']) {
            const quote = data['Global Quote'];
            liveData = {
              symbol: quote['01. symbol'],
              price: parseFloat(quote['05. price']),
              change: parseFloat(quote['09. change']),
              changePercent: parseFloat((quote['10. change percent'] || '0%').replace('%', '')),
              volume: parseInt(quote['06. volume']),
              high: parseFloat(quote['03. high']),
              low: parseFloat(quote['04. low']),
              open: parseFloat(quote['02. open']),
              previousClose: parseFloat(quote['08. previous close']),
              timestamp: new Date().toISOString(),
              source: 'Alpha Vantage'
            };
            console.log(`✅ Alpha Vantage returned live data for ${ticker}`);
          }
        }
      } catch (error) {
        console.warn(`Alpha Vantage live data failed for ${ticker}:`, error.message);
      }
    }

    // Try Finnhub if both above fail
    if (!liveData.symbol) {
      try {
        const apiKey = process.env.FINNHUB_KEY;
        if (apiKey) {
          console.log(`Trying Finnhub for ${ticker}...`);
          const response = await fetch(`https://finnhub.io/api/v1/quote?symbol=${ticker}&token=${apiKey}&_t=${Date.now()}`);
          const data = await response.json();
          
          if (data.c) {
            liveData = {
              symbol: ticker,
              price: data.c,
              change: data.d,
              changePercent: data.dp,
              volume: 0, // Finnhub doesn't provide volume in quote
              high: data.h,
              low: data.l,
              open: data.o,
              previousClose: data.pc,
              timestamp: new Date().toISOString(),
              source: 'Finnhub'
            };
            console.log(`✅ Finnhub returned live data for ${ticker}`);
          }
        }
      } catch (error) {
        console.warn(`Finnhub live data failed for ${ticker}:`, error.message);
      }
    }

    // Generate fallback data if no live data found
    if (!liveData.symbol) {
      console.log(`No live data found for ${ticker}, generating fallback data`);
      liveData = generateFallbackLiveData(ticker);
    }

    return res.status(200).json({
      success: true,
      data: liveData,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Live data error:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to fetch live data',
      data: {}
    });
  }
}

function generateFallbackLiveData(ticker) {
  // Generate realistic fallback data
  const basePrices = {
    'AAPL': 180, 'MSFT': 350, 'GOOGL': 140, 'AMZN': 150, 'TSLA': 200,
    'META': 300, 'NVDA': 450, 'NFLX': 400, 'AMD': 100, 'INTC': 35,
    'CRM': 220, 'ADBE': 500, 'PYPL': 60, 'UBER': 50, 'LYFT': 15,
    'ZOOM': 70, 'SNOW': 160, 'PLTR': 18, 'HOOD': 10, 'GME': 25,
    'AMC': 5, 'BB': 4, 'NOK': 3, 'SNDL': 1
  };
  
  const basePrice = basePrices[ticker.toUpperCase()] || (100 + Math.random() * 200);
  const change = (Math.random() - 0.5) * 10;
  const changePercent = (change / basePrice) * 100;
  
  return {
    symbol: ticker,
    price: basePrice,
    change: change,
    changePercent: changePercent,
    volume: Math.floor(Math.random() * 10000000) + 1000000,
    high: basePrice + Math.random() * 5,
    low: basePrice - Math.random() * 5,
    open: basePrice - change,
    previousClose: basePrice - change,
    timestamp: new Date().toISOString(),
    source: 'Fallback'
  };
}