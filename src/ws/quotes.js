// WebSocket quotes client for Finnhub with tick buffers
import { appState } from '../state/store.js';

class WebSocketQuotes {
  constructor() {
    this.ws = null;
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = 10;
    this.reconnectDelay = 1000;
    this.heartbeatInterval = null;
    this.subscribedSymbols = new Set();
    this.isConnected = false;
    this.lastHeartbeat = 0;
    this.onTickCallback = null;
    
    // For client-side, we'll need to get the token from the API
    this.FINNHUB_WS_URL = null;
    this.HEARTBEAT_INTERVAL = 25000; // 25 seconds
    this.MAX_TICKS_PER_SYMBOL = 300;

    // Don't connect immediately - wait for initialization
  }

  async connect() {
    try {
      // First, get the WebSocket token
      if (!this.FINNHUB_WS_URL) {
        const response = await fetch('/api/ws-token');
        const data = await response.json();
        
        if (!data.success) {
          throw new Error('Failed to get WebSocket token');
        }
        
        this.FINNHUB_WS_URL = data.data.wsUrl;
      }
      
      console.log('Connecting to Finnhub WebSocket...');
      this.ws = new WebSocket(this.FINNHUB_WS_URL);
      
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
          this.handleMessage(data);
        } catch (error) {
          console.error('Failed to parse WebSocket message:', error);
        }
      };

      this.ws.onclose = (event) => {
        console.log('WebSocket closed:', event.code, event.reason);
        this.isConnected = false;
        this.stopHeartbeat();
        this.updateStatus('OFFLINE');
        this.scheduleReconnect();
      };

      this.ws.onerror = (error) => {
        console.error('WebSocket error:', error);
        this.updateStatus('DEGRADED');
      };

    } catch (error) {
      console.error('Failed to connect to WebSocket:', error);
      this.scheduleReconnect();
    }
  }

  handleMessage(data) {
    if (data.type === 'ping') {
      // Respond to ping with pong
      this.send({ type: 'pong' });
      return;
    }

    if (data.type === 'trade' && data.data) {
      const trades = Array.isArray(data.data) ? data.data : [data.data];
      
      trades.forEach((trade) => {
        if (trade.s && trade.p && trade.t) {
          const tick = {
            symbol: trade.s,
            price: parseFloat(trade.p),
            volume: parseFloat(trade.v) || 0,
            timestamp: trade.t * 1000, // Convert to milliseconds
            change: trade.c ? parseFloat(trade.c) : undefined,
            changePercent: trade.dp ? parseFloat(trade.dp) : undefined
          };

          this.appendTick(tick);
          
          if (this.onTickCallback) {
            this.onTickCallback(tick);
          }
        }
      });
    }
  }

  appendTick(tick) {
    const currentTicks = appState.state.ticks.get(tick.symbol) || [];
    
    // Add new tick
    const updatedTicks = [...currentTicks, tick];
    
    // Maintain ring buffer size
    if (updatedTicks.length > this.MAX_TICKS_PER_SYMBOL) {
      updatedTicks.splice(0, updatedTicks.length - this.MAX_TICKS_PER_SYMBOL);
    }
    
    // Update store
    appState.updateTicks(tick.symbol, updatedTicks);
    
    // Update last price and volume in quotes
    const currentQuote = appState.state.quotes.get(tick.symbol) || {};
    appState.updateQuote(tick.symbol, {
      ...currentQuote,
      price: tick.price,
      volume: tick.volume,
      change: tick.change,
      changePercent: tick.changePercent,
      timestamp: tick.timestamp
    });
  }

  subscribe(symbol) {
    if (!this.isConnected || !this.ws) {
      console.warn('WebSocket not connected, cannot subscribe to', symbol);
      return;
    }

    if (this.subscribedSymbols.has(symbol)) {
      return; // Already subscribed
    }

    console.log('Subscribing to', symbol);
    this.send({ type: 'subscribe', symbol });
    this.subscribedSymbols.add(symbol);
  }

  unsubscribe(symbol) {
    if (!this.isConnected || !this.ws) {
      return;
    }

    if (!this.subscribedSymbols.has(symbol)) {
      return; // Not subscribed
    }

    console.log('Unsubscribing from', symbol);
    this.send({ type: 'unsubscribe', symbol });
    this.subscribedSymbols.delete(symbol);
  }

  resubscribeAll() {
    if (!this.isConnected || !this.ws) {
      return;
    }

    console.log('Resubscribing to all symbols:', Array.from(this.subscribedSymbols));
    this.subscribedSymbols.forEach(symbol => {
      this.send({ type: 'subscribe', symbol });
    });
  }

  send(message) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(message));
    }
  }

  startHeartbeat() {
    this.stopHeartbeat();
    this.heartbeatInterval = setInterval(() => {
      if (this.isConnected && this.ws) {
        this.send({ type: 'ping' });
        this.lastHeartbeat = Date.now();
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

    const delay = this.reconnectDelay * Math.pow(2, this.reconnectAttempts);
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

  setOnTickCallback(callback) {
    this.onTickCallback = callback;
  }

  getStatus() {
    return {
      isConnected: this.isConnected,
      subscribedSymbols: Array.from(this.subscribedSymbols),
      lastHeartbeat: this.lastHeartbeat,
      reconnectAttempts: this.reconnectAttempts
    };
  }

  disconnect() {
    this.stopHeartbeat();
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    this.isConnected = false;
    this.subscribedSymbols.clear();
  }
}

// Export singleton
export const wsQuotes = new WebSocketQuotes();