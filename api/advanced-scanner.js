// Advanced Scanner API - Professional-grade signals covering full universe
import fetch from 'node-fetch';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

import { scanStocks } from '../lib/advanced-scanner.js';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET') return res.status(405).json({ success: false, error: 'Method not allowed' });

  try {
    const { 
      preset = 'momentum', 
      limit = 50, 
      minPrice, 
      exchange, 
      sector,
      minVolume,
      maxPrice
    } = req.query;
    
    console.log(`Advanced scanner request: preset=${preset}, limit=${limit}`);
    
    // Parse filters
    const filters = {};
    if (minPrice) filters.minPrice = parseFloat(minPrice);
    if (maxPrice) filters.maxPrice = parseFloat(maxPrice);
    if (exchange) filters.exchange = exchange;
    if (sector) filters.sector = sector;
    if (minVolume) filters.minVolume = parseFloat(minVolume);
    
    // Use advanced scanner
    const result = await scanStocks(preset, parseInt(limit), filters);
    
    console.log(`Advanced scanner returned ${result.stocks.length} stocks from ${result.totalProcessed} processed (universe: ${result.universeSize})`);
    
    return res.status(200).json({ 
      success: true, 
      data: { 
        refreshInterval: 30000,
        stocks: result.stocks, 
        count: result.stocks.length,
        totalProcessed: result.totalProcessed,
        universeSize: result.universeSize,
        preset: preset,
        filters: filters,
        lastUpdate: result.lastUpdate
      },
      errors: result.errors || []
    });
  } catch (err) {
    console.error('Advanced scanner error:', err);
    return res.status(200).json({ 
      success: true, 
      data: { 
        refreshInterval: 30000,
        stocks: [] 
      },
      errors: [`Internal server error: ${String(err?.message || err)}`]
    });
  }
}
