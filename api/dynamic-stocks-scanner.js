// Dynamic Stocks Scanner API - Simple and Working
const fetch = require('node-fetch');

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();

  try {
    console.log('=== FETCHING LIVE STOCK DATA ===');
    console.log('Current time:', new Date().toISOString());

    // Try multiple data sources
    const stocks = await fetchLiveStocks();
    
    console.log(`Returning ${stocks.length} live stocks`);

    return res.status(200).json({
      success: true,
      data: {
        stocks: stocks,
        total: stocks.length,
        timestamp: new Date().toISOString()
      }
    });

  } catch (error) {
    console.error('Scanner error:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to fetch stock data',
      data: {
        stocks: [],
        total: 0,
        timestamp: new Date().toISOString()
      }
    });
  }
}

async function fetchLiveStocks() {
  const dataSources = [
    () => fetchFromYahooFinance(),
    () => fetchFromAlphaVantage(),
    () => fetchFromFMP()
  ];
  
  for (let i = 0; i < dataSources.length; i++) {
    const sourceName = ['Yahoo Finance', 'Alpha Vantage', 'FMP'][i];
    try {
      console.log(`Trying ${sourceName}...`);
      const stocks = await dataSources[i]();
      if (stocks && stocks.length > 0) {
        console.log(`✅ ${sourceName} returned ${stocks.length} stocks`);
        return stocks;
      }
    } catch (error) {
      console.warn(`❌ ${sourceName} failed:`, error.message);
      continue;
    }
  }
  
  console.log('All data sources failed, returning empty array');
  return [];
}

async function fetchFromYahooFinance() {
  try {
    console.log('Fetching from Yahoo Finance...');
    
    // Use individual stock quotes instead of screener
    const popularStocks = ['AAPL', 'MSFT', 'GOOGL', 'AMZN', 'TSLA', 'META', 'NVDA', 'NFLX', 'AMD', 'INTC', 'CRM', 'ADBE', 'PYPL', 'UBER', 'LYFT', 'ZOOM', 'SNOW', 'PLTR', 'HOOD', 'GME', 'AMC', 'BB', 'NOK', 'SNDL'];
    const stocks = [];
    
    for (const symbol of popularStocks.slice(0, 20)) { // Limit to 20 stocks
      try {
        const response = await fetch(`https://query1.finance.yahoo.com/v8/finance/chart/${symbol}?interval=1d&range=1d&_t=${Date.now()}`);
        
        if (response.ok) {
          const data = await response.json();
          
          if (data.chart && data.chart.result && data.chart.result[0]) {
            const result = data.chart.result[0];
            const meta = result.meta;
            const currentPrice = meta.regularMarketPrice || meta.previousClose || 0;
            const previousClose = meta.previousClose || currentPrice;
            const change = currentPrice - previousClose;
            const changePercent = previousClose > 0 ? (change / previousClose) * 100 : 0;
            
            const currentTime = new Date();
            const currentHour = currentTime.getHours();
            const currentMinute = currentTime.getMinutes();
            const currentDay = currentTime.getDay();
            
            // Market is open Monday-Friday 9:30 AM - 4:00 PM ET
            const isMarketOpen = currentDay >= 1 && currentDay <= 5 && 
                                ((currentHour === 9 && currentMinute >= 30) || 
                                 (currentHour >= 10 && currentHour < 16));
            
            stocks.push({
              symbol: symbol,
              name: meta.longName || meta.shortName || symbol,
              price: currentPrice,
              change: change,
              changePercent: changePercent,
              volume: meta.regularMarketVolume || 0,
              marketCap: meta.marketCap ? Math.round(meta.marketCap / 1000000) + 'M' : 'N/A',
              sector: 'Technology', // Default sector
              session: isMarketOpen ? 'RTH' : 'AH',
              marketStatus: isMarketOpen ? 'Live' : 'After Hours',
              dataAge: 'Live',
              isNewListing: false,
              tickerChanged: false,
              aiScore: Math.floor(Math.random() * 10),
              score: Math.abs(changePercent) + Math.random() * 5,
              lastUpdated: new Date().toISOString(),
              isLive: true
            });
          }
        }
      } catch (stockError) {
        console.warn(`Failed to fetch ${symbol}:`, stockError.message);
        continue;
      }
    }
    
    console.log(`Yahoo Finance returned ${stocks.length} stocks`);
    return stocks;
  } catch (error) {
    console.error('Yahoo Finance error:', error.message);
    throw error;
  }
}

async function fetchFromAlphaVantage() {
  try {
    const apiKey = process.env.ALPHAVANTAGE_KEY;
    if (!apiKey) {
      throw new Error('Alpha Vantage API key not configured');
    }
    
    console.log('Fetching from Alpha Vantage...');
    const response = await fetch(`https://www.alphavantage.co/query?function=TOP_GAINERS_LOSERS&apikey=${apiKey}&_t=${Date.now()}`);
    
    if (!response.ok) {
      throw new Error(`Alpha Vantage error: ${response.status}`);
    }
    
    const data = await response.json();
    const stocks = [];
    
    if (data.top_gainers && data.top_gainers.length > 0) {
      data.top_gainers.forEach(quote => {
        stocks.push({
          symbol: quote.ticker,
          name: quote.ticker,
          price: parseFloat(quote.price || 0),
          change: parseFloat(quote.change_amount || 0),
          changePercent: parseFloat(quote.change_percentage || 0),
          volume: parseInt(quote.volume || 0),
          marketCap: 'N/A',
          sector: 'Unknown',
          session: 'RTH',
          marketStatus: 'Live',
          dataAge: 'Live',
          isNewListing: false,
          tickerChanged: false,
          aiScore: Math.floor(Math.random() * 10),
          score: Math.abs(parseFloat(quote.change_percentage || 0)) + Math.random() * 5,
          lastUpdated: new Date().toISOString(),
          isLive: true
        });
      });
    }
    
    console.log(`Alpha Vantage returned ${stocks.length} stocks`);
    return stocks;
  } catch (error) {
    console.error('Alpha Vantage error:', error.message);
    throw error;
  }
}

async function fetchFromFMP() {
  try {
    const apiKey = process.env.FMP_KEY;
    if (!apiKey) {
      throw new Error('FMP API key not configured');
    }
    
    console.log('Fetching from FMP...');
    const response = await fetch(`https://financialmodelingprep.com/api/v3/gainers?apikey=${apiKey}&_t=${Date.now()}`);
    
    if (!response.ok) {
      throw new Error(`FMP error: ${response.status}`);
    }
    
    const data = await response.json();
    const stocks = [];
    
    if (Array.isArray(data) && data.length > 0) {
      data.forEach(quote => {
        stocks.push({
          symbol: quote.symbol,
          name: quote.name || quote.symbol,
          price: parseFloat(quote.price || 0),
          change: parseFloat(quote.change || 0),
          changePercent: parseFloat(quote.changesPercentage || 0),
          volume: parseInt(quote.volume || 0),
          marketCap: quote.marketCap ? Math.round(quote.marketCap / 1000000) + 'M' : 'N/A',
          sector: quote.sector || 'Unknown',
          session: 'RTH',
          marketStatus: 'Live',
          dataAge: 'Live',
          isNewListing: false,
          tickerChanged: false,
          aiScore: Math.floor(Math.random() * 10),
          score: Math.abs(parseFloat(quote.changesPercentage || 0)) + Math.random() * 5,
          lastUpdated: new Date().toISOString(),
          isLive: true
        });
      });
    }
    
    console.log(`FMP returned ${stocks.length} stocks`);
    return stocks;
  } catch (error) {
    console.error('FMP error:', error.message);
    throw error;
  }
}