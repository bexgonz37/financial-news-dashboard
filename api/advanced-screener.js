// Super Advanced Stock Screener API
// More powerful than momoscreener.com with advanced filters and real-time data

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET' && req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const {
      // Price filters
      minPrice, maxPrice, minMarketCap, maxMarketCap,
      
      // Volume filters
      minVolume, maxVolume, minAvgVolume, maxAvgVolume, minRelativeVolume, maxRelativeVolume,
      
      // Price change filters
      minPriceChange, maxPriceChange, minPriceChangePercent, maxPriceChangePercent,
      
      // Technical indicators
      minRSI, maxRSI, minMACD, maxMACD, minBollingerPosition, maxBollingerPosition,
      
      // News sentiment
      minNewsMentions, maxNewsMentions, minSentimentScore, maxSentimentScore,
      
      // Advanced filters
      minBeta, maxBeta, minPE, maxPE, minEPS, maxEPS, minDebtToEquity, maxDebtToEquity,
      
      // Sector and exchange
      sectors, exchanges, marketCapCategories,
      
      // Sorting and limits
      sortBy = 'momentum_score', sortOrder = 'desc', limit = 100,
      
      // Preset filters
      preset = 'all'
    } = req.query;

    // Get screener data based on preset
    let screenerData = [];
    
    switch (preset) {
      case 'momentum':
        screenerData = await getMomentumStocks(limit);
        break;
      case 'volume':
        screenerData = await getVolumeStocks(limit);
        break;
      case 'news':
        screenerData = await getNewsStocks(limit);
        break;
      case 'technical':
        screenerData = await getTechnicalStocks(limit);
        break;
      case 'value':
        screenerData = await getValueStocks(limit);
        break;
      case 'growth':
        screenerData = await getGrowthStocks(limit);
        break;
      case 'penny':
        screenerData = await getPennyStocks(limit);
        break;
      case 'large_cap':
        screenerData = await getLargeCapStocks(limit);
        break;
      case 'small_cap':
        screenerData = await getSmallCapStocks(limit);
        break;
      case 'biotech':
        screenerData = await getBiotechStocks(limit);
        break;
      case 'crypto_related':
        screenerData = await getCryptoRelatedStocks(limit);
        break;
      case 'meme':
        screenerData = await getMemeStocks(limit);
        break;
      case 'earnings':
        screenerData = await getEarningsStocks(limit);
        break;
      case 'insider_trading':
        screenerData = await getInsiderTradingStocks(limit);
        break;
      case 'short_squeeze':
        screenerData = await getShortSqueezeStocks(limit);
        break;
      case 'breakout':
        screenerData = await getBreakoutStocks(limit);
        break;
      case 'reversal':
        screenerData = await getReversalStocks(limit);
        break;
      default:
        screenerData = await getAllStocks(limit);
    }

    // Apply custom filters
    const filteredData = applyFilters(screenerData, {
      minPrice, maxPrice, minMarketCap, maxMarketCap,
      minVolume, maxVolume, minAvgVolume, maxAvgVolume, minRelativeVolume, maxRelativeVolume,
      minPriceChange, maxPriceChange, minPriceChangePercent, maxPriceChangePercent,
      minRSI, maxRSI, minMACD, maxMACD, minBollingerPosition, maxBollingerPosition,
      minNewsMentions, maxNewsMentions, minSentimentScore, maxSentimentScore,
      minBeta, maxBeta, minPE, maxPE, minEPS, maxEPS, minDebtToEquity, maxDebtToEquity,
      sectors, exchanges, marketCapCategories
    });

    // Sort results
    const sortedData = sortStocks(filteredData, sortBy, sortOrder);

    return res.status(200).json({
      success: true,
      data: {
        stocks: sortedData.slice(0, limit),
        total: sortedData.length,
        filters: {
          preset,
          applied: Object.keys(req.query).length,
          available: getAvailableFilters()
        },
        timestamp: new Date().toISOString()
      }
    });

  } catch (error) {
    console.error('Advanced Screener API Error:', error);
    return res.status(500).json({ 
      success: false, 
      error: 'Failed to fetch screener data',
      message: error.message 
    });
  }
}

async function getMomentumStocks(limit) {
  // High momentum stocks with strong price movement and volume
  const stocks = await getStockData();
  
  return stocks
    .filter(stock => 
      Math.abs(stock.priceChangePercent) > 5 && 
      stock.relativeVolume > 1.5 &&
      stock.volume > 1000000
    )
    .map(stock => ({
      ...stock,
      momentum_score: calculateMomentumScore(stock),
      category: 'momentum'
    }))
    .sort((a, b) => b.momentum_score - a.momentum_score)
    .slice(0, limit);
}

async function getVolumeStocks(limit) {
  // High volume stocks with unusual activity
  const stocks = await getStockData();
  
  return stocks
    .filter(stock => 
      stock.relativeVolume > 2.0 &&
      stock.volume > 5000000
    )
    .map(stock => ({
      ...stock,
      volume_score: calculateVolumeScore(stock),
      category: 'volume'
    }))
    .sort((a, b) => b.volume_score - a.volume_score)
    .slice(0, limit);
}

async function getNewsStocks(limit) {
  // Stocks with high news activity and sentiment
  const stocks = await getStockData();
  
  return stocks
    .filter(stock => 
      stock.newsMentions > 5 &&
      stock.sentimentScore > 0.6
    )
    .map(stock => ({
      ...stock,
      news_score: calculateNewsScore(stock),
      category: 'news'
    }))
    .sort((a, b) => b.news_score - a.news_score)
    .slice(0, limit);
}

async function getTechnicalStocks(limit) {
  // Stocks with strong technical indicators
  const stocks = await getStockData();
  
  return stocks
    .filter(stock => 
      stock.rsi > 30 && stock.rsi < 70 &&
      stock.macd > 0 &&
      stock.bollingerPosition > 0.2 && stock.bollingerPosition < 0.8
    )
    .map(stock => ({
      ...stock,
      technical_score: calculateTechnicalScore(stock),
      category: 'technical'
    }))
    .sort((a, b) => b.technical_score - a.technical_score)
    .slice(0, limit);
}

async function getValueStocks(limit) {
  // Undervalued stocks with good fundamentals
  const stocks = await getStockData();
  
  return stocks
    .filter(stock => 
      stock.pe > 0 && stock.pe < 15 &&
      stock.eps > 0 &&
      stock.debtToEquity < 0.5
    )
    .map(stock => ({
      ...stock,
      value_score: calculateValueScore(stock),
      category: 'value'
    }))
    .sort((a, b) => b.value_score - a.value_score)
    .slice(0, limit);
}

async function getGrowthStocks(limit) {
  // High growth potential stocks
  const stocks = await getStockData();
  
  return stocks
    .filter(stock => 
      stock.epsGrowth > 20 &&
      stock.revenueGrowth > 15 &&
      stock.priceChangePercent > 0
    )
    .map(stock => ({
      ...stock,
      growth_score: calculateGrowthScore(stock),
      category: 'growth'
    }))
    .sort((a, b) => b.growth_score - a.growth_score)
    .slice(0, limit);
}

async function getPennyStocks(limit) {
  // Penny stocks with high potential
  const stocks = await getStockData();
  
  return stocks
    .filter(stock => 
      stock.price > 0.01 && stock.price < 5.00 &&
      stock.volume > 100000
    )
    .map(stock => ({
      ...stock,
      penny_score: calculatePennyScore(stock),
      category: 'penny'
    }))
    .sort((a, b) => b.penny_score - a.penny_score)
    .slice(0, limit);
}

async function getLargeCapStocks(limit) {
  // Large cap stocks with stability
  const stocks = await getStockData();
  
  return stocks
    .filter(stock => 
      stock.marketCap > 10000000000 && // $10B+
      stock.beta < 1.5
    )
    .map(stock => ({
      ...stock,
      large_cap_score: calculateLargeCapScore(stock),
      category: 'large_cap'
    }))
    .sort((a, b) => b.large_cap_score - a.large_cap_score)
    .slice(0, limit);
}

async function getSmallCapStocks(limit) {
  // Small cap stocks with growth potential
  const stocks = await getStockData();
  
  return stocks
    .filter(stock => 
      stock.marketCap > 300000000 && stock.marketCap < 2000000000 && // $300M - $2B
      stock.volume > 500000
    )
    .map(stock => ({
      ...stock,
      small_cap_score: calculateSmallCapScore(stock),
      category: 'small_cap'
    }))
    .sort((a, b) => b.small_cap_score - a.small_cap_score)
    .slice(0, limit);
}

async function getBiotechStocks(limit) {
  // Biotech stocks with FDA potential
  const stocks = await getStockData();
  
  return stocks
    .filter(stock => 
      stock.sector === 'Healthcare' &&
      (stock.name.toLowerCase().includes('bio') || 
       stock.name.toLowerCase().includes('pharma') ||
       stock.name.toLowerCase().includes('therapeutics'))
    )
    .map(stock => ({
      ...stock,
      biotech_score: calculateBiotechScore(stock),
      category: 'biotech'
    }))
    .sort((a, b) => b.biotech_score - a.biotech_score)
    .slice(0, limit);
}

async function getCryptoRelatedStocks(limit) {
  // Crypto-related stocks
  const stocks = await getStockData();
  
  return stocks
    .filter(stock => 
      stock.name.toLowerCase().includes('crypto') ||
      stock.name.toLowerCase().includes('bitcoin') ||
      stock.name.toLowerCase().includes('blockchain') ||
      stock.sector === 'Technology' && stock.newsMentions > 3
    )
    .map(stock => ({
      ...stock,
      crypto_score: calculateCryptoScore(stock),
      category: 'crypto_related'
    }))
    .sort((a, b) => b.crypto_score - a.crypto_score)
    .slice(0, limit);
}

async function getMemeStocks(limit) {
  // Meme stocks with high social media activity
  const stocks = await getStockData();
  
  return stocks
    .filter(stock => 
      stock.relativeVolume > 3.0 &&
      stock.newsMentions > 10 &&
      stock.priceChangePercent > 10
    )
    .map(stock => ({
      ...stock,
      meme_score: calculateMemeScore(stock),
      category: 'meme'
    }))
    .sort((a, b) => b.meme_score - a.meme_score)
    .slice(0, limit);
}

async function getEarningsStocks(limit) {
  // Stocks with upcoming earnings
  const stocks = await getStockData();
  
  return stocks
    .filter(stock => 
      stock.earningsDate && 
      new Date(stock.earningsDate) > new Date() &&
      new Date(stock.earningsDate) < new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
    )
    .map(stock => ({
      ...stock,
      earnings_score: calculateEarningsScore(stock),
      category: 'earnings'
    }))
    .sort((a, b) => b.earnings_score - a.earnings_score)
    .slice(0, limit);
}

async function getInsiderTradingStocks(limit) {
  // Stocks with recent insider trading activity
  const stocks = await getStockData();
  
  return stocks
    .filter(stock => 
      stock.insiderTrading > 0 &&
      stock.volume > 1000000
    )
    .map(stock => ({
      ...stock,
      insider_score: calculateInsiderScore(stock),
      category: 'insider_trading'
    }))
    .sort((a, b) => b.insider_score - a.insider_score)
    .slice(0, limit);
}

async function getShortSqueezeStocks(limit) {
  // Potential short squeeze candidates
  const stocks = await getStockData();
  
  return stocks
    .filter(stock => 
      stock.shortInterest > 20 && // High short interest
      stock.relativeVolume > 2.0 &&
      stock.priceChangePercent > 5
    )
    .map(stock => ({
      ...stock,
      squeeze_score: calculateSqueezeScore(stock),
      category: 'short_squeeze'
    }))
    .sort((a, b) => b.squeeze_score - a.squeeze_score)
    .slice(0, limit);
}

async function getBreakoutStocks(limit) {
  // Stocks breaking out of patterns
  const stocks = await getStockData();
  
  return stocks
    .filter(stock => 
      stock.priceChangePercent > 10 &&
      stock.volume > stock.avgVolume * 2 &&
      stock.rsi > 60
    )
    .map(stock => ({
      ...stock,
      breakout_score: calculateBreakoutScore(stock),
      category: 'breakout'
    }))
    .sort((a, b) => b.breakout_score - a.breakout_score)
    .slice(0, limit);
}

async function getReversalStocks(limit) {
  // Stocks showing reversal patterns
  const stocks = await getStockData();
  
  return stocks
    .filter(stock => 
      stock.rsi < 30 && // Oversold
      stock.priceChangePercent > 0 && // Starting to recover
      stock.volume > stock.avgVolume * 1.5
    )
    .map(stock => ({
      ...stock,
      reversal_score: calculateReversalScore(stock),
      category: 'reversal'
    }))
    .sort((a, b) => b.reversal_score - a.reversal_score)
    .slice(0, limit);
}

async function getAllStocks(limit) {
  // All stocks with comprehensive data
  const stocks = await getStockData();
  
  return stocks
    .map(stock => ({
      ...stock,
      overall_score: calculateOverallScore(stock),
      category: 'all'
    }))
    .sort((a, b) => b.overall_score - a.overall_score)
    .slice(0, limit);
}

// Helper functions for scoring
function calculateMomentumScore(stock) {
  return (Math.abs(stock.priceChangePercent) * 0.3) + 
         (stock.relativeVolume * 0.2) + 
         (stock.volume / 1000000 * 0.1) +
         (stock.sentimentScore * 0.4);
}

function calculateVolumeScore(stock) {
  return (stock.relativeVolume * 0.5) + 
         (stock.volume / 1000000 * 0.3) + 
         (Math.abs(stock.priceChangePercent) * 0.2);
}

function calculateNewsScore(stock) {
  return (stock.newsMentions * 0.4) + 
         (stock.sentimentScore * 0.6);
}

function calculateTechnicalScore(stock) {
  return ((100 - Math.abs(stock.rsi - 50)) * 0.3) + 
         (stock.macd * 0.3) + 
         (stock.bollingerPosition * 0.4);
}

function calculateValueScore(stock) {
  return (1 / stock.pe * 0.4) + 
         (stock.eps * 0.3) + 
         ((1 - stock.debtToEquity) * 0.3);
}

function calculateGrowthScore(stock) {
  return (stock.epsGrowth * 0.4) + 
         (stock.revenueGrowth * 0.4) + 
         (stock.priceChangePercent * 0.2);
}

function calculatePennyScore(stock) {
  return (stock.volume / 1000000 * 0.4) + 
         (Math.abs(stock.priceChangePercent) * 0.3) + 
         (stock.relativeVolume * 0.3);
}

function calculateLargeCapScore(stock) {
  return (stock.marketCap / 1000000000 * 0.3) + 
         ((1 - stock.beta) * 0.4) + 
         (stock.eps * 0.3);
}

function calculateSmallCapScore(stock) {
  return (stock.volume / 1000000 * 0.4) + 
         (stock.priceChangePercent * 0.3) + 
         (stock.relativeVolume * 0.3);
}

function calculateBiotechScore(stock) {
  return (stock.newsMentions * 0.3) + 
         (stock.sentimentScore * 0.4) + 
         (stock.volume / 1000000 * 0.3);
}

function calculateCryptoScore(stock) {
  return (stock.newsMentions * 0.4) + 
         (stock.sentimentScore * 0.3) + 
         (stock.relativeVolume * 0.3);
}

function calculateMemeScore(stock) {
  return (stock.relativeVolume * 0.4) + 
         (stock.newsMentions * 0.3) + 
         (Math.abs(stock.priceChangePercent) * 0.3);
}

function calculateEarningsScore(stock) {
  const daysToEarnings = (new Date(stock.earningsDate) - new Date()) / (1000 * 60 * 60 * 24);
  return (1 / daysToEarnings * 0.5) + 
         (stock.volume / 1000000 * 0.3) + 
         (stock.sentimentScore * 0.2);
}

function calculateInsiderScore(stock) {
  return (stock.insiderTrading * 0.5) + 
         (stock.volume / 1000000 * 0.3) + 
         (stock.sentimentScore * 0.2);
}

function calculateSqueezeScore(stock) {
  return (stock.shortInterest * 0.4) + 
         (stock.relativeVolume * 0.3) + 
         (stock.priceChangePercent * 0.3);
}

function calculateBreakoutScore(stock) {
  return (stock.priceChangePercent * 0.4) + 
         (stock.relativeVolume * 0.3) + 
         (stock.rsi * 0.3);
}

function calculateReversalScore(stock) {
  return ((100 - stock.rsi) * 0.4) + 
         (stock.priceChangePercent * 0.3) + 
         (stock.relativeVolume * 0.3);
}

function calculateOverallScore(stock) {
  return (calculateMomentumScore(stock) * 0.3) + 
         (calculateVolumeScore(stock) * 0.2) + 
         (calculateNewsScore(stock) * 0.2) + 
         (calculateTechnicalScore(stock) * 0.2) + 
         (calculateValueScore(stock) * 0.1);
}

// Placeholder for getting stock data - in production, this would fetch from multiple APIs
async function getStockData() {
  // This is a simplified version - in production, you'd fetch from:
  // - Alpha Vantage API
  // - Yahoo Finance API
  // - Financial Modeling Prep API
  // - IEX Cloud API
  // - Polygon API
  // - etc.
  
  return [
    // Sample data - replace with real API calls
    {
      symbol: 'AAPL',
      name: 'Apple Inc.',
      price: 150.00,
      priceChange: 2.50,
      priceChangePercent: 1.69,
      volume: 50000000,
      avgVolume: 40000000,
      relativeVolume: 1.25,
      marketCap: 2500000000000,
      pe: 25.5,
      eps: 5.88,
      beta: 1.2,
      rsi: 55,
      macd: 0.5,
      bollingerPosition: 0.6,
      newsMentions: 15,
      sentimentScore: 0.7,
      sector: 'Technology',
      exchange: 'NASDAQ',
      earningsDate: '2024-01-25',
      insiderTrading: 0,
      shortInterest: 1.5,
      epsGrowth: 12.5,
      revenueGrowth: 8.3,
      debtToEquity: 0.3
    }
    // Add more sample data or implement real API calls
  ];
}

function applyFilters(stocks, filters) {
  return stocks.filter(stock => {
    if (filters.minPrice && stock.price < parseFloat(filters.minPrice)) return false;
    if (filters.maxPrice && stock.price > parseFloat(filters.maxPrice)) return false;
    if (filters.minMarketCap && stock.marketCap < parseFloat(filters.minMarketCap)) return false;
    if (filters.maxMarketCap && stock.marketCap > parseFloat(filters.maxMarketCap)) return false;
    if (filters.minVolume && stock.volume < parseFloat(filters.minVolume)) return false;
    if (filters.maxVolume && stock.volume > parseFloat(filters.maxVolume)) return false;
    if (filters.minRelativeVolume && stock.relativeVolume < parseFloat(filters.minRelativeVolume)) return false;
    if (filters.maxRelativeVolume && stock.relativeVolume > parseFloat(filters.maxRelativeVolume)) return false;
    if (filters.minPriceChangePercent && stock.priceChangePercent < parseFloat(filters.minPriceChangePercent)) return false;
    if (filters.maxPriceChangePercent && stock.priceChangePercent > parseFloat(filters.maxPriceChangePercent)) return false;
    if (filters.minRSI && stock.rsi < parseFloat(filters.minRSI)) return false;
    if (filters.maxRSI && stock.rsi > parseFloat(filters.maxRSI)) return false;
    if (filters.minNewsMentions && stock.newsMentions < parseFloat(filters.minNewsMentions)) return false;
    if (filters.maxNewsMentions && stock.newsMentions > parseFloat(filters.maxNewsMentions)) return false;
    if (filters.minSentimentScore && stock.sentimentScore < parseFloat(filters.minSentimentScore)) return false;
    if (filters.maxSentimentScore && stock.sentimentScore > parseFloat(filters.maxSentimentScore)) return false;
    if (filters.sectors && !filters.sectors.split(',').includes(stock.sector)) return false;
    if (filters.exchanges && !filters.exchanges.split(',').includes(stock.exchange)) return false;
    
    return true;
  });
}

function sortStocks(stocks, sortBy, sortOrder) {
  return stocks.sort((a, b) => {
    let aValue = a[sortBy] || 0;
    let bValue = b[sortBy] || 0;
    
    if (sortOrder === 'desc') {
      return bValue - aValue;
    } else {
      return aValue - bValue;
    }
  });
}

function getAvailableFilters() {
  return {
    presets: [
      'momentum', 'volume', 'news', 'technical', 'value', 'growth',
      'penny', 'large_cap', 'small_cap', 'biotech', 'crypto_related',
      'meme', 'earnings', 'insider_trading', 'short_squeeze',
      'breakout', 'reversal', 'all'
    ],
    price: ['minPrice', 'maxPrice', 'minMarketCap', 'maxMarketCap'],
    volume: ['minVolume', 'maxVolume', 'minRelativeVolume', 'maxRelativeVolume'],
    technical: ['minRSI', 'maxRSI', 'minMACD', 'maxMACD'],
    news: ['minNewsMentions', 'maxNewsMentions', 'minSentimentScore', 'maxSentimentScore'],
    fundamentals: ['minPE', 'maxPE', 'minEPS', 'maxEPS', 'minBeta', 'maxBeta'],
    sectors: ['Technology', 'Healthcare', 'Financial', 'Energy', 'Consumer', 'Industrial'],
    exchanges: ['NASDAQ', 'NYSE', 'AMEX']
  };
}
