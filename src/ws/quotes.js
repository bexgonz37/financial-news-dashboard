// WebSocket quotes client with polling fallback
import { appState } from '../state/store.js';

class WebSocketQuotes {
  constructor() {
    this.ws = null;
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = 10;
    this.reconnectDelay = 1000;
    this.heartbeatInterval = null;
    this.subscribedSymbols = new Set();
    this.pollingFallback = null;
    this.isConnected = false;
    this.lastHeartbeat = null;
    
    // Provider endpoints (mock - would be real WebSocket endpoints)
    this.endpoints = [
      'wss://fmp-ws.financialmodelingprep.com',
      'wss://finnhub.io/ws',
      'wss://polygon.io/stocks'
    ];
    this.currentEndpointIndex = 0;
  }

  // Connect to WebSocket
  connect() {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      return;
    }

    const endpoint = this.endpoints[this.currentEndpointIndex];
    console.log(`Connecting to WebSocket: ${endpoint}`);

    try {
      this.ws = new WebSocket(endpoint);
      
      this.ws.onopen = () => {
        console.log('WebSocket connected');
        this.isConnected = true;
        this.reconnectAttempts = 0;
        this.startHeartbeat();
        this.resubscribe();
        
        appState.updateStatus({
          wsConnected: true,
          providers: new Map([['quotes', { status: 'healthy', lastUpdate: Date.now() }]])
        });
      };

      this.ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          this.handleMessage(data);
        } catch (error) {
          console.error('WebSocket message parse error:', error);
        }
      };

      this.ws.onclose = () => {
        console.log('WebSocket disconnected');
        this.isConnected = false;
        this.stopHeartbeat();
        this.startPollingFallback();
        this.scheduleReconnect();
        
        appState.updateStatus({
          wsConnected: false,
          providers: new Map([['quotes', { status: 'degraded', lastUpdate: Date.now() }]])
        });
      };

      this.ws.onerror = (error) => {
        console.error('WebSocket error:', error);
        this.tryNextEndpoint();
      };

    } catch (error) {
      console.error('WebSocket connection failed:', error);
      this.startPollingFallback();
    }
  }

  // Handle incoming messages
  handleMessage(data) {
    if (data.type === 'quote') {
      this.handleQuote(data);
    } else if (data.type === 'heartbeat') {
      this.lastHeartbeat = Date.now();
    } else if (data.type === 'error') {
      console.error('WebSocket error:', data.message);
    }
  }

  // Handle quote updates
  handleQuote(data) {
    const quote = {
      symbol: data.symbol,
      price: data.price,
      change: data.change,
      changePercent: data.changePercent,
      volume: data.volume,
      timestamp: data.timestamp || Date.now()
    };

    appState.updateQuote(data.symbol, quote);
  }

  // Subscribe to symbol
  subscribe(symbol) {
    this.subscribedSymbols.add(symbol);
    
    if (this.isConnected && this.ws) {
      this.send({
        type: 'subscribe',
        symbol: symbol
      });
    }
  }

  // Unsubscribe from symbol
  unsubscribe(symbol) {
    this.subscribedSymbols.delete(symbol);
    
    if (this.isConnected && this.ws) {
      this.send({
        type: 'unsubscribe',
        symbol: symbol
      });
    }
  }

  // Resubscribe to all symbols
  resubscribe() {
    if (this.subscribedSymbols.size > 0) {
      this.send({
        type: 'subscribe',
        symbols: Array.from(this.subscribedSymbols)
      });
    }
  }

  // Send message to WebSocket
  send(message) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(message));
    }
  }

  // Start heartbeat
  startHeartbeat() {
    this.heartbeatInterval = setInterval(() => {
      this.send({ type: 'ping' });
    }, 30000); // 30 seconds
  }

  // Stop heartbeat
  stopHeartbeat() {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }
  }

  // Schedule reconnection
  scheduleReconnect() {
    if (this.reconnectAttempts < this.maxReconnectAttempts) {
      const delay = this.reconnectDelay * Math.pow(2, this.reconnectAttempts);
      console.log(`Reconnecting in ${delay}ms (attempt ${this.reconnectAttempts + 1})`);
      
      setTimeout(() => {
        this.reconnectAttempts++;
        this.connect();
      }, delay);
    } else {
      console.log('Max reconnection attempts reached, staying on polling fallback');
    }
  }

  // Try next endpoint
  tryNextEndpoint() {
    this.currentEndpointIndex = (this.currentEndpointIndex + 1) % this.endpoints.length;
    this.reconnectAttempts++;
    this.connect();
  }

  // Start polling fallback
  startPollingFallback() {
    if (this.pollingFallback) return;

    console.log('Starting polling fallback for quotes');
    
    this.pollingFallback = setInterval(async () => {
      await this.pollQuotes();
    }, 5000); // Poll every 5 seconds
  }

  // Stop polling fallback
  stopPollingFallback() {
    if (this.pollingFallback) {
      clearInterval(this.pollingFallback);
      this.pollingFallback = null;
    }
  }

  // Poll quotes from REST API
  async pollQuotes() {
    if (this.subscribedSymbols.size === 0) return;

    try {
      const symbols = Array.from(this.subscribedSymbols);
      const response = await fetch(`/api/quotes?symbols=${symbols.join(',')}`);
      const data = await response.json();

      if (data.success && data.data) {
        appState.updateQuotes(data.data);
      }
    } catch (error) {
      console.error('Polling quotes failed:', error);
    }
  }

  // Disconnect
  disconnect() {
    this.stopHeartbeat();
    this.stopPollingFallback();
    
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    
    this.isConnected = false;
    this.subscribedSymbols.clear();
  }

  // Get connection status
  getStatus() {
    return {
      connected: this.isConnected,
      subscribedSymbols: Array.from(this.subscribedSymbols),
      lastHeartbeat: this.lastHeartbeat,
      reconnectAttempts: this.reconnectAttempts
    };
  }
}

// Export singleton
export const wsQuotes = new WebSocketQuotes();

// Auto-connect on import
wsQuotes.connect();
