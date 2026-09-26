import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const uploadDir = path.resolve(__dirname, '../../uploads/submissions');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

// Permitted safe deliverable extensions (Whitelisted)
const ALLOWED_EXTENSIONS = new Set([
  '.pdf', '.zip', '.rar', '.7z', '.tar', '.gz',
  '.doc', '.docx', '.odt', '.xls', '.xlsx', '.ppt', '.pptx',
  '.txt', '.csv', '.json', '.md',
  '.jpg', '.jpeg', '.png', '.webp', '.gif'
]);

// Strictly blocked dangerous executable & script extensions
const BLOCKED_EXTENSIONS = new Set([
  '.exe', '.bat', '.cmd', '.sh', '.php', '.phtml', '.php3', '.php4', '.php5',
  '.pl', '.cgi', '.py', '.rb', '.vbs', '.js', '.jar', '.dll', '.com', '.scr',
  '.msi', '.jsp', '.asp', '.aspx', '.bash', '.ps1', '.elf', '.bin',
  '.html', '.htm', '.xhtml', '.svg', '.xml', '.shtml', '.htaccess'
]);

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    const baseName = path.basename(file.originalname, ext).replace(/[^a-zA-Z0-9_-]/g, '_');
    const safeName = `sub_${Date.now()}_${baseName}${ext}`;
    cb(null, safeName);
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
    return cb(new Error(`Security Alert: Dangerous file type '${ext}' is strictly forbidden.`));
  }

  // 2. Strict Whitelist check
  if (!ALLOWED_EXTENSIONS.has(ext)) {
    return cb(new Error(`Security Alert: Unsupported file extension '${ext}'. Allowed types: pdf, zip, docx, xlsx, images, and text/data files.`));
  }

  // 3. Dangerous MIME type check
  const mime = (file.mimetype || '').toLowerCase();
  if (
    mime.includes('javascript') ||
    mime.includes('php') ||
    mime.includes('html') ||
    mime.includes('svg') ||
    mime.includes('xml') ||
    mime.includes('executable') ||
    mime.includes('x-msdownload') ||
    mime.includes('x-sh')
  ) {
    return cb(new Error(`Security Alert: Dangerous MIME type '${file.mimetype}' rejected.`));
  }

  cb(null, true);
};

export const submissionUpload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 15 * 1024 * 1024 // 15MB limit
  }
});
