// Lightweight structured logging
class Logger {
  constructor() {
    this.logs = [];
    this.maxLogs = 1000;
    this.levels = {
      ERROR: 0,
      WARN: 1,
      INFO: 2,
      DEBUG: 3
    };
    this.currentLevel = this.levels.INFO;
  }

  // Set log level
  setLevel(level) {
    this.currentLevel = this.levels[level] || this.levels.INFO;
  }

  // Log message
  log(level, message, data = {}) {
    if (this.levels[level] > this.currentLevel) return;
    
    const logEntry = {
      timestamp: new Date().toISOString(),
      level,
      message,
      data,
      id: this.generateId()
    };
    
    this.logs.push(logEntry);
    
    // Maintain max logs
    if (this.logs.length > this.maxLogs) {
      this.logs.shift();
    }
    
    // Console output
    const consoleMethod = level === 'ERROR' ? 'error' : 
                         level === 'WARN' ? 'warn' : 
                         level === 'DEBUG' ? 'log' : 'info';
    
    console[consoleMethod](`[${level}] ${message}`, data);
  }

  // Log levels
  error(message, data) {
    this.log('ERROR', message, data);
  }

  warn(message, data) {
    this.log('WARN', message, data);
  }

  info(message, data) {
    this.log('INFO', message, data);
  }

  debug(message, data) {
    this.log('DEBUG', message, data);
  }

  // Specific loggers for different components
  fetchStart(component, endpoint) {
    this.info('Fetch started', { component, endpoint });
  }

  fetchEnd(component, endpoint, duration, success) {
    this.info('Fetch completed', { component, endpoint, duration, success });
  }

  wsStatus(status, details) {
    this.info('WebSocket status', { status, details });
  }

  dedupe(action, count) {
    this.debug('Deduplication', { action, count });
  }

  resolverPick(symbol, confidence, reason) {
    this.info('Ticker resolved', { symbol, confidence, reason });
  }

  scannerTick(scanner, count, duration) {
    this.info('Scanner tick', { scanner, count, duration });
  }

  // Generate unique ID
  generateId() {
    return Math.random().toString(36).substr(2, 9);
  }

  // Get logs
  getLogs(level = null, limit = 100) {
    let filtered = this.logs;
    
    if (level) {
      filtered = this.logs.filter(log => log.level === level);
    }
    
    return filtered.slice(-limit);
  }

  // Get logs by component
  getLogsByComponent(component, limit = 100) {
    return this.logs
      .filter(log => log.data.component === component)
      .slice(-limit);
  }

  // Clear logs
  clear() {
    this.logs = [];
  }

  // Export logs
  exportLogs() {
    return {
      logs: this.logs,
      exported: new Date().toISOString(),
      count: this.logs.length
    };
  }
}

// Export singleton
export const logger = new Logger();

// Set log level from environment
if (typeof process !== 'undefined' && process.env.NODE_ENV === 'development') {
  logger.setLevel('DEBUG');
}
