// Provider Diagnostics API - Real-time provider health monitoring
export const dynamic = 'force-dynamic';
export const revalidate = 0;

import { providerQueue } from '../../lib/provider-queue.js';

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

    // Get provider status from provider queue
    const providerStatus = providerQueue.getProviderStatus();
    
    // Check each provider
    const providerNames = ['fmp', 'finnhub', 'alphavantage', 'marketaux'];
    
    for (const providerName of providerNames) {
      const status = providerStatus[providerName] || {
        enabled: false,
        keyPresent: false,
        rateLimitBackoffUntil: null,
        lastAttemptAt: null,
        lastSuccessAt: null,
        lastError: null,
        consecutiveFailures: 0,
        tokens: 0,
        requestCount: 0
      };

      // Determine provider health status
      let healthStatus = 'offline';
      if (status.enabled && status.keyPresent) {
        if (status.rateLimitBackoffUntil && new Date(status.rateLimitBackoffUntil) > new Date()) {
          healthStatus = 'degraded';
        } else if (status.lastSuccessAt) {
          healthStatus = 'healthy';
        } else {
          healthStatus = 'degraded';
        }
      }
      
      diagnostics.providers[providerName] = {
        enabled: status.enabled,
        keyPresent: status.keyPresent,
        lastAttemptAt: status.lastAttemptAt,
        lastSuccessAt: status.lastSuccessAt,
        lastError: status.lastError,
        rateLimitBackoffUntil: status.rateLimitBackoffUntil,
        consecutiveFailures: status.consecutiveFailures,
        tokens: status.tokens,
        requestCount: status.requestCount,
        status: healthStatus
      };

      // Update overall counts
      diagnostics.overall.total++;
      if (healthStatus === 'healthy') {
        diagnostics.overall.healthy++;
      } else if (healthStatus === 'degraded') {
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
