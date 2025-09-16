// Scanner scheduler for market hours and after-hours
import { marketHours } from '../time/marketHours.js';
import { scannerEngine } from './run.js';
import { appState } from '../../state/store.js';

class ScannerScheduler {
  constructor() {
    this.intervalId = null;
    this.isRunning = false;
    this.regMs = 20000; // 20 seconds for market hours
    this.ahMs = 90000; // 90 seconds for after-hours
    this.lastRun = 0;
  }

  start() {
    if (this.isRunning) return;
    
    this.isRunning = true;
    console.log('Starting scanner scheduler');
    
    // Run immediately
    this.runScanners();
    
    // Set up interval
    this.intervalId = setInterval(() => {
      this.runScanners();
    }, this.regMs);
    
    // Re-evaluate mode every 60 seconds
    setInterval(() => {
      this.updateInterval();
    }, 60000);
  }

  stop() {
    if (!this.isRunning) return;
    
    this.isRunning = false;
    console.log('Stopping scanner scheduler');
    
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
  }

  updateInterval() {
    if (!this.isRunning) return;
    
    const marketStatus = marketHours.getMarketStatus();
    const isMarketHours = marketStatus === 'market';
    const newInterval = isMarketHours ? this.regMs : this.ahMs;
    
    // Only update if interval changed
    if (this.intervalId && newInterval !== (isMarketHours ? this.regMs : this.ahMs)) {
      clearInterval(this.intervalId);
      this.intervalId = setInterval(() => {
        this.runScanners();
      }, newInterval);
      
      console.log(`Scanner interval updated: ${newInterval}ms (${isMarketHours ? 'market' : 'after-hours'})`);
    }
  }

  async runScanners() {
    try {
      console.log('Running scanners...');
      const startTime = Date.now();
      
      const results = await scannerEngine.runAllScanners();
      
      // Store results in app state
      appState.updateScanners(results);
      
      this.lastRun = startTime;
      
      const duration = Date.now() - startTime;
      console.log(`Scanners completed in ${duration}ms`);
      
      // Log results summary
      Object.entries(results).forEach(([name, items]) => {
        console.log(`${name}: ${items.length} results`);
      });
      
    } catch (error) {
      console.error('Scanner run failed:', error);
    }
  }

  getStatus() {
    return {
      running: this.isRunning,
      lastRun: this.lastRun,
      interval: this.intervalId ? (marketHours.getMarketStatus() === 'market' ? this.regMs : this.ahMs) : 0
    };
  }
}

// Export singleton
export const scannerScheduler = new ScannerScheduler();