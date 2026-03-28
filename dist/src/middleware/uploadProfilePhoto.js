"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.uploadProfilePhoto = void 0;
const multer_1 = __importDefault(require("multer"));
const PROFILE_PHOTO_MAX_BYTES = 2 * 1024 * 1024;
const ALLOWED_MIME_TYPES = new Set(['image/jpeg', 'image/png']);
exports.uploadProfilePhoto = (0, multer_1.default)({
    storage: multer_1.default.memoryStorage(),
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
