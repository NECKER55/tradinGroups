import { Router } from 'express';
import { authenticate } from '../middleware/auth';
import {
	changeMyEmail,
	changeMyPassword,
	changeMyPhoto,
	changeMyUsername,
	login,
	logout,
	me,
	refresh,
	register,
} from '../controllers/auth.controller';

const authRouter = Router();

authRouter.post('/register', register);
authRouter.post('/login', login);
authRouter.post('/refresh', refresh);
authRouter.post('/logout', logout);
authRouter.get('/me', authenticate, me);
authRouter.put('/me/password', authenticate, changeMyPassword);
authRouter.put('/me/username', authenticate, changeMyUsername);
authRouter.put('/me/photo', authenticate, changeMyPhoto);
authRouter.put('/me/email', authenticate, changeMyEmail);

export default authRouter;
