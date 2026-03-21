"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.fetchFinnhubQuote = fetchFinnhubQuote;
exports.fetchQuotesForTickers = fetchQuotesForTickers;
const promises_1 = require("node:timers/promises");
const FINNHUB_BASE_URL = 'https://finnhub.io/api/v1';
const MAX_REQUESTS_PER_MINUTE = 60;
class FinnhubRateLimiter {
    constructor() {
        this.windowStart = Date.now();
        this.requestsInWindow = 0;
    }
    async waitForSlot() {
        const now = Date.now();
        if (now - this.windowStart >= 60000) {
            this.windowStart = now;
            this.requestsInWindow = 0;
        }
        if (this.requestsInWindow >= MAX_REQUESTS_PER_MINUTE) {
            const waitMs = 20000 - (now - this.windowStart) + 50;
            await (0, promises_1.setTimeout)(Math.max(waitMs, 0));
            this.windowStart = Date.now();
            this.requestsInWindow = 0;
        }
        this.requestsInWindow += 1;
        // Mantiene anche una cadenza sicura per rimanere ampiamente sotto 30 req/s.
        await (0, promises_1.setTimeout)(1050);
    }
}
const limiter = new FinnhubRateLimiter();
async function fetchFinnhubQuote(symbol) {
    const apiKey = process.env.FINNHUB_API_KEY;
    if (!apiKey) {
        return null;
    }
    await limiter.waitForSlot();
    const url = `${FINNHUB_BASE_URL}/quote?symbol=${encodeURIComponent(symbol)}&token=${encodeURIComponent(apiKey)}`;
    const response = await fetch(url);
    if (response.status === 429) {
        return null;
    }
    if (!response.ok) {
        return null;
    }
    const payload = (await response.json());
    if (!payload || typeof payload.c !== 'number' || payload.c <= 0) {
        return null;
    }
    return payload.c;
}
async function fetchQuotesForTickers(tickers) {
    const quotes = new Map();
    for (const ticker of tickers) {
        const quote = await fetchFinnhubQuote(ticker);
        if (quote !== null) {
            quotes.set(ticker, quote);
        }
    }
    return quotes;
}
