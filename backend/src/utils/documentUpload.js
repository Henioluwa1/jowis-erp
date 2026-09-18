import multer from 'multer';
import path from 'path';
import fs from 'fs';
import crypto from 'crypto';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Protected storage directory outside public static routes
export const documentStorageDir = path.resolve(__dirname, '../../storage/documents');
export const certificateStorageDir = path.resolve(__dirname, '../../storage/certificates');

if (!fs.existsSync(documentStorageDir)) {
  fs.mkdirSync(documentStorageDir, { recursive: true });
}
if (!fs.existsSync(certificateStorageDir)) {
  fs.mkdirSync(certificateStorageDir, { recursive: true });
}

// Strictly blocked executable & script extensions
const BLOCKED_EXTENSIONS = new Set([
  '.exe', '.bat', '.cmd', '.sh', '.php', '.phtml', '.php3', '.php4', '.php5',
  '.pl', '.cgi', '.py', '.rb', '.vbs', '.js', '.jar', '.dll', '.com', '.scr',
  '.msi', '.jsp', '.asp', '.aspx', '.bash', '.ps1', '.elf', '.bin'
]);

// Permitted extensions for institutional documents
const ALLOWED_EXTENSIONS = new Set([
  '.pdf', '.jpg', '.jpeg', '.png', '.webp', '.doc', '.docx', '.odt', '.txt', '.zip'
]);

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, documentStorageDir);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    const cleanBase = path.basename(file.originalname, ext).replace(/[^a-zA-Z0-9_-]/g, '_');
    const randomHex = crypto.randomBytes(6).toString('hex');
    const safeFilename = `doc_${Date.now()}_${randomHex}_${cleanBase}${ext}`;
    cb(null, safeFilename);
  }
});

const fileFilter = (req, file, cb) => {
  // Path traversal check
  if (file.originalname.includes('..') || file.originalname.includes('\0') || file.originalname.includes('/') || file.originalname.includes('\\')) {
    return cb(new Error('Security Alert: Malformed or path-traversal detected in filename.'));
  }

  const ext = path.extname(file.originalname).toLowerCase();

  // 1. Blacklist check
  if (BLOCKED_EXTENSIONS.has(ext)) {
    return cb(new Error(`Security Alert: Executable file extension '${ext}' is strictly forbidden.`));
  }

  // 2. Whitelist check
  if (!ALLOWED_EXTENSIONS.has(ext)) {
    return cb(new Error(`Security Alert: Unsupported file extension '${ext}'. Allowed types: pdf, jpg, png, doc, docx, zip.`));
  }

  // 3. MIME validation
  const mime = file.mimetype.toLowerCase();
  if (
    mime.includes('javascript') ||
    mime.includes('php') ||
    mime.includes('executable') ||
    mime.includes('x-msdownload') ||
    mime.includes('x-sh')
  ) {
    return cb(new Error(`Security Alert: Dangerous MIME type '${file.mimetype}' rejected.`));
  }

  cb(null, true);
};

export const documentUpload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 20 * 1024 * 1024 // 20MB limit
  }
});

export const uploadMiddleware = documentUpload;
