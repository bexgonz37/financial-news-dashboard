// Mini-chart component with ring buffer for streaming data
import { appState } from '../state/store.js';

class MiniChart {
  constructor(container, options = {}) {
    this.container = container;
    this.options = {
      width: 60,
      height: 20,
      symbol: null,
      range: '1d',
      ...options
    };
    
    this.ringBuffer = [];
    this.maxBufferSize = 100;
    this.isRendering = false;
    this.lastDataTime = 0;
    
    this.init();
  }

  init() {
    if (!this.container) return;
    
    this.container.innerHTML = '';
    this.container.style.width = `${this.options.width}px`;
    this.container.style.height = `${this.options.height}px`;
    this.container.style.position = 'relative';
    this.container.style.overflow = 'hidden';
    
    // Create SVG
    this.svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    this.svg.setAttribute('width', this.options.width);
    this.svg.setAttribute('height', this.options.height);
    this.svg.style.position = 'absolute';
    this.svg.style.top = '0';
    this.svg.style.left = '0';
    
    this.container.appendChild(this.svg);
    
    // Subscribe to quote updates
    this.subscribeToQuotes();
    
    // Load initial data
    this.loadInitialData();
  }

  subscribeToQuotes() {
    if (!this.options.symbol) return;
    
    this.unsubscribe = appState.subscribe((state) => {
      const ticks = state.ticks.get(this.options.symbol);
      if (ticks && ticks.length > 0) {
        // Update the entire buffer with latest ticks
        this.updateFromTicks(ticks);
      } else {
        // No ticks available - show loading or resolve state
        this.renderNoData();
      }
    });
  }

  async loadInitialData() {
    if (!this.options.symbol) return;
    
    // Get initial tick data from store instead of REST call
    const ticks = appState.getTicks(this.options.symbol);
    if (ticks && ticks.length > 0) {
      this.updateFromTicks(ticks);
    } else {
      // No tick data available - show loading state
      this.renderNoData();
    }
  }

  addDataPoint(tick) {
    const dataPoint = {
      timestamp: tick.timestamp || Date.now(),
      price: tick.price,
      volume: tick.volume || 0
    };
    
    this.ringBuffer.push(dataPoint);
    
    // Maintain ring buffer size
    if (this.ringBuffer.length > this.maxBufferSize) {
      this.ringBuffer.shift();
    }
    
    this.render();
  }

  updateFromTicks(ticks) {
    // Convert ticks to data points
    this.ringBuffer = ticks.map(tick => ({
      timestamp: tick.timestamp,
      price: tick.price,
      volume: tick.volume || 0
    }));
    
    // Update last data time
    if (ticks.length > 0) {
      this.lastDataTime = ticks[ticks.length - 1].timestamp;
    }
    
    this.render();
  }

  renderNoData() {
    if (!this.container) return;
    
    this.container.innerHTML = '<div style="display:flex;align-items:center;justify-content:center;height:100%;color:var(--meta);font-size:0.7rem;">Resolve</div>';
  }

  isStale() {
    if (this.ringBuffer.length === 0) return true;
    
    const lastTick = this.ringBuffer[this.ringBuffer.length - 1];
    const now = Date.now();
    const timeSinceLastTick = now - lastTick.timestamp;
    
    // Stale thresholds: 5 minutes for regular hours, 15 minutes for after hours
    const staleThreshold = this.isAfterHours() ? 15 * 60 * 1000 : 5 * 60 * 1000;
    
    return timeSinceLastTick > staleThreshold;
  }

  isAfterHours() {
    const now = new Date();
    const hour = now.getHours();
    const day = now.getDay();
    
    // After hours: 4 PM - 8 PM ET (21:00 - 01:00 UTC)
    return day >= 1 && day <= 5 && (hour >= 21 || hour < 1);
  }

  render() {
    if (this.isRendering || !this.svg) return;
    
    this.isRendering = true;
    
    // Check if data is stale
    const isStale = this.isStale();
    
    try {
      // Clear previous content
      this.svg.innerHTML = '';
      
      if (this.ringBuffer.length < 2) {
        this.renderNoData();
        return;
      }
      
      // Calculate price range
      const prices = this.ringBuffer.map(d => d.price);
      const minPrice = Math.min(...prices);
      const maxPrice = Math.max(...prices);
      const priceRange = maxPrice - minPrice;
      
      if (priceRange === 0) {
        this.renderFlat();
        return;
      }
      
      // Create path
      const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      const points = this.ringBuffer.map((d, i) => {
        const x = (i / (this.ringBuffer.length - 1)) * this.options.width;
        const y = this.options.height - ((d.price - minPrice) / priceRange) * this.options.height;
        return `${i === 0 ? 'M' : 'L'} ${x} ${y}`;
      }).join(' ');
      
      path.setAttribute('d', points);
      path.setAttribute('stroke', this.getLineColor());
      path.setAttribute('stroke-width', '1');
      path.setAttribute('fill', 'none');
      
      this.svg.appendChild(path);
      
      // Add gradient fill
      this.addGradientFill(prices, minPrice, maxPrice);
      
      // Add stale badge if data is stale
      if (isStale) {
        const staleText = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        staleText.setAttribute('x', 5);
        staleText.setAttribute('y', this.options.height - 5);
        staleText.setAttribute('text-anchor', 'start');
        staleText.setAttribute('font-size', '6px');
        staleText.setAttribute('fill', '#ffc107');
        staleText.textContent = 'STALE';
        this.svg.appendChild(staleText);
      }
      
    } finally {
      this.isRendering = false;
    }
  }

  addGradientFill(prices, minPrice, maxPrice) {
    const defs = document.createElementNS('http://www.w3.org/2000/svg', 'defs');
    const gradient = document.createElementNS('http://www.w3.org/2000/svg', 'linearGradient');
    gradient.setAttribute('id', `gradient-${this.options.symbol}`);
    gradient.setAttribute('x1', '0%');
    gradient.setAttribute('y1', '0%');
    gradient.setAttribute('x2', '0%');
    gradient.setAttribute('y2', '100%');
    
    const stop1 = document.createElementNS('http://www.w3.org/2000/svg', 'stop');
    stop1.setAttribute('offset', '0%');
    stop1.setAttribute('stop-color', this.getLineColor());
    stop1.setAttribute('stop-opacity', '0.3');
    
    const stop2 = document.createElementNS('http://www.w3.org/2000/svg', 'stop');
    stop2.setAttribute('offset', '100%');
    stop2.setAttribute('stop-color', this.getLineColor());
    stop2.setAttribute('stop-opacity', '0');
    
    gradient.appendChild(stop1);
    gradient.appendChild(stop2);
    defs.appendChild(gradient);
    this.svg.appendChild(defs);
    
    // Create filled path
    const filledPath = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    const points = this.ringBuffer.map((d, i) => {
      const x = (i / (this.ringBuffer.length - 1)) * this.options.width;
      const y = this.options.height - ((d.price - minPrice) / priceRange) * this.options.height;
      return `${i === 0 ? 'M' : 'L'} ${x} ${y}`;
    }).join(' ');
    
    const bottomY = this.options.height;
    const pathData = `${points} L ${this.options.width} ${bottomY} L 0 ${bottomY} Z`;
    
    filledPath.setAttribute('d', pathData);
    filledPath.setAttribute('fill', `url(#gradient-${this.options.symbol})`);
    
    this.svg.insertBefore(filledPath, this.svg.firstChild);
  }

  getLineColor() {
    if (this.ringBuffer.length < 2) return 'var(--accent)';
    
    const firstPrice = this.ringBuffer[0].price;
    const lastPrice = this.ringBuffer[this.ringBuffer.length - 1].price;
    
    if (lastPrice > firstPrice) {
      return 'var(--up)';
    } else if (lastPrice < firstPrice) {
      return 'var(--down)';
    } else {
      return 'var(--accent)';
    }
  }

  renderNoData() {
    const text = document.createElementNS('http://www.w3.org/2000/svg', 'text');
    text.setAttribute('x', this.options.width / 2);
    text.setAttribute('y', this.options.height / 2);
    text.setAttribute('text-anchor', 'middle');
    text.setAttribute('dominant-baseline', 'middle');
    text.setAttribute('font-size', '10');
    text.setAttribute('fill', 'var(--meta)');
    text.textContent = 'No data';
    
    this.svg.appendChild(text);
  }

  renderFlat() {
    const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
    line.setAttribute('x1', '0');
    line.setAttribute('y1', this.options.height / 2);
    line.setAttribute('x2', this.options.width);
    line.setAttribute('y2', this.options.height / 2);
    line.setAttribute('stroke', 'var(--meta)');
    line.setAttribute('stroke-width', '1');
    
    this.svg.appendChild(line);
  }

  updateSymbol(symbol) {
    this.options.symbol = symbol;
    this.ringBuffer = [];
    this.lastDataTime = 0;
    
    if (this.unsubscribe) {
      this.unsubscribe();
    }
    
    this.subscribeToQuotes();
    this.loadInitialData();
  }

  destroy() {
    if (this.unsubscribe) {
      this.unsubscribe();
    }
    
    if (this.container) {
      this.container.innerHTML = '';
    }
  }
}

// Export class
export { MiniChart };
