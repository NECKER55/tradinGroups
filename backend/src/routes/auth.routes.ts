import { Router } from 'express';
import { authenticate } from '../middleware/auth';
import { uploadProfilePhoto } from '../middleware/uploadProfilePhoto';
import {
	changeMyEmail,
	changeMyPassword,
	changeMyPhoto,
	removeMyPhoto,
	changeMyUsername,
	deleteUserAccount,
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
authRouter.put('/me/photo', authenticate, uploadProfilePhoto.single('photo'), changeMyPhoto);
authRouter.delete('/me/photo', authenticate, removeMyPhoto);
authRouter.put('/me/email', authenticate, changeMyEmail);
authRouter.delete('/users/:id_persona', authenticate, deleteUserAccount);

export default authRouter;
