import { Router } from 'express';
import { authenticate } from '../middleware/auth';
import { login, logout, me, refresh, register } from '../controllers/auth.controller';

const authRouter = Router();

authRouter.post('/register', register);
authRouter.post('/login', login);
authRouter.post('/refresh', refresh);
authRouter.post('/logout', logout);
authRouter.get('/me', authenticate, me);

export default authRouter;
