import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Storage directory for chat media & multimedia documents
export const chatStorageDir = path.resolve(__dirname, '../../uploads/chat');

if (!fs.existsSync(chatStorageDir)) {
  fs.mkdirSync(chatStorageDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, chatStorageDir);
  },
  filename: (req, file, cb) => {
    const userId = req.user?.id || 'anon';
    const timestamp = Date.now();
    const randomHex = Math.random().toString(36).substring(2, 8);
    const sanitizedName = file.originalname.replace(/[^a-zA-Z0-9.-]/g, '_');
    const ext = path.extname(sanitizedName).toLowerCase();
    const baseName = path.basename(sanitizedName, ext).substring(0, 30);
    const safeFilename = `chat_${userId}_${timestamp}_${baseName}_${randomHex}${ext}`;
    cb(null, safeFilename);
  }
});

// File filter supporting multimedia (images, audio, video) and documents (pdf, doc, docx, xls, zip)
const fileFilter = (req, file, cb) => {
  const allowedExtensions = [
    '.jpg', '.jpeg', '.png', '.webp', '.gif', '.svg',
    '.pdf', '.doc', '.docx', '.xls', '.xlsx', '.csv', '.txt', '.zip'
  ];
  const ext = path.extname(file.originalname).toLowerCase();
  
  if (allowedExtensions.includes(ext)) {
    cb(null, true);
  } else {
    cb(new Error(`File type '${ext}' is not supported for chat multimedia transfer.`), false);
  }
};

export const chatUpload = multer({
  storage,
  limits: {
    fileSize: 25 * 1024 * 1024 // 25MB max per chat document
  },
  fileFilter
});
