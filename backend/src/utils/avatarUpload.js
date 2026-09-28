import multer from 'multer';
import path from 'path';
import fs from 'fs';
import crypto from 'crypto';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Storage directory for avatars served under public /uploads/avatars
export const avatarStorageDir = path.resolve(__dirname, '../../uploads/avatars');

if (!fs.existsSync(avatarStorageDir)) {
  fs.mkdirSync(avatarStorageDir, { recursive: true });
}

// Permitted image extensions
const ALLOWED_IMAGE_EXTENSIONS = new Set(['.jpg', '.jpeg', '.png', '.webp', '.gif']);
const ALLOWED_MIME_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif']);

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, avatarStorageDir);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    const userId = req.user ? req.user.id : 'user';
    const randomHex = crypto.randomBytes(4).toString('hex');
    const safeFilename = `avatar_${userId}_${Date.now()}_${randomHex}${ext}`;
    cb(null, safeFilename);
  }
});

const fileFilter = (req, file, cb) => {
  const ext = path.extname(file.originalname).toLowerCase();
  if (!ALLOWED_IMAGE_EXTENSIONS.has(ext)) {
    return cb(new Error('Invalid image type. Only JPG, PNG, WEBP, and GIF files are allowed.'));
  }

  const mime = file.mimetype.toLowerCase();
  if (!ALLOWED_MIME_TYPES.has(mime)) {
    return cb(new Error('Invalid MIME type. Uploaded file must be a valid image.'));
  }

  cb(null, true);
};

export const avatarUpload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 5 * 1024 * 1024 // 5MB limit
  }
});
