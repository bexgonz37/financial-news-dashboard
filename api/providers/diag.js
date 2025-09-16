// Provider diagnostics endpoint with real-time health tracking
import { providerHealth } from '../news.js';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const now = Date.now();
    
    // Calculate provider status
    const getProviderStatus = (provider) => {
      const health = providerHealth[provider];
      if (!health) return 'unknown';
      
      if (health.status === 'success' && health.lastSuccess) {
        const timeSinceSuccess = now - health.lastSuccess;
        if (timeSinceSuccess < 5 * 60 * 1000) { // 5 minutes
          return 'healthy';
        } else if (timeSinceSuccess < 30 * 60 * 1000) { // 30 minutes
          return 'degraded';
        } else {
          return 'stale';
        }
      } else if (health.lastError) {
        return 'error';
      } else {
        return 'unknown';
      }
    };

    const diagnostics = {
      timestamp: new Date().toISOString(),
      providers: {
        fmp: {
          status: getProviderStatus('fmp'),
          lastSuccess: providerHealth.fmp.lastSuccess ? new Date(providerHealth.fmp.lastSuccess).toISOString() : null,
          lastError: providerHealth.fmp.lastError,
          rateLimitBudget: providerHealth.fmp.rateLimitBudget,
          rateLimit: '1 req/sec, burst 2 (via limiter)'
        },
        finnhub: {
          status: getProviderStatus('finnhub'),
          lastSuccess: providerHealth.finnhub.lastSuccess ? new Date(providerHealth.finnhub.lastSuccess).toISOString() : null,
          lastError: providerHealth.finnhub.lastError,
          rateLimitBudget: providerHealth.finnhub.rateLimitBudget,
          rateLimit: '60 req/min'
        },
        alphavantage: {
          status: getProviderStatus('alphavantage'),
          lastSuccess: providerHealth.alphavantage.lastSuccess ? new Date(providerHealth.alphavantage.lastSuccess).toISOString() : null,
          lastError: providerHealth.alphavantage.lastError,
          rateLimitBudget: providerHealth.alphavantage.rateLimitBudget,
          rateLimit: '5 req/min'
        },
        yahoo: {
          status: getProviderStatus('yahoo'),
          lastSuccess: providerHealth.yahoo.lastSuccess ? new Date(providerHealth.yahoo.lastSuccess).toISOString() : null,
          lastError: providerHealth.yahoo.lastError,
          rateLimitBudget: providerHealth.yahoo.rateLimitBudget,
          rateLimit: 'RSS feeds (no API limit)'
        }
      },
      system: {
        uptime: process.uptime(),
        memory: process.memoryUsage(),
        nodeVersion: process.version,
        cacheStatus: 'active'
      }
    };

    return res.status(200).json({
      success: true,
      data: diagnostics
    });

  } catch (error) {
    console.error('Provider diagnostics error:', error);
    return res.status(500).json({
      success: false,
      error: 'Diagnostics failed',
      message: error.message
    });
  }
}