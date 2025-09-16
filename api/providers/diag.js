// Provider Diagnostics API - Real-time provider health monitoring
export const dynamic = 'force-dynamic';
export const revalidate = 0;

import { unifiedProviderManager } from '../../lib/unified-provider-manager.js';

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const diagnostics = {
      timestamp: new Date().toISOString(),
      providers: {},
      overall: {
        healthy: 0,
        degraded: 0,
        offline: 0,
        total: 0
      }
    };

    // Get provider health status
    const healthStatus = unifiedProviderManager.getHealthStatus();
    
    // Check each provider
    const providerNames = ['fmp', 'finnhub', 'alphavantage', 'marketaux'];
    
    for (const providerName of providerNames) {
      const health = healthStatus.providers[providerName] || {
        status: 'unknown',
        lastCheck: null,
        lastSuccess: null,
        lastError: null,
        consecutiveFailures: 0,
        backoffUntil: null
      };

      const keyPresent = !!process.env[`${providerName.toUpperCase()}_KEY`];
      const isEnabled = keyPresent && health.status !== 'offline';
      
      diagnostics.providers[providerName] = {
        enabled: isEnabled,
        keyPresent,
        lastAttemptAt: health.lastCheck ? new Date(health.lastCheck).toISOString() : null,
        lastSuccessAt: health.lastSuccess ? new Date(health.lastSuccess).toISOString() : null,
        lastError: health.lastError ? {
          message: health.lastError.message,
          statusCode: health.lastError.statusCode,
          timestamp: new Date(health.lastError.timestamp).toISOString()
        } : null,
        rateLimitBackoffUntil: health.backoffUntil ? new Date(health.backoffUntil).toISOString() : null,
        consecutiveFailures: health.consecutiveFailures,
        status: health.status
      };

      // Update overall counts
      diagnostics.overall.total++;
      if (health.status === 'healthy') {
        diagnostics.overall.healthy++;
      } else if (health.status === 'degraded') {
        diagnostics.overall.degraded++;
      } else {
        diagnostics.overall.offline++;
      }
    }

    // Determine overall status
    if (diagnostics.overall.healthy === diagnostics.overall.total) {
      diagnostics.overall.status = 'healthy';
    } else if (diagnostics.overall.healthy > 0) {
      diagnostics.overall.status = 'degraded';
    } else {
      diagnostics.overall.status = 'offline';
    }

    return res.status(200).json({
      success: true,
      data: diagnostics
    });

  } catch (error) {
    console.error('Provider diagnostics error:', error);
    return res.status(500).json({
      success: false,
      error: 'Internal server error',
      message: error.message
    });
  }
}
