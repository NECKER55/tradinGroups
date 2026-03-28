import multer from 'multer';

const PROFILE_PHOTO_MAX_BYTES = 2 * 1024 * 1024;
const ALLOWED_MIME_TYPES = new Set(['image/jpeg', 'image/png']);

export const uploadProfilePhoto = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: PROFILE_PHOTO_MAX_BYTES,
    files: 1,
  },
  fileFilter: (_req, file, callback) => {
    if (!ALLOWED_MIME_TYPES.has(file.mimetype)) {
      callback(new Error('INVALID_PROFILE_PHOTO_TYPE'));
      return;
    }
    callback(null, true);
  },
});
