import fetch from 'node-fetch';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();

  try {
    const { ticker, newsText, analysisType = 'comprehensive' } = req.query;
    
    if (!ticker || !newsText) {
      return res.status(400).json({
        success: false,
        error: 'Ticker and newsText are required'
      });
    }

    // Get historical data for pattern analysis
    const historicalData = await getHistoricalData(ticker);
    const similarNews = await findSimilarNews(ticker, newsText);
    const patternAnalysis = await analyzePatterns(ticker, newsText, historicalData, similarNews);
    
    return res.status(200).json({
      success: true,
      data: {
        ticker,
        currentNews: newsText,
        patternAnalysis,
        similarNews: similarNews.slice(0, 5), // Top 5 similar news
        confidence: patternAnalysis.confidence,
        prediction: patternAnalysis.prediction,
        riskLevel: patternAnalysis.riskLevel,
        timestamp: new Date().toISOString(),
        disclaimer: "AI predictions are for educational purposes only. Not financial advice. Past performance does not guarantee future results."
      }
    });

  } catch (error) {
    console.error('Pattern analyzer error:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to analyze patterns'
    });
  }
}

async function getHistoricalData(ticker) {
  try {
    const apiKey = process.env.ALPHAVANTAGE_KEY;
    if (!apiKey) return getFallbackHistoricalData(ticker);

    // Get historical news and stock data
    const [newsResponse, stockResponse] = await Promise.all([
      fetch(`https://www.alphavantage.co/query?function=NEWS_SENTIMENT&tickers=${ticker}&apikey=${apiKey}&limit=100`),
      fetch(`https://www.alphavantage.co/query?function=TIME_SERIES_DAILY&symbol=${ticker}&apikey=${apiKey}&outputsize=full`)
    ]);

    const newsData = await newsResponse.json();
    const stockData = await stockResponse.json();

    return {
      news: newsData.feed || [],
      stock: stockData['Time Series (Daily)'] || {},
      ticker
    };
  } catch (error) {
    console.warn('Historical data fetch failed:', error.message);
    return getFallbackHistoricalData(ticker);
  }
}

async function findSimilarNews(ticker, currentNews) {
  try {
    const apiKey = process.env.ALPHAVANTAGE_KEY;
    if (!apiKey) return [];

    // Get historical news for the ticker
    const response = await fetch(`https://www.alphavantage.co/query?function=NEWS_SENTIMENT&tickers=${ticker}&apikey=${apiKey}&limit=200`);
    const data = await response.json();
    
    if (!data.feed) return [];

    // Find similar news based on keywords and sentiment
    const similarNews = data.feed
      .map(article => ({
        ...article,
        similarity: calculateSimilarity(currentNews, article.title + ' ' + article.summary),
        priceImpact: calculatePriceImpact(article),
        timeAgo: new Date() - new Date(article.time_published)
      }))
      .filter(article => article.similarity > 0.3) // Only similar news
      .sort((a, b) => b.similarity - a.similarity);

    return similarNews;
  } catch (error) {
    console.warn('Similar news fetch failed:', error.message);
    return [];
  }
}

async function analyzePatterns(ticker, currentNews, historicalData, similarNews) {
  const analysis = {
    confidence: 0,
    prediction: 'neutral',
    riskLevel: 'medium',
    factors: [],
    recommendations: []
  };

  // Analyze sentiment patterns
  const sentimentAnalysis = analyzeSentimentPatterns(currentNews, similarNews);
  analysis.factors.push(sentimentAnalysis);

  // Analyze volume patterns
  const volumeAnalysis = analyzeVolumePatterns(ticker, similarNews);
  analysis.factors.push(volumeAnalysis);

  // Analyze time-based patterns
  const timeAnalysis = analyzeTimePatterns(similarNews);
  analysis.factors.push(timeAnalysis);

  // Analyze price movement patterns
  const priceAnalysis = analyzePricePatterns(similarNews);
  analysis.factors.push(priceAnalysis);

  // Calculate overall confidence and prediction
  analysis.confidence = calculateOverallConfidence(analysis.factors);
  analysis.prediction = generatePrediction(analysis.factors);
  analysis.riskLevel = calculateRiskLevel(analysis.factors);

  // Generate recommendations
  analysis.recommendations = generateRecommendations(analysis);

  return analysis;
}

function calculateSimilarity(currentNews, historicalNews) {
  const currentWords = currentNews.toLowerCase().split(/\s+/);
  const historicalWords = historicalNews.toLowerCase().split(/\s+/);
  
  const commonWords = currentWords.filter(word => 
    historicalWords.includes(word) && word.length > 3
  );
  
  return commonWords.length / Math.max(currentWords.length, historicalWords.length);
}

function calculatePriceImpact(article) {
  // Simulate price impact based on sentiment and relevance
  const sentiment = parseFloat(article.overall_sentiment_score) || 0;
  const relevance = parseFloat(article.relevance_score) || 0;
  
  return (sentiment * relevance * 10).toFixed(2);
}

function analyzeSentimentPatterns(currentNews, similarNews) {
  const avgSentiment = similarNews.reduce((sum, news) => 
    sum + (parseFloat(news.overall_sentiment_score) || 0), 0) / similarNews.length;
  
  const positiveNews = similarNews.filter(news => 
    parseFloat(news.overall_sentiment_score) > 0.1).length;
  
  return {
    type: 'sentiment',
    score: avgSentiment,
    positiveRatio: positiveNews / similarNews.length,
    impact: avgSentiment > 0.2 ? 'bullish' : avgSentiment < -0.2 ? 'bearish' : 'neutral',
    description: `Historical similar news had ${(positiveNews/similarNews.length*100).toFixed(1)}% positive sentiment`
  };
}

function analyzeVolumePatterns(ticker, similarNews) {
  const highVolumeNews = similarNews.filter(news => 
    news.volume && parseInt(news.volume) > 1000000).length;
  
  return {
    type: 'volume',
    score: highVolumeNews / similarNews.length,
    highVolumeRatio: highVolumeNews / similarNews.length,
    impact: highVolumeNews / similarNews.length > 0.6 ? 'high_volume' : 'normal',
    description: `${(highVolumeNews/similarNews.length*100).toFixed(1)}% of similar news had high volume`
  };
}

function analyzeTimePatterns(similarNews) {
  const recentNews = similarNews.filter(news => 
    new Date() - new Date(news.time_published) < 30 * 24 * 60 * 60 * 1000).length;
  
  return {
    type: 'timing',
    score: recentNews / similarNews.length,
    recentRatio: recentNews / similarNews.length,
    impact: recentNews / similarNews.length > 0.5 ? 'recent_trend' : 'historical',
    description: `${(recentNews/similarNews.length*100).toFixed(1)}% of similar news was recent`
  };
}

function analyzePricePatterns(similarNews) {
  const positiveImpact = similarNews.filter(news => 
    parseFloat(news.overall_sentiment_score) > 0.1).length;
  
  return {
    type: 'price_movement',
    score: positiveImpact / similarNews.length,
    positiveRatio: positiveImpact / similarNews.length,
    impact: positiveImpact / similarNews.length > 0.6 ? 'upward' : 'downward',
    description: `${(positiveImpact/similarNews.length*100).toFixed(1)}% of similar news led to positive price movement`
  };
}

function calculateOverallConfidence(factors) {
  const weights = { sentiment: 0.4, volume: 0.3, timing: 0.2, price_movement: 0.1 };
  let weightedScore = 0;
  let totalWeight = 0;
  
  factors.forEach(factor => {
    const weight = weights[factor.type] || 0.1;
    weightedScore += factor.score * weight;
    totalWeight += weight;
  });
  
  return Math.min(Math.max(weightedScore * 100, 0), 100);
}

function generatePrediction(factors) {
  const sentimentFactor = factors.find(f => f.type === 'sentiment');
  const volumeFactor = factors.find(f => f.type === 'volume');
  const priceFactor = factors.find(f => f.type === 'price_movement');
  
  let bullishScore = 0;
  let bearishScore = 0;
  
  if (sentimentFactor?.impact === 'bullish') bullishScore += 2;
  if (sentimentFactor?.impact === 'bearish') bearishScore += 2;
  
  if (volumeFactor?.impact === 'high_volume') bullishScore += 1;
  
  if (priceFactor?.impact === 'upward') bullishScore += 2;
  if (priceFactor?.impact === 'downward') bearishScore += 2;
  
  if (bullishScore > bearishScore + 1) return 'bullish';
  if (bearishScore > bullishScore + 1) return 'bearish';
  return 'neutral';
}

function calculateRiskLevel(factors) {
  const volumeFactor = factors.find(f => f.type === 'volume');
  const sentimentFactor = factors.find(f => f.type === 'sentiment');
  
  let riskScore = 0;
  if (volumeFactor?.highVolumeRatio > 0.7) riskScore += 2;
  if (Math.abs(sentimentFactor?.score || 0) > 0.5) riskScore += 1;
  
  if (riskScore >= 3) return 'high';
  if (riskScore >= 1) return 'medium';
  return 'low';
}

function generateRecommendations(analysis) {
  const recommendations = [];
  
  if (analysis.prediction === 'bullish') {
    recommendations.push('Educational: Historical patterns suggest potential upward movement');
    recommendations.push('Educational: Monitor volume for confirmation signals');
  } else if (analysis.prediction === 'bearish') {
    recommendations.push('Educational: Historical patterns suggest potential downward movement');
    recommendations.push('Educational: Watch for support levels in technical analysis');
  }
  
  if (analysis.riskLevel === 'high') {
    recommendations.push('Educational: High volatility detected - consider risk management');
    recommendations.push('Educational: Review position sizing strategies');
  }
  
  if (analysis.confidence < 60) {
    recommendations.push('Educational: Low confidence - wait for more data points');
    recommendations.push('Educational: Consider paper trading for practice');
  }
  
  // Always add disclaimer
  recommendations.push('⚠️ NOT FINANCIAL ADVICE - For educational purposes only');
  
  return recommendations;
}

function getFallbackHistoricalData(ticker) {
  return {
    news: [],
    stock: {},
    ticker,
    fallback: true
  };
}
