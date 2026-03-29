import { Request, Response } from 'express';
import { processPendingOrders } from '../jobs/tradingEngine';
import { runPortfolioValuationJobOnce } from '../jobs/portfolioValuation';

export async function processOrdersJob(_req: Request, res: Response): Promise<void> {
  try {
    const result = await processPendingOrders();

    res.status(200).json({
      message: 'Trading engine completed.',
      result,
    });
  } catch (error) {
    console.error('[jobs] process-orders failed:', error);
    res.status(500).json({
      error: 'JOB_PROCESS_ORDERS_FAILED',
      message: 'Unable to process pending orders.',
    });
  }
}

export async function dailyValuationJob(_req: Request, res: Response): Promise<void> {
  try {
    const result = await runPortfolioValuationJobOnce();

    res.status(200).json({
      message: 'Daily valuation completed.',
      result,
    });
  } catch (error) {
    console.error('[jobs] daily-valuation failed:', error);
    res.status(500).json({
      error: 'JOB_DAILY_VALUATION_FAILED',
      message: 'Unable to compute daily valuation.',
    });
  }
}
