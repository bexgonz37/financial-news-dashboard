// Financial News Data API - Enhanced with Comprehensive Company Matching
const { findCompanyMatches } = require('./company-matcher.js');
const { findCompanyByTicker, findCompaniesByName } = require('./company-database-dynamic.js');

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET' && req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const { ticker, search } = req.query;
    const { title, summary, text } = req.body || {};

    // Get news data
    const newsData = await fetchNewsData(ticker, search);
    
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

async function fetchNewsData(ticker, search) {
  const apiKey = process.env.ALPHAVANTAGE_KEY;
  if (!apiKey) {
    throw new Error('Alpha Vantage API key not configured');
  }

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
  return data.feed || [];
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
        // Enhanced company matching logic
        const articleText = `${news.title} ${news.summary}`;
        const companies = await findCompaniesByName(articleText);
        
        if (companies && companies.length > 0) {
          // Check if multiple companies are mentioned
          const companyCount = companies.length;
          
          if (companyCount === 1) {
            // Single company found - check confidence
            const company = companies[0];
            const matchScore = calculateExactMatchScore(articleText, company);
            
            if (matchScore >= 0.7) {
              ticker = company.ticker;
              sentimentScore = 0.5; // Default sentiment for matched companies
            } else {
              ticker = 'GENERAL'; // Low confidence match
            }
          } else {
            // Multiple companies - use the most relevant one
            const bestCompany = companies.reduce((best, current) => {
              const bestScore = calculateExactMatchScore(articleText, best);
              const currentScore = calculateExactMatchScore(articleText, current);
              return currentScore > bestScore ? current : best;
            });
            
            const matchScore = calculateExactMatchScore(articleText, bestCompany);
            if (matchScore >= 0.6) {
              ticker = bestCompany.ticker;
              sentimentScore = 0.4; // Lower confidence for multiple matches
            }
          }
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

function calculateExactMatchScore(text, company) {
  if (!text || !company) return 0;
  
  const textLower = text.toLowerCase();
  const companyNameLower = company.name.toLowerCase();
  const tickerLower = company.ticker.toLowerCase();
  
  let score = 0;
  
  // Exact name match gets highest score
  if (textLower.includes(companyNameLower)) {
    score += 0.8;
  }
  
  // Partial name match
  const nameWords = companyNameLower.split(' ');
  let partialMatches = 0;
  for (const word of nameWords) {
    if (word.length > 2 && textLower.includes(word)) {
      partialMatches++;
    }
  }
  score += (partialMatches / nameWords.length) * 0.4;
  
  // Ticker match
  if (textLower.includes(tickerLower)) {
    score += 0.6;
  }
  
  // Sector match
  if (company.sector && textLower.includes(company.sector.toLowerCase())) {
    score += 0.2;
  }
  
  return Math.min(score, 1.0); // Cap at 1.0
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
  
  const text = `${news.title} ${news.summary}`
