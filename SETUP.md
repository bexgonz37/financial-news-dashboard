# 🚀 Financial News Dashboard Setup Guide

## What This App Does

This is a **comprehensive day trading dashboard** that provides:

- **📰 Real-time Financial News** - Live financial news with smart company matching
- **🔍 Advanced Stock Scanner** - Find high-momentum stocks with custom filters  
- **⭐ Watchlist Management** - Track your favorite stocks
- **📊 Live Charts** - Interactive candlestick charts with technical indicators
- **🎯 Smart Company Matching** - Automatically identifies companies in news

## Quick Start

### 1. Get API Keys (Required)

**Alpha Vantage API Key (Required):**
1. Go to https://www.alphavantage.co/support/#api-key
2. Sign up for a free account
3. Copy your API key

**Optional APIs (for enhanced features):**
- **Financial Modeling Prep**: https://financialmodelingprep.com/developer/docs
- **IEX Cloud**: https://iexcloud.io/

### 2. Set Environment Variables

Create a `.env` file in the project root with:

```env
# Required
ALPHAVANTAGE_KEY=your_actual_api_key_here

# Optional (for enhanced features)
FMP_KEY=your_fmp_key_here
IEXCLOUD_KEY=your_iexcloud_key_here
```

### 3. Run the App

```bash
# Install dependencies (already done)
npm install

# Start development server
npm start

# Or deploy to Vercel
npm run deploy
```

## Features Breakdown

### 📰 News Tab
- **Real-time financial news** from Alpha Vantage
- **Smart filtering** by ticker, keywords, and categories
- **Company matching** - automatically identifies stocks mentioned
- **Live quotes** - shows percentage changes and volume
- **Mini charts** - sparkline charts for each stock

### 🔍 Scanner Tab  
- **High momentum stocks** - finds biggest movers
- **Volume analysis** - high relative volume stocks
- **Sentiment scanning** - stocks with positive news sentiment
- **Custom filters** - price, volume, mentions, RVOL thresholds
- **Real-time scoring** - advanced algorithm for day trading

### ⭐ Watchlist Tab
- **Add/remove stocks** manually or from news
- **Live tracking** - real-time quotes and charts
- **Quick access** - star stocks from news or scanner

### 📊 Charts
- **Interactive candlestick charts** using LightweightCharts
- **Technical indicators** - VWAP, SMA, EMA, RSI
- **Volume analysis** - volume bars and patterns
- **Multiple timeframes** - 5min, 1hr, daily data

## API Endpoints

- `/api/data` - Fetch financial news
- `/api/fallback` - Yahoo Finance quotes and charts  
- `/api/ohlc` - OHLC data for charts
- `/api/company-database-dynamic` - Company search
- `/api/company-matcher` - Smart company matching

## Troubleshooting

### Common Issues:

1. **"API key not configured"** - Set your ALPHAVANTAGE_KEY in .env
2. **"No data found"** - Check API key and try different tickers
3. **Charts not loading** - Ensure ticker symbols are valid
4. **Rate limits** - Alpha Vantage has 5 calls/minute on free tier

### Getting Help:

- Check browser console for errors
- Verify API keys are correct
- Try popular tickers like AAPL, TSLA, NVDA first
- Free Alpha Vantage tier has rate limits

## Next Steps

1. Get your Alpha Vantage API key
2. Add it to a `.env` file
3. Run `npm start` to test locally
4. Deploy to Vercel for production use

Happy trading! 🚀
