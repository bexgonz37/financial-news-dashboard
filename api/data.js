// Financial News Data API - Enhanced with Comprehensive Company Matching
// Note: Company matching functions are simplified for basic functionality

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET' && req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const { ticker, search } = req.query;
    const { title, summary, text } = req.body || {};

    // Get enhanced news data from multiple sources
    const newsData = await fetchEnhancedNewsData(ticker, search);
    
    // Process news with enhanced company matching
    const processedNews = await processNewsWithCompanyMatching(newsData, title, summary, text);

    return res.status(200).json({
      success: true,
      data: {
        news: processedNews,
        timestamp: new Date().toISOString()
      }
    });

  } catch (error) {
    console.error('API Error:', error);
    return res.status(500).json({ 
      success: false, 
      error: 'Failed to fetch data',
      message: error.message 
    });
  }
}

async function fetchEnhancedNewsData(ticker, search) {
  // Direct Alpha Vantage implementation for reliability
  const apiKey = process.env.ALPHAVANTAGE_KEY;
  if (!apiKey) {
    console.warn('Alpha Vantage API key not configured, using fallback');
    return getFallbackNewsData(ticker, search);
  }

  try {
    let url = `https://www.alphavantage.co/query?function=NEWS_SENTIMENT&apikey=${apiKey}&limit=200`;
    
    if (ticker) {
      url += `&tickers=${ticker}`;
    }
    
    if (search) {
      url += `&topics=${search}`;
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

    const news = data.feed || [];
    
    // Enhance the news with additional data
    return news.map(item => ({
      ...item,
      id: item.id || `news_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      source: item.source || 'Alpha Vantage',
      source_domain: extractDomain(item.url),
      publishedAt: item.time_published,
      category: categorizeNews(item.title, item.summary),
      sentimentScore: parseFloat(item.overall_sentiment_score) || 0,
      relevanceScore: parseFloat(item.relevance_score) || 0.5,
      ticker: item.ticker_sentiment?.[0]?.ticker || 'GENERAL'
    }));
    
  } catch (error) {
    console.error('News fetch error:', error);
    throw error;
  }
}

async function processNewsWithCompanyMatching(newsData, title, summary, text) {
  const processedNews = [];

  for (const news of newsData) {
    try {
      let ticker = 'GENERAL';
      let category = 'General';
      let sentimentScore = 0;

      // Try to get ticker from Alpha Vantage's ticker_sentiment first
      if (news.ticker_sentiment && news.ticker_sentiment.length > 0) {
        const bestTicker = news.ticker_sentiment[0];
        ticker = bestTicker.ticker;
        sentimentScore = parseFloat(bestTicker.relevance_score) || 0;
      } else {
        // Basic company matching logic (simplified)
        const articleText = `${news.title} ${news.summary}`;
        const tickerMatch = articleText.match(/\b[A-Z]{1,5}\b/g);
        
        if (tickerMatch && tickerMatch.length > 0) {
          // Use the first ticker found
          ticker = tickerMatch[0];
          sentimentScore = 0.5; // Default sentiment
        }
      }

      // Determine category based on ticker and content
      if (ticker !== 'GENERAL') {
        category = 'Company Specific';
      } else if (news.topics && news.topics.length > 0) {
        category = news.topics[0];
      } else {
        category = 'General Market';
      }

      // Enhanced sentiment analysis
      let overallSentiment = 'neutral';
      let sentimentLabel = 'Neutral';
      
      if (news.overall_sentiment_label) {
        overallSentiment = news.overall_sentiment_label.toLowerCase();
        sentimentLabel = news.overall_sentiment_label;
      } else if (sentimentScore > 0.6) {
        overallSentiment = 'positive';
        sentimentLabel = 'Positive';
      } else if (sentimentScore < 0.4) {
        overallSentiment = 'negative';
        sentimentLabel = 'Negative';
      }

      // Calculate relevance score
      let relevanceScore = 0;
      if (news.relevance_score) {
        relevanceScore = parseFloat(news.relevance_score);
      } else if (ticker !== 'GENERAL') {
        relevanceScore = 0.7; // Default relevance for company-specific news
      } else {
        relevanceScore = 0.5; // Default relevance for general news
      }

      // Enhanced news processing
      const processedNewsItem = {
        id: news.id || `news_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        title: news.title,
        summary: news.summary,
        url: news.url,
        time_published: news.time_published,
        authors: news.authors || [],
        ticker: ticker,
        category: category,
        sentiment: {
          overall: overallSentiment,
          label: sentimentLabel,
          score: sentimentScore,
          relevance: relevanceScore
        },
        source: news.source,
        banner_image: news.banner_image,
        summary_short: news.summary_short || news.summary?.substring(0, 150) + '...',
        ticker_sentiment: news.ticker_sentiment || [],
        topics: news.topics || [],
        overall_sentiment_score: news.overall_sentiment_score || 0,
        overall_sentiment_label: news.overall_sentiment_label || 'Neutral',
        relevance_score: relevanceScore,
        source_domain: news.source_domain || extractDomain(news.url),
        published_time: news.time_published || news.published_time,
        // Additional fields for enhanced functionality
        market_impact: calculateMarketImpact(news, ticker),
        trading_opportunity: identifyTradingOpportunity(news, ticker),
        risk_level: assessRiskLevel(news, ticker),
        sector: extractSectorFromContent(news),
        market_cap_category: categorizeMarketCap(news),
        volatility_impact: assessVolatilityImpact(news),
        earnings_impact: assessEarningsImpact(news),
        regulatory_impact: assessRegulatoryImpact(news),
        competitive_impact: assessCompetitiveImpact(news),
        global_impact: assessGlobalImpact(news)
      };

      processedNews.push(processedNewsItem);

    } catch (error) {
      console.error('Error processing news item:', error);
      // Continue with next news item
    }
  }

  return processedNews;
}

// Fallback news data when API keys are not available
async function getFallbackNewsData(ticker, search) {
  const fallbackNews = [
    {
      id: 'fallback_1',
      title: 'Market Update: Stocks Show Mixed Signals',
      summary: 'The market is showing mixed signals today with technology stocks leading gains while energy sector faces headwinds.',
      url: 'https://example.com/news1',
      time_published: new Date().toISOString(),
      authors: ['Market Reporter'],
      ticker: ticker || 'GENERAL',
      category: 'market',
      sentimentScore: 0.2,
      relevanceScore: 0.8,
      source: 'Market Data',
      source_domain: 'example.com',
      publishedAt: new Date().toISOString()
    },
    {
      id: 'fallback_2',
      title: 'Trading Volume Surges in Afternoon Session',
      summary: 'Trading volume has surged in the afternoon session as investors react to economic data releases.',
      url: 'https://example.com/news2',
      time_published: new Date().toISOString(),
      authors: ['Trading Desk'],
      ticker: ticker || 'GENERAL',
      category: 'trading',
      sentimentScore: 0.5,
      relevanceScore: 0.7,
      source: 'Trading News',
      source_domain: 'example.com',
      publishedAt: new Date().toISOString()
    },
    {
      id: 'fallback_3',
      title: 'Federal Reserve Policy Update Expected',
      summary: 'Investors are awaiting the Federal Reserve policy update which could impact market direction.',
      url: 'https://example.com/news3',
      time_published: new Date().toISOString(),
      authors: ['Fed Reporter'],
      ticker: ticker || 'GENERAL',
      category: 'fed',
      sentimentScore: 0.1,
      relevanceScore: 0.9,
      source: 'Fed News',
      source_domain: 'example.com',
      publishedAt: new Date().toISOString()
    }
  ];

  return fallbackNews;
}

function categorizeNews(title, summary) {
  const text = `${title} ${summary}`.toLowerCase();
  
  if (text.includes('earnings') || text.includes('revenue') || text.includes('profit')) return 'earnings';
  if (text.includes('fda') || text.includes('approval') || text.includes('clinical')) return 'fda';
  if (text.includes('merger') || text.includes('acquisition') || text.includes('buyout')) return 'merger';
  if (text.includes('insider') || text.includes('insider trading')) return 'insider';
  if (text.includes('short') || text.includes('short interest')) return 'short';
  if (text.includes('options') || text.includes('calls') || text.includes('puts')) return 'options';
  if (text.includes('analyst') || text.includes('rating') || text.includes('upgrade')) return 'analyst';
  if (text.includes('sec') || text.includes('filing') || text.includes('10-k')) return 'sec';
  if (text.includes('dividend') || text.includes('payout')) return 'dividend';
  if (text.includes('bankruptcy') || text.includes('chapter 11')) return 'bankruptcy';
  if (text.includes('ipo') || text.includes('spac') || text.includes('public offering')) return 'ipo';
  if (text.includes('crypto') || text.includes('bitcoin') || text.includes('ethereum')) return 'crypto';
  if (text.includes('meme') || text.includes('reddit') || text.includes('wallstreetbets')) return 'meme';
  if (text.includes('biotech') || text.includes('pharma') || text.includes('drug')) return 'biotech';
  if (text.includes('ai') || text.includes('artificial intelligence') || text.includes('machine learning')) return 'ai';
  if (text.includes('ev') || text.includes('electric vehicle') || text.includes('tesla')) return 'ev';
  if (text.includes('cannabis') || text.includes('marijuana') || text.includes('weed')) return 'cannabis';
  if (text.includes('gaming') || text.includes('video game') || text.includes('esports')) return 'gaming';
  if (text.includes('social') || text.includes('facebook') || text.includes('twitter')) return 'social';
  if (text.includes('retail') || text.includes('ecommerce') || text.includes('shopping')) return 'retail';
  
  return 'general';
}

function extractDomain(url) {
  if (!url) return '';
  try {
    const urlObj = new URL(url);
    return urlObj.hostname;
  } catch {
    return '';
  }
}

function calculateMarketImpact(news, ticker) {
  if (ticker === 'GENERAL') return 'Low';
  
  const text = `${news.title} ${news.summary}`.toLowerCase();
  
  if (text.includes('earnings') || text.includes('revenue') || text.includes('profit')) {
    return 'High';
  } else if (text.includes('partnership') || text.includes('acquisition') || text.includes('merger')) {
    return 'Medium';
  } else if (text.includes('product') || text.includes('launch') || text.includes('update')) {
    return 'Medium';
  }
  
  return 'Low';
}

function identifyTradingOpportunity(news, ticker) {
  if (ticker === 'GENERAL') return 'None';
  
  const text = `${news.title} ${news.summary}`.toLowerCase();
  
  if (text.includes('beat') || text.includes('exceed') || text.includes('surge')) {
    return 'Long';
  } else if (text.includes('miss') || text.includes('decline') || text.includes('drop')) {
    return 'Short';
  } else if (text.includes('volatile') || text.includes('uncertainty')) {
    return 'Wait';
  }
  
  return 'Monitor';
}

function assessRiskLevel(news, ticker) {
  if (ticker === 'GENERAL') return 'Low';
  
  const text = `${news.title} ${news.summary}`.toLowerCase();
  
  if (text.includes('risk') || text.includes('warning') || text.includes('caution')) {
    return 'High';
  } else if (text.includes('uncertainty') || text.includes('volatile')) {
    return 'Medium';
  }
  
  return 'Low';
}

function extractSectorFromContent(news) {
  const text = `${news.title} ${news.summary}`.toLowerCase();
  
  const sectors = {
    'technology': ['tech', 'software', 'ai', 'artificial intelligence', 'cloud', 'cybersecurity'],
    'healthcare': ['health', 'medical', 'pharma', 'biotech', 'clinical', 'fda'],
    'finance': ['bank', 'financial', 'investment', 'trading', 'fintech', 'crypto'],
    'energy': ['oil', 'gas', 'renewable', 'solar', 'wind', 'energy'],
    'consumer': ['retail', 'consumer', 'ecommerce', 'shopping', 'brand'],
    'industrial': ['manufacturing', 'industrial', 'automotive', 'aerospace', 'construction']
  };
  
  for (const [sector, keywords] of Object.entries(sectors)) {
    for (const keyword of keywords) {
      if (text.includes(keyword)) {
        return sector;
      }
    }
  }
  
  return 'Other';
}

function categorizeMarketCap(news) {
  // This would integrate with market cap data
  return 'Unknown';
}

function assessVolatilityImpact(news) {
  const text = `${news.title} ${news.summary}`.toLowerCase();
  
  if (text.includes('volatile') || text.includes('swing') || text.includes('jump')) {
    return 'High';
  } else if (text.includes('stable') || text.includes('steady')) {
    return 'Low';
  }
  
  return 'Medium';
}

function assessEarningsImpact(news) {
  const text = `${news.title} ${news.summary}`.toLowerCase();
  
  if (text.includes('earnings') || text.includes('quarterly') || text.includes('annual')) {
    return 'Direct';
  }
  
  return 'Indirect';
}

function assessRegulatoryImpact(news) {
  const text = `${news.title} ${news.summary}`.toLowerCase();
  
  if (text.includes('regulation') || text.includes('fda') || text.includes('sec') || text.includes('government')) {
    return 'High';
  }
  
  return 'Low';
}

function assessCompetitiveImpact(news) {
  const text = `${news.title} ${news.summary}`.toLowerCase();
  
  if (text.includes('competitor') || text.includes('rival') || text.includes('market share')) {
    return 'High';
  }
  
  return 'Low';
}

function assessGlobalImpact(news) {
  const text = `${news.title} ${news.summary}`.toLowerCase();
  
  if (text.includes('global') || text.includes('international') || text.includes('china') || text.includes('europe')) {
    return 'High';
  }
  
  return 'Low';
}