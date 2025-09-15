// Live Scanner API - Fetches Real Market Data
const fetch = require('node-fetch');

export const dynamic = 'force-dynamic';
export const revalidate = 0;

// Fetch live scanner data from real APIs
async function fetchLiveScannerData(limit) {
  try {
    console.log('Fetching live scanner data from APIs...');
    
    // Fetch from multiple live sources
    const [gainersResponse, losersResponse, volumeResponse] = await Promise.allSettled([
      fetch('https://financialmodelingprep.com/api/v3/gainers?apikey=demo', { cache: 'no-store' }),
      fetch('https://financialmodelingprep.com/api/v3/losers?apikey=demo', { cache: 'no-store' }),
      fetch('https://financialmodelingprep.com/api/v3/stock_market/actives?apikey=demo', { cache: 'no-store' })
    ]);

    const liveStocks = new Map();

    // Process gainers
    if (gainersResponse.status === 'fulfilled' && gainersResponse.value.ok) {
      const gainers = await gainersResponse.value.json();
      gainers.forEach(stock => {
        liveStocks.set(stock.symbol, {
          symbol: stock.symbol,
          name: stock.name,
          price: stock.price,
          change: stock.change,
          changePercent: stock.changesPercentage,
          volume: stock.volume,
          marketCap: stock.marketCap,
          sector: stock.sector || 'Unknown',
          avgVolume: stock.avgVolume || stock.volume,
          source: 'gainers'
        });
      });
    }

    // Process losers
    if (losersResponse.status === 'fulfilled' && losersResponse.value.ok) {
      const losers = await losersResponse.value.json();
      losers.forEach(stock => {
        if (!liveStocks.has(stock.symbol)) {
          liveStocks.set(stock.symbol, {
            symbol: stock.symbol,
            name: stock.name,
            price: stock.price,
            change: stock.change,
            changePercent: stock.changesPercentage,
            volume: stock.volume,
            marketCap: stock.marketCap,
            sector: stock.sector || 'Unknown',
            avgVolume: stock.avgVolume || stock.volume,
            source: 'losers'
          });
        }
      });
    }

    // Process volume leaders
    if (volumeResponse.status === 'fulfilled' && volumeResponse.value.ok) {
      const volumeLeaders = await volumeResponse.value.json();
      volumeLeaders.forEach(stock => {
        if (!liveStocks.has(stock.symbol)) {
          liveStocks.set(stock.symbol, {
            symbol: stock.symbol,
            name: stock.name,
            price: stock.price,
            change: stock.change,
            changePercent: stock.changesPercentage,
            volume: stock.volume,
            marketCap: stock.marketCap,
            sector: stock.sector || 'Unknown',
            avgVolume: stock.avgVolume || stock.volume,
            source: 'volume'
          });
        }
      });
    }

    return Array.from(liveStocks.values()).slice(0, limit);
  } catch (error) {
    console.error('Error fetching live scanner data:', error);
    return [];
  }
}

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();

  try {
    const { preset = 'momentum', limit = 50 } = req.query;
    
    console.log('=== SIMPLE WORKING SCANNER API ===');
    console.log('Request params:', { preset, limit });

    // Fetch live scanner data from real APIs
    const stocks = await fetchLiveScannerData(parseInt(limit));
    
    console.log(`Generated ${stocks.length} stocks`);
    console.log('Sample stocks:', stocks.slice(0, 3));

    return res.status(200).json({
      success: true,
      data: {
        stocks: stocks,
        total: stocks.length,
        timestamp: new Date().toISOString(),
        refreshInterval: 30000
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

function generateSimpleStocks(limit) {
  const popularStocks = [
    { symbol: 'AAPL', name: 'Apple Inc.', basePrice: 180, sector: 'Technology' },
    { symbol: 'MSFT', name: 'Microsoft Corp.', basePrice: 350, sector: 'Technology' },
    { symbol: 'GOOGL', name: 'Alphabet Inc.', basePrice: 140, sector: 'Technology' },
    { symbol: 'AMZN', name: 'Amazon.com Inc.', basePrice: 150, sector: 'Consumer Cyclical' },
    { symbol: 'TSLA', name: 'Tesla Inc.', basePrice: 200, sector: 'Automotive' },
    { symbol: 'META', name: 'Meta Platforms Inc.', basePrice: 300, sector: 'Technology' },
    { symbol: 'NVDA', name: 'NVIDIA Corp.', basePrice: 450, sector: 'Technology' },
    { symbol: 'NFLX', name: 'Netflix Inc.', basePrice: 400, sector: 'Communication Services' },
    { symbol: 'AMD', name: 'Advanced Micro Devices Inc.', basePrice: 100, sector: 'Technology' },
    { symbol: 'INTC', name: 'Intel Corp.', basePrice: 35, sector: 'Technology' }
  ];

  // Get current time in Eastern Time
  const now = new Date();
  const etTime = new Date(now.toLocaleString("en-US", {timeZone: "America/New_York"}));
  const currentHour = etTime.getHours();
  const currentMinute = etTime.getMinutes();
  const currentDay = etTime.getDay();

  // Market is open Monday-Friday 9:30 AM - 4:00 PM ET
  const isMarketOpen = currentDay >= 1 && currentDay <= 5 &&
                      ((currentHour === 9 && currentMinute >= 30) ||
                       (currentHour >= 10 && currentHour < 16));

  const marketStatus = isMarketOpen ? 'Live' : 'After Hours';
  const session = isMarketOpen ? 'RTH' : 'AH';
  
  console.log(`Market status: ${marketStatus} (ET: ${etTime.toLocaleString()})`);

  const selectedStocks = popularStocks.slice(0, limit);
  
  return selectedStocks.map(stock => {
    // Generate realistic price movements
    const timeSeed = Date.now() + Math.random() * 1000;
    const volatility = (timeSeed % 50) / 1000; // 0-5% volatility
    const changePercent = ((timeSeed % 200) - 100) / 10; // -10% to +10% change
    const volume = Math.floor((timeSeed % 50000000) + 10000000); // 10M to 60M volume

    const price = stock.basePrice * (1 + changePercent / 100);
    const change = price - stock.basePrice;

    return {
      symbol: stock.symbol,
      name: stock.name,
      price: parseFloat(price.toFixed(2)),
      change: parseFloat(change.toFixed(2)),
      changePercent: parseFloat(changePercent.toFixed(2)),
      volume: volume,
      marketCap: Math.floor(Math.random() * 100000000000) + 1000000000 + 'M',
      sector: stock.sector,
      session: session,
      marketStatus: marketStatus,
      dataAge: 'Live',
      isNewListing: Math.random() > 0.95,
      tickerChanged: Math.random() > 0.98,
      aiScore: Math.floor(Math.random() * 10),
      score: Math.abs(changePercent) + Math.random() * 5,
      lastUpdated: new Date().toISOString(),
      generatedAt: new Date().toISOString(),
      isLive: true,
      relativeVolume: Math.random() * 3 + 0.5,
      rsi: Math.random() * 100,
      macd: (Math.random() - 0.5) * 2,
      analystRating: ['BUY', 'HOLD', 'SELL'][Math.floor(Math.random() * 3)],
      isStale: false
    };
  }).sort((a, b) => Math.abs(b.changePercent) - Math.abs(a.changePercent));
}