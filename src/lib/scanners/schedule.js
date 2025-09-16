// Scanner scheduler with market/after-hours cadences
import { scannerEngine } from './run.js';
import { marketHours } from '../time/marketHours.js';
import { appState } from '../../state/store.js';

class ScannerScheduler {
  constructor() {
    this.isRunning = false;
    this.intervalId = null;
    this.isLeader = false;
    this.leaderChannel = null;
    this.lastRun = new Date();
    
    // Cadences
    this.cadences = {
      market: 20000,    // 20 seconds during market hours
      afterHours: 90000, // 90 seconds during after-hours
      closed: 300000    // 5 minutes when market is closed
    };
    
    this.initLeaderElection();
  }

  // Initialize leader election using BroadcastChannel
  initLeaderElection() {
    try {
      this.leaderChannel = new BroadcastChannel('scanner-scheduler');
      
      this.leaderChannel.onmessage = (event) => {
        if (event.data.type === 'leader-election') {
          this.handleLeaderElection(event.data);
        }
      };
      
      // Announce presence
      this.announcePresence();
      
      // Check for leader every 30 seconds
      setInterval(() => {
        this.checkLeader();
      }, 30000);
      
    } catch (error) {
      console.warn('BroadcastChannel not supported, running as single instance');
      this.isLeader = true;
    }
  }

  // Announce presence
  announcePresence() {
    if (this.leaderChannel) {
      this.leaderChannel.postMessage({
        type: 'leader-election',
        action: 'announce',
        timestamp: Date.now(),
        instanceId: this.getInstanceId()
      });
    }
  }

  // Handle leader election
  handleLeaderElection(data) {
    if (data.action === 'announce') {
      // If no leader or current leader is stale, try to become leader
      if (!this.isLeader && (!this.leaderId || Date.now() - this.lastLeaderSeen > 60000)) {
        this.tryBecomeLeader();
      }
    } else if (data.action === 'leader-claim') {
      this.leaderId = data.instanceId;
      this.lastLeaderSeen = Date.now();
      this.isLeader = false;
    }
  }

  // Try to become leader
  tryBecomeLeader() {
    if (this.leaderChannel) {
      this.leaderChannel.postMessage({
        type: 'leader-election',
        action: 'leader-claim',
        instanceId: this.getInstanceId(),
        timestamp: Date.now()
      });
      
      // Give other instances time to respond
      setTimeout(() => {
        if (!this.leaderId || this.leaderId === this.getInstanceId()) {
          this.isLeader = true;
          this.leaderId = this.getInstanceId();
          console.log('Became scanner scheduler leader');
        }
      }, 1000);
    }
  }

  // Check if current leader is still active
  checkLeader() {
    if (this.leaderId && Date.now() - this.lastLeaderSeen > 120000) {
      // Leader is stale, try to become leader
      this.leaderId = null;
      this.tryBecomeLeader();
    }
  }

  // Get instance ID
  getInstanceId() {
    if (!this.instanceId) {
      this.instanceId = `scanner-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    }
    return this.instanceId;
  }

  // Start scheduler
  start() {
    if (this.isRunning) return;
    
    if (!this.isLeader) {
      console.log('Not the leader, waiting for scanner results');
      return;
    }
    
    this.isRunning = true;
    console.log('Starting scanner scheduler');
    
    // Run immediately
    this.runScanners();
    
    // Schedule next run
    this.scheduleNextRun();
  }

  // Stop scheduler
  stop() {
    this.isRunning = false;
    
    if (this.intervalId) {
      clearTimeout(this.intervalId);
      this.intervalId = null;
    }
    
    console.log('Scanner scheduler stopped');
  }

  // Schedule next run based on market status
  scheduleNextRun() {
    if (!this.isRunning || !this.isLeader) return;
    
    const cadence = this.getCurrentCadence();
    
    this.intervalId = setTimeout(() => {
      this.runScanners();
      this.scheduleNextRun();
    }, cadence);
  }

  // Get current cadence based on market status
  getCurrentCadence() {
    const status = marketHours.getMarketStatus();
    
    switch (status) {
      case 'market':
        return this.cadences.market;
      case 'after-hours':
      case 'pre-market':
        return this.cadences.afterHours;
      default:
        return this.cadences.closed;
    }
  }

  // Run all scanners
  async runScanners() {
    if (!this.isLeader) return;
    
    try {
      console.log('Running scanners...');
      const startTime = Date.now();
      
      const results = await scannerEngine.runAllScanners();
      
      // Update app state with results
      appState.batch(() => {
        for (const [scannerName, scannerResults] of Object.entries(results)) {
          appState.updateScanner(scannerName, scannerResults);
        }
      });
      
      const duration = Date.now() - startTime;
      console.log(`Scanners completed in ${duration}ms`);
      
      this.lastRun = new Date();
      
    } catch (error) {
      console.error('Scanner run failed:', error);
    }
  }

  // Get scheduler status
  getStatus() {
    return {
      isRunning: this.isRunning,
      isLeader: this.isLeader,
      lastRun: this.lastRun,
      nextRun: this.intervalId ? new Date(Date.now() + this.getCurrentCadence()) : null,
      cadence: this.getCurrentCadence(),
      marketStatus: marketHours.getMarketStatus()
    };
  }

  // Force run scanners (for testing)
  async forceRun() {
    if (!this.isLeader) {
      console.log('Not the leader, cannot force run');
      return;
    }
    
    await this.runScanners();
  }

  // Get scanner statistics
  getStats() {
    const allResults = scannerEngine.getAllScannerResults();
    const stats = {
      totalScanners: Object.keys(allResults).length,
      totalResults: 0,
      byScanner: {},
      lastUpdate: this.lastRun
    };
    
    for (const [scannerName, results] of Object.entries(allResults)) {
      stats.byScanner[scannerName] = results.length;
      stats.totalResults += results.length;
    }
    
    return stats;
  }
}

// Export singleton
export const scannerScheduler = new ScannerScheduler();

// Auto-start scheduler
scannerScheduler.start();
