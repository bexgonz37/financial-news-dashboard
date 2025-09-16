// Company lookup and ticker resolution API
import fmpLimiter from '../lib/fmp-limiter.js';

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { q: query, limit = 5 } = req.query;
    
    if (!query) {
      return res.status(400).json({ error: 'Query parameter required' });
    }
    
    console.log(`Looking up company: ${query}`);
    
    // Get FMP key
    const fmpKey = process.env.FMP_KEY;
    if (!fmpKey) {
      return res.status(200).json({
        success: true,
        results: []
      });
    }
    
    // Search companies using FMP
    const url = `https://financialmodelingprep.com/api/v3/search?query=${encodeURIComponent(query)}&limit=${limit}&apikey=${fmpKey}`;
    
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000);
    
    try {
      const response = await fmpLimiter.makeRequest(url, { 
        signal: controller.signal
      });
      clearTimeout(timeoutId);
      
      if (response.status === 429) {
        console.log('FMP rate limit exceeded for company lookup');
        return res.status(200).json({
          success: true,
          results: []
        });
      }
      
      if (!response.ok) {
        console.log(`FMP API error for company lookup: ${response.status}`);
        return res.status(200).json({
          success: true,
          results: []
        });
      }
      
      const data = await response.json();
      const results = Array.isArray(data) ? data : [];
      
      // Filter and score results
      const scoredResults = results
        .filter(item => item.symbol && item.name)
        .map(item => {
          const nameMatch = item.name.toLowerCase().includes(query.toLowerCase());
          const symbolMatch = item.symbol.toLowerCase().includes(query.toLowerCase());
          
          let score = 0;
          if (nameMatch) score += 0.8;
          if (symbolMatch) score += 0.6;
          
          // Prefer US exchanges
          if (item.exchangeShortName === 'NASDAQ' || item.exchangeShortName === 'NYSE') {
            score += 0.2;
          }
          
          return {
            symbol: item.symbol,
            name: item.name,
            exchange: item.exchangeShortName,
            score: Math.min(score, 1.0),
            confidence: score >= 0.6 ? 'high' : score >= 0.4 ? 'medium' : 'low'
          };
        })
        .sort((a, b) => b.score - a.score)
        .slice(0, limit);
      
      console.log(`Found ${scoredResults.length} results for "${query}"`);
      
      return res.status(200).json({
        success: true,
        results: scoredResults
      });
      
    } catch (error) {
      clearTimeout(timeoutId);
      console.log(`Company lookup error: ${error.message}`);
      return res.status(200).json({
        success: true,
        results: []
      });
    }
    
  } catch (error) {
    console.error('Lookup API error:', error);
    return res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
}