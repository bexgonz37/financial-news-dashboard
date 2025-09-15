// Health Status API - Real-time provider and system health
import { unifiedProviderManager } from '../lib/unified-provider-manager.js';
import { comprehensiveSymbolMaster } from '../lib/comprehensive-symbol-master.js';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const detailed = searchParams.get('detailed') === 'true';
    
    // Get provider health
    const providerHealth = unifiedProviderManager.getHealthStatus();
    
    // Get symbol master stats
    const symbolStats = comprehensiveSymbolMaster.getStats();
    
    // Determine overall system status
    let overallStatus = 'healthy';
    let statusMessage = 'All systems operational';
    
    if (providerHealth.overall === 'offline') {
      overallStatus = 'offline';
      statusMessage = 'All providers offline';
    } else if (providerHealth.overall === 'degraded') {
      overallStatus = 'degraded';
      statusMessage = 'Some providers experiencing issues';
    }
    
    // Check symbol master
    if (symbolStats.active === 0) {
      overallStatus = 'degraded';
      statusMessage = 'Symbol master not loaded';
    }
    
    const healthData = {
      overall: {
        status: overallStatus,
        message: statusMessage,
        timestamp: new Date().toISOString()
      },
      providers: providerHealth.providers,
      symbols: {
        total: symbolStats.total,
        active: symbolStats.active,
        lastUpdate: symbolStats.lastUpdate,
        exchanges: symbolStats.exchanges,
        sectors: symbolStats.sectors
      }
    };
    
    // Add detailed information if requested
    if (detailed) {
      healthData.detailed = {
        providerCount: Object.keys(providerHealth.providers).length,
        healthyProviders: Object.values(providerHealth.providers).filter(p => p.status === 'healthy').length,
        circuitBreakers: Object.values(providerHealth.providers).filter(p => p.circuitState === 'open').length,
        rateLimited: Object.values(providerHealth.providers).filter(p => p.rateLimitRemaining <= 5).length
      };
    }
    
    return Response.json({
      success: true,
      data: healthData
    });
    
  } catch (error) {
    console.error('Health status error:', error);
    return Response.json({
      success: false,
      error: 'Health check failed',
      message: error.message
    }, { status: 500 });
  }
}
