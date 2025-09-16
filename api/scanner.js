// WS-driven scanner API endpoint
export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { preset = 'momentum', limit = 50 } = req.query;
    
    // Get scanner results from WS engine
    const scannerData = await getScannerResults(preset, parseInt(limit));
    
    return res.status(200).json({
      success: true,
      data: {
        preset,
        results: scannerData,
        total: scannerData.length,
        universe: scannerData.length, // Dynamic universe size
        timestamp: new Date().toISOString()
      }
    });

  } catch (error) {
    console.error('Scanner API error:', error);
    return res.status(500).json({
      success: false,
      error: 'Scanner failed',
      message: error.message
    });
  }
}

async function getScannerResults(preset, limit) {
  // This would typically call the scanner engine
  // For now, return mock data that simulates WS-driven results
  
  const symbols = [
    'AAPL', 'NVDA', 'TSLA', 'MSFT', 'GOOGL', 'AMZN', 'META', 'NFLX', 'AMD', 'INTC',
    'SPY', 'QQQ', 'IWM', 'VTI', 'ARKK', 'TQQQ', 'SOXL', 'TMF', 'UPRO', 'TNA',
    'PLTR', 'SNOW', 'CRWD', 'ZM', 'ROKU', 'SQ', 'PYPL', 'SHOP', 'TWLO', 'OKTA'
  ];
  
  const data = symbols.slice(0, limit).map(symbol => {
    const price = 50 + Math.random() * 200;
    const change = (Math.random() - 0.5) * 10;
    const percentChange = (change / price) * 100;
    
    // Simulate WS-driven calculations
    const momentum1m = (Math.random() - 0.5) * 5;
    const momentum5m = (Math.random() - 0.5) * 10;
    const rvol = Math.random() * 3 + 0.5;
    const unusualVol = rvol > 2.0;
    const gap = (Math.random() - 0.5) * 10;
    const gapUp = gap > 2;
    const gapDown = gap < -2;
    const rangeBreak = Math.random() > 0.8;
    const hod = rangeBreak && Math.random() > 0.5;
    const lod = rangeBreak && !hod;
    const newsMomentum = (Math.random() - 0.5) * 20;
    
    // Calculate score based on WS signals
    const score = Math.abs(momentum1m) * 0.3 + 
                  Math.abs(momentum5m) * 0.2 + 
                  (rvol - 1) * 0.2 + 
                  Math.abs(gap) * 0.15 + 
                  (rangeBreak ? 0.1 : 0) + 
                  Math.abs(newsMomentum) * 0.05;
    
    // Determine category
    let category = 'other';
    if (momentum1m > 2 && unusualVol) category = 'momentum';
    else if (unusualVol && rvol > 3) category = 'volume';
    else if (gapUp) category = 'gap_up';
    else if (gapDown) category = 'gap_down';
    else if (hod) category = 'hod';
    else if (lod) category = 'lod';
    else if (newsMomentum > 1) category = 'news_momentum';
    
    return {
      symbol,
      price: price.toFixed(2),
      change: change.toFixed(2),
      percentChange: percentChange.toFixed(2),
      momentum1m: momentum1m.toFixed(2),
      momentum5m: momentum5m.toFixed(2),
      rvol: rvol.toFixed(2),
      unusualVol,
      gap: gap.toFixed(2),
      gapUp,
      gapDown,
      rangeBreak,
      hod,
      lod,
      newsMomentum: newsMomentum.toFixed(2),
      category,
      score: Math.max(0, score).toFixed(2),
      lastUpdate: Date.now()
    };
  });
  
  return data.sort((a, b) => parseFloat(b.score) - parseFloat(a.score));
}