// Test endpoint to debug scanner engine
export default async function handler(req, res) {
  try {
    // Import the scanner engine
    const { scannerEngine } = await import('../src/lib/scanners/run.js');
    
    console.log('Testing scanner engine...');
    
    // Test the mock data generation
    const mockSymbols = scannerEngine.getMockSymbols();
    console.log('Mock symbols generated:', mockSymbols.length);
    
    // Test running all scanners
    const results = await scannerEngine.runAllScanners();
    console.log('Scanner results:', Object.keys(results));
    
    // Test specific scanner
    const highMomentum = results['high-momentum'] || [];
    console.log('High momentum results:', highMomentum.length);
    
    return res.status(200).json({
      success: true,
      data: {
        mockSymbolsCount: mockSymbols.length,
        mockSymbols: mockSymbols.map(s => ({ symbol: s.symbol, price: s.price, ticksCount: s.ticks.length })),
        scannerResults: Object.keys(results),
        highMomentumCount: highMomentum.length,
        highMomentumResults: highMomentum.slice(0, 3).map(s => ({ 
          symbol: s.symbol, 
          price: s.price, 
          changePercent: s.changePercent,
          score: s.score 
        }))
      }
    });
    
  } catch (error) {
    console.error('Test scanner error:', error);
    return res.status(500).json({
      success: false,
      error: error.message,
      stack: error.stack
    });
  }
}
