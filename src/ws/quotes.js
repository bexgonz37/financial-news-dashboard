// WebSocket quotes client for Finnhub with tick buffers
import { appState } from '../state/store.js';

class WebSocketQuotes {
  constructor() {
    this.ws = null;
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = 10;
    this.reconnectDelay = 500; // Start with 0.5s
    this.heartbeatInterval = null;
    this.subscribedSymbols = new Set();
    this.isConnected = false;
    this.lastHeartbeat = 0;
    this.onTickCallback = null;
    
    // Initialize key as null, will be fetched on connect
    this.CLIENT_KEY = null;
    this.HEARTBEAT_INTERVAL = 25000; // 25 seconds
    this.MAX_TICKS_PER_SYMBOL = 300;
  }

  async getClientKey() {
    // Fetch key from /api/env endpoint
    try {
      const response = await fetch('/api/env');
      if (response.ok) {
        const data = await response.json();
        if (data.success && data.data.FINNHUB_KEY) {
          return data.data.FINNHUB_KEY;
        }
      }
    } catch (error) {
      console.warn('Failed to fetch FINNHUB_KEY from /api/env:', error);
    }
    
    // Fallback to build-injected environment
    if (typeof window !== 'undefined' && window.ENV) {
      return window.ENV.FINNHUB_KEY;
    }
    if (typeof process !== 'undefined' && process.env) {
      return process.env.FINNHUB_KEY || process.env.NEXT_PUBLIC_FINNHUB_KEY || process.env.VITE_FINNHUB_KEY;
    }
    if (typeof import.meta !== 'undefined' && import.meta.env) {
      return import.meta.env.VITE_FINNHUB_KEY;
    }
    return null;
  }

  async connect() {
    try {
      // Fetch the key if not already available
      if (!this.CLIENT_KEY) {
        this.CLIENT_KEY = await this.getClientKey();
      }
      
      if (!this.CLIENT_KEY) {
        this.updateStatus('OFFLINE');
        this.showKeyMissingBanner('FINNHUB_KEY');
        throw new Error('FINNHUB_KEY not configured for client-side use');
      }
      
      const wsUrl = `wss://ws.finnhub.io?token=${this.CLIENT_KEY}`;
      console.log('Connecting to Finnhub WebSocket...');
      
      this.ws = new WebSocket(wsUrl);
      
      this.ws.onopen = () => {
        console.log('WebSocket connected to Finnhub');
        this.isConnected = true;
        this.reconnectAttempts = 0;
        this.startHeartbeat();
        this.resubscribeAll();
        this.updateStatus('LIVE');
      };

      this.ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          
          if (data.type === 'ping') {
            // Respond to ping with pong
            this.ws.send(JSON.stringify({ type: 'pong' }));
            return;
          }
          
          if (data.type === 'trade' && data.data) {
            const tick = {
              symbol: data.data.s,
              price: data.data.p,
              volume: data.data.v,
              timestamp: data.data.t,
              time: new Date(data.data.t).toISOString()
            };
            
            this.handleTick(tick);
          }
        } catch (error) {
          console.error('Error parsing WebSocket message:', error);
        }
      };

      this.ws.onclose = (event) => {
        console.log('WebSocket closed:', event.code, event.reason);
        this.isConnected = false;
        this.stopHeartbeat();
        
        if (event.code !== 1000) { // Not a normal closure
          this.scheduleReconnect();
        }
      };

      this.ws.onerror = (error) => {
        console.error('WebSocket error:', error);
        this.updateStatus('DEGRADED');
      };

    } catch (error) {
      console.error('Failed to connect to WebSocket:', error);
      this.updateStatus('OFFLINE');
      this.scheduleReconnect();
    }
  }

  handleTick(tick) {
    if (!tick.symbol) return;
    
    // Update ring buffer in app state
    appState.appendTick(tick.symbol, tick);
    
    // Call callback if set
    if (this.onTickCallback) {
      this.onTickCallback(tick);
    }
  }

  subscribe(symbol) {
    if (!this.isConnected || !this.ws) {
      console.warn('WebSocket not connected, cannot subscribe to', symbol);
      return;
    }
    
    if (this.subscribedSymbols.has(symbol)) {
      return; // Already subscribed
    }
    
    this.subscribedSymbols.add(symbol);
    
    const message = {
      type: 'subscribe',
      symbol: symbol
    };
    
    this.ws.send(JSON.stringify(message));
    console.log('Subscribed to', symbol);
  }

  unsubscribe(symbol) {
    if (!this.isConnected || !this.ws) {
      return;
    }
    
    if (!this.subscribedSymbols.has(symbol)) {
      return; // Not subscribed
    }
    
    this.subscribedSymbols.delete(symbol);
    
    const message = {
      type: 'unsubscribe',
      symbol: symbol
    };
    
    this.ws.send(JSON.stringify(message));
    console.log('Unsubscribed from', symbol);
  }

  resubscribeAll() {
    if (!this.isConnected || !this.ws) return;
    
    for (const symbol of this.subscribedSymbols) {
      const message = {
        type: 'subscribe',
        symbol: symbol
      };
      this.ws.send(JSON.stringify(message));
    }
    
    console.log(`Resubscribed to ${this.subscribedSymbols.size} symbols`);
  }

  startHeartbeat() {
    this.stopHeartbeat(); // Clear any existing interval
    
    this.heartbeatInterval = setInterval(() => {
      if (this.isConnected && this.ws) {
        this.ws.send(JSON.stringify({ type: 'ping' }));
        this.lastHeartbeat = Date.now();
        this.updateStatus('LIVE');
      }
    }, this.HEARTBEAT_INTERVAL);
  }

  stopHeartbeat() {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }
  }

  scheduleReconnect() {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.error('Max reconnection attempts reached');
      this.updateStatus('OFFLINE');
      return;
    }
    
    const delay = Math.min(this.reconnectDelay * Math.pow(2, this.reconnectAttempts), 10000);
    console.log(`Reconnecting in ${delay}ms (attempt ${this.reconnectAttempts + 1})`);
    
    setTimeout(() => {
      this.reconnectAttempts++;
      this.connect();
    }, delay);
  }

  updateStatus(status) {
    appState.updateStatus({
      wsStatus: status,
      lastHeartbeat: this.lastHeartbeat
    });
  }

  showKeyMissingBanner(keyName) {
    // Remove existing banner if any
    const existingBanner = document.getElementById('key-missing-banner');
    if (existingBanner) {
      existingBanner.remove();
    }

    // Create banner
    const banner = document.createElement('div');
    banner.id = 'key-missing-banner';
    banner.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      background: #dc2626;
      color: white;
      padding: 12px;
      text-align: center;
      font-weight: bold;
      z-index: 10000;
      box-shadow: 0 2px 4px rgba(0,0,0,0.1);
    `;
    banner.textContent = `${keyName} MISSING/INVALID - WebSocket connection failed`;
    
    document.body.insertBefore(banner, document.body.firstChild);
  }

  setOnTickCallback(callback) {
    this.onTickCallback = callback;
  }

  getStatus() {
    return {
      connected: this.isConnected,
      status: this.isConnected ? 'LIVE' : 'OFFLINE',
      subscribedCount: this.subscribedSymbols.size,
      lastHeartbeat: this.lastHeartbeat
    };
  }

  disconnect() {
    this.stopHeartbeat();
    if (this.ws) {
      this.ws.close(1000, 'Normal closure');
      this.ws = null;
    }
    this.isConnected = false;
    this.subscribedSymbols.clear();
  }
}

// Export singleton instance
export const wsQuotes = new WebSocketQuotes();