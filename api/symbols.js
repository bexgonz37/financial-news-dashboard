// Symbols API - returns full US listed universe with search
import { comprehensiveSymbolMaster } from '../lib/comprehensive-symbol-master.js';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get('limit')) || 100;
    const exchange = searchParams.get('exchange');
    const sector = searchParams.get('sector');
    const query = searchParams.get('q');
    
    // Get all active symbols
    const allSymbols = comprehensiveSymbolMaster.getAllActiveSymbols();
    
    let filtered = allSymbols;
    
    // Apply search if query provided
    if (query && query.length >= 2) {
      const searchResults = comprehensiveSymbolMaster.search(query, limit * 2);
      filtered = searchResults.map(result => comprehensiveSymbolMaster.getSymbol(result.symbol)).filter(Boolean);
    }
    
    // Apply filters
    if (exchange) {
      filtered = filtered.filter(s => s.exchange === exchange);
    }
    
    if (sector) {
      filtered = filtered.filter(s => s.sector === sector);
    }
    
    // Limit results
    const limited = filtered.slice(0, limit);
    
    return Response.json({
      success: true,
      data: {
        symbols: limited,
        count: limited.length,
        total: allSymbols.length,
        query: query || null,
        filters: { exchange, sector },
        lastUpdate: comprehensiveSymbolMaster.lastUpdate
      }
    });
    
  } catch (error) {
    console.error('Symbols API error:', error);
    return Response.json({
      success: false,
      error: 'Failed to load symbols',
      message: error.message
    }, { status: 500 });
  }
}