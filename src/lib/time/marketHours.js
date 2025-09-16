// Market hours and session utilities
class MarketHours {
  constructor() {
    // Market hours (ET)
    this.regularHours = {
      open: { hour: 9, minute: 30 },
      close: { hour: 16, minute: 0 }
    };
    
    this.preMarketHours = {
      open: { hour: 4, minute: 0 },
      close: { hour: 9, minute: 30 }
    };
    
    this.afterHoursHours = {
      open: { hour: 16, minute: 0 },
      close: { hour: 20, minute: 0 }
    };
    
    // Major holidays (simplified)
    this.holidays = [
      '2024-01-01', // New Year's Day
      '2024-01-15', // MLK Day
      '2024-02-19', // Presidents Day
      '2024-03-29', // Good Friday
      '2024-05-27', // Memorial Day
      '2024-06-19', // Juneteenth
      '2024-07-04', // Independence Day
      '2024-09-02', // Labor Day
      '2024-11-28', // Thanksgiving
      '2024-12-25', // Christmas
      '2025-01-01', // New Year's Day
      '2025-01-20', // MLK Day
      '2025-02-17', // Presidents Day
      '2025-04-18', // Good Friday
      '2025-05-26', // Memorial Day
      '2025-06-19', // Juneteenth
      '2025-07-04', // Independence Day
      '2025-09-01', // Labor Day
      '2025-11-27', // Thanksgiving
      '2025-12-25'  // Christmas
    ];
  }

  // Get current ET time
  getCurrentET() {
    const now = new Date();
    const et = new Date(now.toLocaleString("en-US", {timeZone: "America/New_York"}));
    return et;
  }

  // Check if date is a holiday
  isHoliday(date = null) {
    const checkDate = date || this.getCurrentET();
    const dateStr = checkDate.toISOString().split('T')[0];
    return this.holidays.includes(dateStr);
  }

  // Check if it's a weekday
  isWeekday(date = null) {
    const checkDate = date || this.getCurrentET();
    const day = checkDate.getDay();
    return day >= 1 && day <= 5; // Monday = 1, Friday = 5
  }

  // Check if market is open
  isMarketOpen() {
    const now = this.getCurrentET();
    
    // Check if it's a weekday and not a holiday
    if (!this.isWeekday(now) || this.isHoliday(now)) {
      return false;
    }
    
    const currentTime = {
      hour: now.getHours(),
      minute: now.getMinutes()
    };
    
    return this.isTimeInRange(currentTime, this.regularHours);
  }

  // Check if it's pre-market
  isPreMarket() {
    const now = this.getCurrentET();
    
    if (!this.isWeekday(now) || this.isHoliday(now)) {
      return false;
    }
    
    const currentTime = {
      hour: now.getHours(),
      minute: now.getMinutes()
    };
    
    return this.isTimeInRange(currentTime, this.preMarketHours);
  }

  // Check if it's after-hours
  isAfterHours() {
    const now = this.getCurrentET();
    
    if (!this.isWeekday(now) || this.isHoliday(now)) {
      return false;
    }
    
    const currentTime = {
      hour: now.getHours(),
      minute: now.getMinutes()
    };
    
    return this.isTimeInRange(currentTime, this.afterHoursHours);
  }

  // Check if it's market hours (regular + pre-market + after-hours)
  isMarketHours() {
    return this.isMarketOpen() || this.isPreMarket() || this.isAfterHours();
  }

  // Check if time is in range
  isTimeInRange(currentTime, range) {
    const currentMinutes = currentTime.hour * 60 + currentTime.minute;
    const openMinutes = range.open.hour * 60 + range.open.minute;
    const closeMinutes = range.close.hour * 60 + range.close.minute;
    
    return currentMinutes >= openMinutes && currentMinutes < closeMinutes;
  }

  // Get market status
  getMarketStatus() {
    if (this.isMarketOpen()) {
      return 'market';
    } else if (this.isPreMarket()) {
      return 'pre-market';
    } else if (this.isAfterHours()) {
      return 'after-hours';
    } else {
      return 'closed';
    }
  }

  // Get next market open time
  getNextMarketOpen() {
    const now = this.getCurrentET();
    let nextOpen = new Date(now);
    
    // Set to next weekday at 9:30 AM ET
    nextOpen.setHours(9, 30, 0, 0);
    
    // If it's already past 9:30 AM today, move to next day
    if (now.getHours() > 9 || (now.getHours() === 9 && now.getMinutes() >= 30)) {
      nextOpen.setDate(nextOpen.getDate() + 1);
    }
    
    // Skip weekends and holidays
    while (!this.isWeekday(nextOpen) || this.isHoliday(nextOpen)) {
      nextOpen.setDate(nextOpen.getDate() + 1);
    }
    
    return nextOpen;
  }

  // Get next market close time
  getNextMarketClose() {
    const now = this.getCurrentET();
    let nextClose = new Date(now);
    
    // Set to today at 4:00 PM ET
    nextClose.setHours(16, 0, 0, 0);
    
    // If it's already past 4:00 PM today, move to next day
    if (now.getHours() >= 16) {
      nextClose.setDate(nextClose.getDate() + 1);
    }
    
    // Skip weekends and holidays
    while (!this.isWeekday(nextClose) || this.isHoliday(nextClose)) {
      nextClose.setDate(nextClose.getDate() + 1);
    }
    
    return nextClose;
  }

  // Get time until next market open
  getTimeUntilOpen() {
    const now = this.getCurrentET();
    const nextOpen = this.getNextMarketOpen();
    return nextOpen.getTime() - now.getTime();
  }

  // Get time until next market close
  getTimeUntilClose() {
    const now = this.getCurrentET();
    const nextClose = this.getNextMarketClose();
    return nextClose.getTime() - now.getTime();
  }

  // Format time remaining
  formatTimeRemaining(milliseconds) {
    const hours = Math.floor(milliseconds / (1000 * 60 * 60));
    const minutes = Math.floor((milliseconds % (1000 * 60 * 60)) / (1000 * 60));
    
    if (hours > 0) {
      return `${hours}h ${minutes}m`;
    } else {
      return `${minutes}m`;
    }
  }

  // Get session info
  getSessionInfo() {
    const status = this.getMarketStatus();
    const now = this.getCurrentET();
    
    return {
      status,
      isWeekday: this.isWeekday(now),
      isHoliday: this.isHoliday(now),
      currentTime: now.toISOString(),
      nextOpen: this.getNextMarketOpen().toISOString(),
      nextClose: this.getNextMarketClose().toISOString(),
      timeUntilOpen: this.getTimeUntilOpen(),
      timeUntilClose: this.getTimeUntilClose()
    };
  }
}

// Export singleton
export const marketHours = new MarketHours();

// Update market status every minute
setInterval(() => {
  const status = marketHours.getMarketStatus();
  const isMarketOpen = marketHours.isMarketOpen();
  const isAfterHours = marketHours.isAfterHours();
  
  // Update app state
  if (typeof appState !== 'undefined') {
    appState.updateStatus({
      marketOpen: isMarketOpen,
      afterHours: isAfterHours
    });
  }
}, 60000);
