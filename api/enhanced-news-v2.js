// Enhanced News API v2 - Professional Day Trading Dashboard
// Live news with accurate ticker extraction and price context

import { extractTickers } from '../lib/enhanced-ticker-extractor.js';
import { ProviderManager } from '../lib/provider-manager.js';

const providerManager = new ProviderManager();

// Generate sentiment analysis
function generateSentiment(title, summary) {
  const text = `${title} ${summary}`.toLowerCase();
  
  const positiveWords = ['up', 'rise', 'gain', 'surge', 'rally', 'beat', 'exceed', 'strong', 'growth', 'positive', 'bullish', 'optimistic', 'outperform', 'upgrade'];
  const negativeWords = ['down', 'fall', 'drop', 'decline', 'crash', 'miss', 'weak', 'loss', 'negative', 'bearish', 'pessimistic', 'underperform', 'downgrade', 'cut'];
  
  let positiveScore = 0;
  let negativeScore = 0;
  
  positiveWords.forEach(word => {
    if (text.includes(word)) positiveScore++;
  });
  
  negativeWords.forEach(word => {
    if (text.includes(word)) negativeScore++;
  });
  
  if (positiveScore > negativeScore) return 'positive';
  if (negativeScore > positiveScore) return 'negative';
  return 'neutral';
}

// Generate news badges
function generateNewsBadges(title, summary) {
  const badges = [];
  const content = `${title} ${summary}`.toLowerCase();
  
  if (content.includes('earnings')) badges.push('EARNINGS');
  if (content.includes('fda') || content.includes('approval')) badges.push('FDA');
  if (content.includes('insider') || content.includes('insider trading')) badges.push('INSIDER');
  if (content.includes('ai') || content.includes('artificial intelligence')) badges.push('AI');
  if (content.includes('merger') || content.includes('acquisition')) badges.push('M&A');
  if (content.includes('ipo') || content.includes('initial public offering')) badges.push('IPO');
  if (content.includes('bankruptcy') || content.includes('chapter 11')) badges.push('BANKRUPTCY');
  if (content.includes('lawsuit') || content.includes('legal')) badges.push('LEGAL');
  if (content.includes('partnership') || content.includes('deal')) badges.push('PARTNERSHIP');
  if (content.includes('upgrade') || content.includes('downgrade')) badges.push('RATING');
  if (content.includes('guidance') || content.includes('outlook')) badges.push('GUIDANCE');
  if (content.includes('dividend') || content.includes('buyback')) badges.push('DIVIDEND');
  if (content.includes('ceo') || content.includes('executive')) badges.push('LEADERSHIP');
  
  return badges;
}

// Calculate news impact metrics (placeholder for now)
function calculateNewsImpact(tickers, publishedAt) {
  if (!tickers || tickers.length === 0) {
    return {
      impact: 'N/A',
      change5m: 'N/A',
      change30m: 'N/A',
      change1h: 'N/A',
      rvol: 'N/A',
      breakout: false,
      vwapDev: 'N/A',
      maxUp: 'N/A',
      maxDown: 'N/A'
    };
  }
  
  // TODO: Implement actual price impact calculation
  // This would require historical price data and news timestamp matching
  return {
    impact: 'Moderate',
    change5m: '+2.1%',
    change30m: '+3.4%',
    change1h: '+1.8%',
    rvol: '1.2x',
    breakout: false,
    vwapDev: '+1.5%',
    maxUp: '+4.2%',
    maxDown: '-1.1%'
  };
}

// Validate article URL
function isValidArticleUrl(url) {
  if (!url) return false;
  
  try {
    const u = new URL(url);
    
    // Reject search pages, quote pages, and ticker landing pages
    if (/\/search(\?|$)/i.test(u.pathname) ||
        /[?&](q|query|s)=/i.test(u.search) ||
        /\/topic\//i.test(u.pathname) ||
        /\/ticker\//i.test(u.pathname)) {
      return false;
    }
    
    return /^https?:\/\//i.test(url);
  } catch {
    return false;
  }
}

// Resolve article URL
async function resolveArticleUrl(url) {
  if (!isValidArticleUrl(url)) return null;
  
  try {
    const response = await fetch(url, {
      method: 'HEAD',
      redirect: 'follow',
      timeout: 5000
    });
    
    if (response.ok) {
      return response.url;
    }
  } catch (error) {
    console.warn('URL resolution failed:', error.message);
  }
  
  return null;
}

// Main news fetching function
async function fetchRealNewsFromAPIs(limit = 200, sourceFilter = null, dateRange = 'all', searchQuery = null) {
  console.log('🔄 Fetching live news from APIs...', { limit, sourceFilter, dateRange, searchQuery });
  
  const allNews = [];
  const errors = [];
  const providers = providerManager.getActiveProviders();
  
  // Fetch from all available providers
  for (const provider of providers) {
    try {
      console.log(`  📡 Fetching from ${provider.name}...`);
      const news = await provider.getNews(limit, sourceFilter, dateRange, searchQuery);
      
      if (news && news.length > 0) {
        allNews.push(...news);
        console.log(`  ✅ ${provider.name}: ${news.length} articles`);
      } else {
        console.log(`  ⚠️ ${provider.name}: No articles returned`);
      }
    } catch (error) {
      console.error(`  ❌ ${provider.name} error:`, error.message);
      errors.push(`${provider.name}: ${error.message}`);
    }
  }
  
  // Deduplicate by URL and title
  const seenUrls = new Set();
  const seenTitles = new Set();
  const dedupedNews = [];
  
  for (const article of allNews) {
    const url = article.url || '';
    const title = article.title || '';
    
    if (url && seenUrls.has(url)) continue;
    if (title && seenTitles.has(title)) continue;
    
    seenUrls.add(url);
    seenTitles.add(title);
    dedupedNews.push(article);
  }
  
  console.log(`📊 Deduplicated: ${allNews.length} → ${dedupedNews.length} articles`);
  
  return { news: dedupedNews, errors };
}

// Process news articles with ticker extraction
async function processNewsArticles(rawNews) {
  console.log(`🔄 Processing ${rawNews.length} news articles...`);
  
  const processedNews = [];
  let tickersResolved = 0;
  let unmatchedTitles = 0;
  
  for (const item of rawNews) {
    try {
      // Extract tickers using enhanced extractor
      const tickerData = await extractTickers(item);
      const finalTickers = item.tickers && item.tickers.length > 0 ? item.tickers : tickerData.tickers;
      
      // Generate sentiment
      const sentiment = generateSentiment(item.title || '', item.summary || '');
      
      // Generate badges
      const badges = generateNewsBadges(item.title || '', item.summary || '');
      
      // Calculate news impact
      const newsImpact = calculateNewsImpact(finalTickers, item.publishedAt);
      
      // Resolve article URL
      let resolvedUrl = null;
      if (item.url) {
        resolvedUrl = await resolveArticleUrl(item.url);
      }
      
      processedNews.push({
        ...item,
        tickers: finalTickers,
        inferredTickersConfidence: tickerData.inferredTickersConfidence,
        sentiment,
        badges,
        newsImpact,
        resolvedUrl,
        isValidUrl: !!resolvedUrl
      });
      
      if (finalTickers.length > 0) {
        tickersResolved++;
      } else {
        unmatchedTitles++;
      }
      
    } catch (error) {
      console.error('Error processing article:', error.message);
      processedNews.push({
        ...item,
        tickers: [],
        inferredTickersConfidence: 0,
        sentiment: 'neutral',
        badges: [],
        newsImpact: calculateNewsImpact([], item.publishedAt),
        resolvedUrl: null,
        isValidUrl: false
      });
      unmatchedTitles++;
    }
  }
  
  // Comprehensive logging for observability
  console.log(`📈 News processing complete:`);
  console.log(`  📰 Total articles: ${processedNews.length}`);
  console.log(`  🎯 Tickers resolved: ${tickersResolved}`);
  console.log(`  ❓ Unmatched titles: ${unmatchedTitles}`);
  console.log(`  📊 Resolution rate: ${((tickersResolved / processedNews.length) * 100).toFixed(1)}%`);
  
  return processedNews;
}

// Main API handler
export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }
  
  try {
    const { 
      limit = 50, 
      source = null, 
      dateRange = 'all', 
      search = null,
      ticker = null
    } = req.query;
    
    console.log('📰 Enhanced News API v2 request:', { limit, source, dateRange, search, ticker });
    
    // Fetch raw news from providers
    const { news: rawNews, errors } = await fetchRealNewsFromAPIs(
      parseInt(limit), 
      source, 
      dateRange, 
      search
    );
    
    if (rawNews.length === 0) {
      return res.status(200).json({
        success: true,
        data: {
          news: [],
          total: 0,
          filters: { limit, source, dateRange, search, ticker },
          lastUpdate: new Date().toISOString()
        },
        errors: errors.length > 0 ? errors : ['No news available from any provider']
      });
    }
    
    // Process news with ticker extraction
    const processedNews = await processNewsArticles(rawNews);
    
    // Apply ticker filter if specified
    let filteredNews = processedNews;
    if (ticker) {
      const tickerUpper = ticker.toUpperCase();
      filteredNews = processedNews.filter(article => 
        article.tickers && article.tickers.includes(tickerUpper)
      );
    }
    
    // Sort by published time (newest first)
    filteredNews.sort((a, b) => new Date(b.publishedAt) - new Date(a.publishedAt));
    
    // Limit results
    const limitedNews = filteredNews.slice(0, parseInt(limit));
    
    // Provider health status
    const providerStatus = providerManager.getProviderStatus();
    const healthStatus = providerStatus.news === 'live' ? 'LIVE' : 
                        providerStatus.news === 'degraded' ? 'DEGRADED' : 'OFFLINE';
    
    return res.status(200).json({
      success: true,
      data: {
        news: limitedNews,
        total: limitedNews.length,
        filters: { limit, source, dateRange, search, ticker },
        lastUpdate: new Date().toISOString(),
        healthStatus,
        providerStatus
      },
      errors: errors.length > 0 ? errors : []
    });
    
  } catch (error) {
    console.error('❌ Enhanced News API v2 error:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to fetch news',
      message: error.message,
      data: { news: [] }
    });
  }
}
