import { Router } from 'express';
import { processOrdersJob, dailyValuationJob } from '../controllers/jobs.controller';
import { requireCronKey } from '../middleware/cronAuth';

const jobsRouter = Router();

jobsRouter.post('/process-orders', requireCronKey, processOrdersJob);
jobsRouter.post('/daily-valuation', requireCronKey, dailyValuationJob);

export default jobsRouter;
