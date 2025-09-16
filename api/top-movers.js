// Top movers API endpoint
import fmpLimiter from '../lib/fmp-limiter.js';

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { limit = 100 } = req.query;
    const limitNum = Math.min(parseInt(limit) || 100, 500);
    
    console.log(`Fetching top movers: limit=${limitNum}`);
    
    // Get top movers from FMP
    const fmpKey = process.env.FMP_KEY;
    if (!fmpKey) {
      return res.status(200).json({
        success: true,
        symbols: []
      });
    }
    
    const url = `https://financialmodelingprep.com/api/v3/gainers?apikey=${fmpKey}`;
    
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000);
    
    try {
      const response = await fmpLimiter.makeRequest(url, { 
        signal: controller.signal
      });
      clearTimeout(timeoutId);
      
      if (response.status === 429) {
        console.log('FMP rate limit exceeded for top movers');
        return res.status(200).json({
          success: true,
          symbols: []
        });
      }
      
      if (!response.ok) {
        console.log(`FMP API error for top movers: ${response.status}`);
        return res.status(200).json({
          success: true,
          symbols: []
        });
      }
      
      const data = await response.json();
      const symbols = Array.isArray(data) ? 
        data.slice(0, limitNum).map(item => item.symbol).filter(Boolean) : [];
      
      console.log(`Top movers: ${symbols.length} symbols`);
      
      return res.status(200).json({
        success: true,
        symbols
      });
      
    } catch (error) {
      clearTimeout(timeoutId);
      console.log(`Top movers fetch error: ${error.message}`);
      return res.status(200).json({
        success: true,
        symbols: []
      });
    }
    
  } catch (error) {
    console.error('Top movers API error:', error);
    return res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
}
