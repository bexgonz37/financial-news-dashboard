// Full chart component with overlays and WS tick buffer
import { appState } from '../state/store.js';

class Chart {
  constructor(container, options = {}) {
    this.container = container;
    this.options = {
      width: 800,
      height: 400,
      symbol: null,
      ...options
    };
    
    this.chart = null;
    this.candlestickSeries = null;
    this.volumeSeries = null;
    this.vwapSeries = null;
    this.ema9Series = null;
    this.ema20Series = null;
    this.hodLine = null;
    this.lodLine = null;
    
    this.ringBuffer = [];
    this.maxBufferSize = 300;
    this.lastSymbol = null;
    
    this.init();
  }

  init() {
    if (!this.container) return;
    
    this.container.innerHTML = '';
    this.container.style.width = `${this.options.width}px`;
    this.container.style.height = `${this.options.height}px`;
    
    // Create chart container
    const chartContainer = document.createElement('div');
    chartContainer.id = 'chart-container';
    chartContainer.style.width = '100%';
    chartContainer.style.height = '100%';
    
    this.container.appendChild(chartContainer);
    
    // Initialize Lightweight Charts
    this.initializeChart();
    
    // Subscribe to quote updates
    this.subscribeToQuotes();
  }

  initializeChart() {
    if (typeof LightweightCharts === 'undefined') {
      console.error('LightweightCharts not loaded');
      return;
    }

    this.chart = LightweightCharts.createChart(this.container.querySelector('#chart-container'), {
      width: this.options.width,
      height: this.options.height,
      layout: {
        backgroundColor: '#1e1e1e',
        textColor: '#d1d4dc',
      },
      grid: {
        vertLines: {
          color: '#2B2B43',
        },
        horzLines: {
          color: '#2B2B43',
        },
      },
      crosshair: {
        mode: LightweightCharts.CrosshairMode.Normal,
      },
      rightPriceScale: {
        borderColor: '#485c7b',
      },
      timeScale: {
        borderColor: '#485c7b',
        timeVisible: true,
        secondsVisible: false,
      },
    });

    // Create candlestick series
    this.candlestickSeries = this.chart.addCandlestickSeries({
      upColor: '#26a69a',
      downColor: '#ef5350',
      borderDownColor: '#ef5350',
      borderUpColor: '#26a69a',
      wickDownColor: '#ef5350',
      wickUpColor: '#26a69a',
    });

    // Create volume series
    this.volumeSeries = this.chart.addHistogramSeries({
      color: '#26a69a',
      priceFormat: {
        type: 'volume',
      },
      priceScaleId: 'volume',
    });

    // Create VWAP series
    this.vwapSeries = this.chart.addLineSeries({
      color: '#ff9800',
      lineWidth: 2,
      title: 'VWAP',
    });

    // Create EMA series
    this.ema9Series = this.chart.addLineSeries({
      color: '#2196f3',
      lineWidth: 1,
      title: 'EMA 9',
    });

    this.ema20Series = this.chart.addLineSeries({
      color: '#9c27b0',
      lineWidth: 1,
      title: 'EMA 20',
    });

    // Create HOD/LOD lines
    this.hodLine = this.chart.addLineSeries({
      color: '#4caf50',
      lineWidth: 1,
      lineStyle: LightweightCharts.LineStyle.Dashed,
      title: 'HOD',
    });

    this.lodLine = this.chart.addLineSeries({
      color: '#f44336',
      lineWidth: 1,
      lineStyle: LightweightCharts.LineStyle.Dashed,
      title: 'LOD',
    });

    // Set up volume price scale
    this.chart.priceScale('volume').applyOptions({
      scaleMargins: {
        top: 0.8,
        bottom: 0,
      },
    });
  }

  subscribeToQuotes() {
    if (!this.options.symbol) return;
    
    // Subscribe to WebSocket updates
    appState.subscribeToSymbol(this.options.symbol, (tick) => {
      this.appendTick(tick);
    });
    
    // Load initial data
    this.loadInitialData();
  }

  loadInitialData() {
    if (!this.options.symbol) return;
    
    const ticks = appState.getTicks(this.options.symbol);
    if (ticks && ticks.length > 0) {
      this.ringBuffer = [...ticks];
      this.updateChart();
    }
  }

  appendTick(tick) {
    if (!tick || !this.options.symbol) return;
    
    this.ringBuffer.push(tick);
    
    // Maintain ring buffer size
    if (this.ringBuffer.length > this.maxBufferSize) {
      this.ringBuffer.shift();
    }
    
    this.updateChart();
  }

  updateChart() {
    if (!this.chart || this.ringBuffer.length < 2) return;
    
    // Convert ticks to candlestick data
    const candlestickData = this.convertTicksToCandles();
    const volumeData = this.convertTicksToVolume();
    
    // Update series
    this.candlestickSeries.setData(candlestickData);
    this.volumeSeries.setData(volumeData);
    
    // Calculate and update overlays
    this.updateOverlays();
    
    // Fit content
    this.chart.timeScale().fitContent();
  }

  convertTicksToCandles() {
    if (this.ringBuffer.length < 2) return [];
    
    // Group ticks by minute
    const minuteGroups = new Map();
    
    this.ringBuffer.forEach(tick => {
      const minute = Math.floor(tick.timestamp / 60000) * 60000;
      if (!minuteGroups.has(minute)) {
        minuteGroups.set(minute, []);
      }
      minuteGroups.get(minute).push(tick);
    });
    
    // Convert to candlestick format
    const candles = [];
    minuteGroups.forEach((ticks, minute) => {
      const prices = ticks.map(t => t.price);
      const volumes = ticks.map(t => t.volume || 0);
      
      candles.push({
        time: minute / 1000, // Convert to seconds
        open: prices[0],
        high: Math.max(...prices),
        low: Math.min(...prices),
        close: prices[prices.length - 1],
        volume: volumes.reduce((sum, vol) => sum + vol, 0)
      });
    });
    
    return candles.sort((a, b) => a.time - b.time);
  }

  convertTicksToVolume() {
    if (this.ringBuffer.length < 2) return [];
    
    const minuteGroups = new Map();
    
    this.ringBuffer.forEach(tick => {
      const minute = Math.floor(tick.timestamp / 60000) * 60000;
      if (!minuteGroups.has(minute)) {
        minuteGroups.set(minute, []);
      }
      minuteGroups.get(minute).push(tick);
    });
    
    const volumeData = [];
    minuteGroups.forEach((ticks, minute) => {
      const volumes = ticks.map(t => t.volume || 0);
      const totalVolume = volumes.reduce((sum, vol) => sum + vol, 0);
      
      volumeData.push({
        time: minute / 1000,
        value: totalVolume,
        color: ticks[ticks.length - 1].price >= ticks[0].price ? '#26a69a' : '#ef5350'
      });
    });
    
    return volumeData.sort((a, b) => a.time - b.time);
  }

  updateOverlays() {
    if (this.ringBuffer.length < 20) return;
    
    // Calculate VWAP
    const vwapData = this.calculateVWAP();
    this.vwapSeries.setData(vwapData);
    
    // Calculate EMAs
    const ema9Data = this.calculateEMA(9);
    const ema20Data = this.calculateEMA(20);
    this.ema9Series.setData(ema9Data);
    this.ema20Series.setData(ema20Data);
    
    // Calculate HOD/LOD
    const hodLodData = this.calculateHODLOD();
    this.hodLine.setData(hodLodData.hod);
    this.lodLine.setData(hodLodData.lod);
  }

  calculateVWAP() {
    const candles = this.convertTicksToCandles();
    if (candles.length < 2) return [];
    
    let cumulativeVolume = 0;
    let cumulativeVolumePrice = 0;
    
    return candles.map(candle => {
      const typicalPrice = (candle.high + candle.low + candle.close) / 3;
      const volumePrice = typicalPrice * candle.volume;
      
      cumulativeVolume += candle.volume;
      cumulativeVolumePrice += volumePrice;
      
      const vwap = cumulativeVolume > 0 ? cumulativeVolumePrice / cumulativeVolume : typicalPrice;
      
      return {
        time: candle.time,
        value: vwap
      };
    });
  }

  calculateEMA(period) {
    const candles = this.convertTicksToCandles();
    if (candles.length < period) return [];
    
    const multiplier = 2 / (period + 1);
    let ema = candles[0].close;
    
    return candles.map((candle, index) => {
      if (index === 0) {
        return { time: candle.time, value: ema };
      }
      
      ema = (candle.close * multiplier) + (ema * (1 - multiplier));
      
      return {
        time: candle.time,
        value: ema
      };
    });
  }

  calculateHODLOD() {
    const candles = this.convertTicksToCandles();
    if (candles.length < 2) return { hod: [], lod: [] };
    
    let hod = candles[0].high;
    let lod = candles[0].low;
    
    const hodData = [];
    const lodData = [];
    
    candles.forEach(candle => {
      if (candle.high > hod) {
        hod = candle.high;
        hodData.push({ time: candle.time, value: hod });
      }
      
      if (candle.low < lod) {
        lod = candle.low;
        lodData.push({ time: candle.time, value: lod });
      }
    });
    
    return { hod: hodData, lod: lodData };
  }

  // Switch symbol
  switchSymbol(symbol) {
    if (this.lastSymbol) {
      appState.unsubscribeFromSymbol(this.lastSymbol);
    }
    
    this.options.symbol = symbol;
    this.lastSymbol = symbol;
    this.ringBuffer = [];
    
    this.subscribeToQuotes();
  }

  // Resize chart
  resize(width, height) {
    if (this.chart) {
      this.chart.applyOptions({ width, height });
    }
  }

  // Destroy chart
  destroy() {
    if (this.lastSymbol) {
      appState.unsubscribeFromSymbol(this.lastSymbol);
    }
    
    if (this.chart) {
      this.chart.remove();
    }
  }
}

export default Chart;
