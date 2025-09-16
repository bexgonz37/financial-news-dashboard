// Test endpoint to check tick data in the store
export default async function handler(req, res) {
  try {
    // Import the app state
    const { appState } = await import('../src/state/store.js');
    
    // Get all symbols with ticks
    const symbolsWithTicks = appState.getAllSymbolsWithTicks();
    const allTicks = {};
    
    // Get all ticks from the store
    for (const [symbol, ticks] of appState.state.ticks) {
      allTicks[symbol] = {
        count: ticks.length,
        latest: ticks.length > 0 ? ticks[ticks.length - 1] : null,
        first: ticks.length > 0 ? ticks[0] : null
      };
    }
    
    return res.status(200).json({
      success: true,
      data: {
        symbolsWithTicks: symbolsWithTicks.length,
        symbolsWithTicksList: symbolsWithTicks.map(s => s.symbol),
        allTicks: allTicks,
        wsStatus: appState.state.status.wsStatus,
        wsConnected: appState.state.status.wsConnected,
        subscribedSymbols: Array.from(appState.state.status.subscribedSymbols || new Set())
      }
    });
    
  } catch (error) {
    console.error('Test ticks error:', error);
    return res.status(500).json({
      success: false,
      error: error.message,
      stack: error.stack
    });
  }
}
