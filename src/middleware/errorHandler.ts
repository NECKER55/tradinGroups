// src/middleware/errorHandler.ts
import { Request, Response, NextFunction } from 'express';
import multer from 'multer';

export function errorHandler(
  err: Error,
  _req: Request,
  res: Response,
  _next: NextFunction
): void {
  console.error('[Error]', err);

  if (res.headersSent) return;

  if (err instanceof multer.MulterError) {
    if (err.code === 'LIMIT_FILE_SIZE') {
      res.status(413).json({
        error: 'PHOTO_TOO_LARGE',
        message: 'Image must be 2MB or smaller.',
      });
      return;
    }

    res.status(400).json({
      error: 'UPLOAD_FAILED',
      message: 'Invalid image upload payload.',
    });
    return;
  }

  if (err.message === 'INVALID_PROFILE_PHOTO_TYPE') {
    res.status(400).json({
      error: 'INVALID_PHOTO_TYPE',
      message: 'Only JPEG and PNG images are allowed.',
    });
    return;
  }

  if (err.message.startsWith('CORS_ORIGIN_NOT_ALLOWED:')) {
    res.status(403).json({
      error: 'CORS_ORIGIN_NOT_ALLOWED',
      message: 'Origin is not allowed by CORS policy.',
    });
    return;
  }

  res.status(500).json({
    error:   'INTERNAL_SERVER_ERROR',
    message: process.env.NODE_ENV === 'development' ? err.message : 'Errore interno del server.',
  });
}