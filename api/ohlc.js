import fetch from 'node-fetch';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

import { FMPProvider } from '../lib/providers/fmp.js';
import { FinnhubProvider } from '../lib/providers/finnhub.js';
import { AlphaVantageProvider } from '../lib/providers/alphavantage.js';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET') return res.status(405).json({ success: false, error: 'Method not allowed' });

  try {
    const { ticker, interval = '5min', limit = 100 } = req.query;
    
    if (!ticker) {
      return res.status(400).json({ 
        success: false, 
        error: 'Missing ticker parameter' 
      });
    }

    console.log(`OHLC request: ${ticker}, ${interval}, ${limit}`);

    // Initialize providers
    const providers = [];
    if (process.env.FMP_KEY) {
      providers.push(new FMPProvider(process.env.FMP_KEY));
    }
    if (process.env.FINNHUB_KEY) {
      providers.push(new FinnhubProvider(process.env.FINNHUB_KEY));
    }
    if (process.env.ALPHAVANTAGE_KEY) {
      providers.push(new AlphaVantageProvider(process.env.ALPHAVANTAGE_KEY));
    }

    if (providers.length === 0) {
      return res.status(500).json({ 
        success: false, 
        error: 'No API keys available',
        data: { candles: [] }
      });
    }

    // Try providers in parallel
    let candles = [];
    const providerErrors = [];
    
    const providerPromises = providers.map(async (provider) => {
      try {
        const data = await provider.getOHLC(ticker, interval, limit);
        return { provider: provider.name, candles: data, error: null };
      } catch (error) {
        console.warn(`${provider.name} OHLC failed:`, error.message);
        return { provider: provider.name, candles: [], error: error.message };
      }
    });

    const results = await Promise.allSettled(providerPromises);
    
    for (const result of results) {
      if (result.status === 'fulfilled') {
        const { provider, candles: data, error } = result.value;
        if (error) {
          providerErrors.push(`${provider}: ${error}`);
        } else if (data.length > 0) {
          candles = data;
          break; // Use first successful provider
        }
      } else {
        providerErrors.push(`Provider error: ${result.reason.message}`);
      }
    }

    if (candles.length === 0) {
      return res.status(500).json({ 
        success: false, 
        error: 'No OHLC data available',
        message: `All providers failed: ${providerErrors.join(', ')}`,
        providerErrors: providerErrors,
        data: { candles: [] }
      });
    }

    return res.status(200).json({
      success: true,
      data: {
        candles: candles,
        count: candles.length,
        ticker: ticker,
        interval: interval,
        lastUpdate: new Date().toISOString(),
        providerErrors: providerErrors
      }
    });

  } catch (error) {
    console.error('OHLC API error:', error);
    return res.status(500).json({
      success: false,
      error: 'Internal server error',
      message: error.message,
      data: { candles: [] }
    });
  }
}