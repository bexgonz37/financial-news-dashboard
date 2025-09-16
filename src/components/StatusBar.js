// Status bar component showing market mode and data ages
import { appState } from '../state/store.js';
import { marketHours } from '../lib/time/marketHours.js';

class StatusBar {
  constructor(containerId) {
    this.container = document.getElementById(containerId);
    this.unsubscribe = null;
    
    if (this.container) {
      this.init();
    }
  }

  init() {
    this.render();
    this.subscribe();
  }

  subscribe() {
    this.unsubscribe = appState.subscribe((state) => {
      this.render();
    });
  }

  render() {
    if (!this.container) return;
    
    const status = this.getStatus();
    const marketInfo = marketHours.getSessionInfo();
    
    this.container.innerHTML = `
      <div class="status-bar">
        <div class="status-left">
          <span class="market-status ${status.marketStatus}">
            ${this.getMarketStatusIcon(status.marketStatus)} ${status.marketStatusText}
          </span>
          <span class="separator">|</span>
          <span class="data-age">
            Quotes: ${status.quotesAge}
          </span>
          <span class="separator">|</span>
          <span class="data-age">
            News: ${status.newsAge}
          </span>
          <span class="separator">|</span>
          <span class="data-age">
            Scanner: ${status.scannerAge}
          </span>
          <span class="separator">|</span>
          <span class="data-age">
            Ticks: ${status.ticksAge}
          </span>
        </div>
        <div class="status-right">
          <span class="ws-status ${status.wsStatus.toLowerCase()}">
            ${this.getWsStatusIcon(status.wsStatus)} ${status.wsStatus}
            ${status.isStale ? ' (Stale)' : ''}
          </span>
          <span class="separator">|</span>
          <span class="next-update">
            Next: ${status.nextUpdate}
          </span>
        </div>
      </div>
    `;
  }

  getStatus() {
    const state = appState.state;
    const marketStatus = marketHours.getMarketStatus();
    const liveStatus = appState.getLiveStatus();
    
    return {
      marketStatus,
      marketStatusText: this.getMarketStatusText(marketStatus),
      wsStatus: liveStatus.wsStatus,
      wsConnected: state.status.wsConnected,
      quotesAge: this.formatDataAge(appState.getDataAge('quotes')),
      newsAge: this.formatDataAge(appState.getDataAge('news')),
      scannerAge: this.formatDataAge(appState.getDataAge('scanners')),
      ticksAge: this.formatDataAge(appState.getDataAge('ticks')),
      nextUpdate: this.getNextUpdateTime(),
      isStale: liveStatus.isStale,
      lastHeartbeat: liveStatus.lastHeartbeat,
      timeSinceHeartbeat: liveStatus.timeSinceHeartbeat
    };
  }

  getMarketStatusText(status) {
    switch (status) {
      case 'market':
        return 'Market Open';
      case 'pre-market':
        return 'Pre-Market';
      case 'after-hours':
        return 'After Hours';
      default:
        return 'Market Closed';
    }
  }

  getMarketStatusIcon(status) {
    switch (status) {
      case 'market':
        return '🟢';
      case 'pre-market':
        return '🟡';
      case 'after-hours':
        return '🟠';
      default:
        return '🔴';
    }
  }

  getWsStatusIcon(status) {
    switch (status) {
      case 'LIVE':
        return '🟢';
      case 'DEGRADED':
        return '🟡';
      case 'OFFLINE':
        return '🔴';
      default:
        return '⚪';
    }
  }

  formatDataAge(ageSeconds) {
    if (ageSeconds === null) return 'Never';
    if (ageSeconds < 60) return `${ageSeconds}s ago`;
    if (ageSeconds < 3600) return `${Math.floor(ageSeconds / 60)}m ago`;
    return `${Math.floor(ageSeconds / 3600)}h ago`;
  }

  getNextUpdateTime() {
    const marketStatus = marketHours.getMarketStatus();
    let nextUpdate;
    
    switch (marketStatus) {
      case 'market':
        nextUpdate = new Date(Date.now() + 20000); // 20 seconds
        break;
      case 'pre-market':
      case 'after-hours':
        nextUpdate = new Date(Date.now() + 90000); // 90 seconds
        break;
      default:
        nextUpdate = new Date(Date.now() + 300000); // 5 minutes
    }
    
    return nextUpdate.toLocaleTimeString();
  }

  destroy() {
    if (this.unsubscribe) {
      this.unsubscribe();
    }
  }
}

// Export class
export { StatusBar };
