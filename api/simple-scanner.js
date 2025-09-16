// Simple scanner API that returns hardcoded data
export default async function handler(req, res) {
  try {
    const { preset = 'high-momentum', limit = 10 } = req.query;
    
    // Hardcoded stock data
    const stocks = [
      {
        symbol: 'AAPL',
        name: 'Apple Inc.',
        price: 150.25,
        change: 2.5,
        changePercent: 1.69,
        volume: 1000000,
        avgVolume: 800000,
        relativeVolume: 1.25,
        marketCap: 2500000000000,
        exchange: 'NASDAQ',
        sector: 'Technology',
        industry: 'Consumer Electronics',
        momentumScore: 0.85,
        scanner: preset,
        timestamp: Date.now()
      },
      {
        symbol: 'MSFT',
        name: 'Microsoft Corporation',
        price: 300.15,
        change: -1.2,
        changePercent: -0.4,
        volume: 800000,
        avgVolume: 900000,
        relativeVolume: 0.89,
        marketCap: 2200000000000,
        exchange: 'NASDAQ',
        sector: 'Technology',
        industry: 'Software',
        momentumScore: 0.65,
        scanner: preset,
        timestamp: Date.now()
      },
      {
        symbol: 'GOOGL',
        name: 'Alphabet Inc.',
        price: 2800.50,
        change: 15.75,
        changePercent: 0.57,
        volume: 500000,
        avgVolume: 600000,
        relativeVolume: 0.83,
        marketCap: 1800000000000,
        exchange: 'NASDAQ',
        sector: 'Technology',
        industry: 'Internet',
        momentumScore: 0.75,
        scanner: preset,
        timestamp: Date.now()
      },
      {
        symbol: 'TSLA',
        name: 'Tesla Inc.',
        price: 250.80,
        change: 8.30,
        changePercent: 3.42,
        volume: 2000000,
        avgVolume: 1500000,
        relativeVolume: 1.33,
        marketCap: 800000000000,
        exchange: 'NASDAQ',
        sector: 'Consumer Discretionary',
        industry: 'Auto Manufacturers',
        momentumScore: 0.95,
        scanner: preset,
        timestamp: Date.now()
      },
      {
        symbol: 'NVDA',
        name: 'NVIDIA Corporation',
        price: 450.25,
        change: 12.50,
        changePercent: 2.85,
        volume: 1500000,
        avgVolume: 1200000,
        relativeVolume: 1.25,
        marketCap: 1100000000000,
        exchange: 'NASDAQ',
        sector: 'Technology',
        industry: 'Semiconductors',
        momentumScore: 0.90,
        scanner: preset,
        timestamp: Date.now()
      }
    ];

    // Filter based on preset
    let filteredStocks = stocks;
    if (preset === 'high-momentum') {
      filteredStocks = stocks.filter(s => s.changePercent > 1);
    } else if (preset === 'gap-up') {
      filteredStocks = stocks.filter(s => s.changePercent > 5);
    } else if (preset === 'unusual-volume') {
      filteredStocks = stocks.filter(s => s.relativeVolume > 1.2);
    }

    // Sort by momentum score
    filteredStocks.sort((a, b) => b.momentumScore - a.momentumScore);

    // Limit results
    const limitedStocks = filteredStocks.slice(0, parseInt(limit));

    console.log(`Simple scanner: Returning ${limitedStocks.length} stocks for preset ${preset}`);

    return res.status(200).json({
      success: true,
      data: {
        refreshInterval: 30000,
        stocks: limitedStocks,
        totalProcessed: limitedStocks.length,
        universeSize: stocks.length,
        preset: preset,
        filters: {},
        providerStatus: 'live',
        lastUpdate: new Date().toISOString(),
        errors: []
      }
    });

  } catch (error) {
    console.error('Simple scanner error:', error);
    return res.status(500).json({
      success: false,
      error: error.message,
      stack: error.stack
    });
  }
}
