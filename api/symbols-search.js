// Symbol Search API - Fast search for UI chips and ticker resolution
import { comprehensiveSymbolMaster } from '../lib/comprehensive-symbol-master.js';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const query = searchParams.get('q') || '';
    const limit = parseInt(searchParams.get('limit')) || 10;
    const exchange = searchParams.get('exchange');
    const sector = searchParams.get('sector');
    const activeOnly = searchParams.get('active') !== 'false';

    if (!query || query.length < 2) {
      return Response.json({
        success: true,
        data: {
          symbols: [],
          count: 0,
          query: '',
          filters: { exchange, sector, activeOnly }
        }
      });
    }

    // Search symbols
    let results = comprehensiveSymbolMaster.search(query, limit * 2); // Get more to filter

    // Apply filters
    if (exchange) {
      results = results.filter(r => r.exchange === exchange);
    }
    if (sector) {
      const symbol = comprehensiveSymbolMaster.getSymbol(r.symbol);
      if (symbol && symbol.sector === sector) {
        return true;
      }
    }
    if (activeOnly) {
      results = results.filter(r => {
        const symbol = comprehensiveSymbolMaster.getSymbol(r.symbol);
        return symbol && symbol.isActive;
      });
    }

    // Limit results
    results = results.slice(0, limit);

    return Response.json({
      success: true,
      data: {
        symbols: results,
        count: results.length,
        query,
        filters: { exchange, sector, activeOnly },
        lastUpdate: comprehensiveSymbolMaster.lastUpdate
      }
    });

  } catch (error) {
    console.error('Symbol search error:', error);
    return Response.json({
      success: false,
      error: 'Search failed',
      message: error.message
    }, { status: 500 });
  }
}
