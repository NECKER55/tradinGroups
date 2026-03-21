import { setTimeout as sleep } from 'node:timers/promises';

interface FinnhubQuoteResponse {
  c: number; // current price
  o: number;
  h: number;
  l: number;
  pc: number;
  t: number;
}

const FINNHUB_BASE_URL = 'https://finnhub.io/api/v1';
const MAX_REQUESTS_PER_MINUTE = 60;

class FinnhubRateLimiter {
  private windowStart = Date.now();
  private requestsInWindow = 0;

  async waitForSlot(): Promise<void> {
    const now = Date.now();
    if (now - this.windowStart >= 60_000) {
      this.windowStart = now;
      this.requestsInWindow = 0;
    }

    if (this.requestsInWindow >= MAX_REQUESTS_PER_MINUTE) {
      const waitMs = 20_000 - (now - this.windowStart) + 50;
      await sleep(Math.max(waitMs, 0));
      this.windowStart = Date.now();
      this.requestsInWindow = 0;
    }

    this.requestsInWindow += 1;
    // Mantiene anche una cadenza sicura per rimanere ampiamente sotto 30 req/s.
    await sleep(1050);
  }
}

const limiter = new FinnhubRateLimiter();

export async function fetchFinnhubQuote(symbol: string): Promise<number | null> {
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

  const payload = (await response.json()) as FinnhubQuoteResponse;

  if (!payload || typeof payload.c !== 'number' || payload.c <= 0) {
    return null;
  }

  return payload.c;
}

export async function fetchQuotesForTickers(tickers: string[]): Promise<Map<string, number>> {
  const quotes = new Map<string, number>();

  for (const ticker of tickers) {
    const quote = await fetchFinnhubQuote(ticker);
    if (quote !== null) {
      quotes.set(ticker, quote);
    }
  }

  return quotes;
}
