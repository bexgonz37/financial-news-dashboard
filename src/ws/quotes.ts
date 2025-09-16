// WebSocket quotes client for Finnhub with tick buffers
import { appState } from '../state/store.js';

interface Tick {
  symbol: string;
  price: number;
  volume: number;
  timestamp: number;
  change?: number;
  changePercent?: number;
}

class WebSocketQuotes {
  private ws: WebSocket | null = null;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 10;
  private reconnectDelay = 1000;
  private heartbeatInterval: NodeJS.Timeout | null = null;
  private subscribedSymbols = new Set<string>();
  private isConnected = false;
  private lastHeartbeat = 0;
  private onTickCallback: ((tick: Tick) => void) | null = null;
  
  private readonly FINNHUB_WS_URL = `wss://ws.finnhub.io?token=${process.env.FINNHUB_KEY || 'YOUR_FINNHUB_KEY'}`;
  private readonly HEARTBEAT_INTERVAL = 25000; // 25 seconds
  private readonly MAX_TICKS_PER_SYMBOL = 300;

  constructor() {
    this.connect();
  }

  connect() {
    try {
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

  private handleMessage(data: any) {
    if (data.type === 'ping') {
      // Respond to ping with pong
      this.send({ type: 'pong' });
      return;
    }

    if (data.type === 'trade' && data.data) {
      const trades = Array.isArray(data.data) ? data.data : [data.data];
      
      trades.forEach((trade: any) => {
        if (trade.s && trade.p && trade.t) {
          const tick: Tick = {
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

  private appendTick(tick: Tick) {
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

  subscribe(symbol: string) {
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

  unsubscribe(symbol: string) {
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

  private resubscribeAll() {
    if (!this.isConnected || !this.ws) {
      return;
    }

    console.log('Resubscribing to all symbols:', Array.from(this.subscribedSymbols));
    this.subscribedSymbols.forEach(symbol => {
      this.send({ type: 'subscribe', symbol });
    });
  }

  private send(message: any) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(message));
    }
  }

  private startHeartbeat() {
    this.stopHeartbeat();
    this.heartbeatInterval = setInterval(() => {
      if (this.isConnected && this.ws) {
        this.send({ type: 'ping' });
        this.lastHeartbeat = Date.now();
      }
    }, this.HEARTBEAT_INTERVAL);
  }

  private stopHeartbeat() {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }
  }

  private scheduleReconnect() {
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

  private updateStatus(status: 'LIVE' | 'DEGRADED' | 'OFFLINE') {
    appState.updateStatus({
      wsStatus: status,
      lastHeartbeat: this.lastHeartbeat
    });
  }

  setOnTickCallback(callback: (tick: Tick) => void) {
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
