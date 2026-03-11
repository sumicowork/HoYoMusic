import multer from 'multer';
import path from 'path';
import os from 'os';
import { v4 as uuidv4 } from 'uuid';

// FLAC 使用磁盘临时存储，避免大文件（~500MB）占满内存导致 OOM
const UPLOAD_TEMP_DIR = process.env.UPLOAD_TEMP_DIR || os.tmpdir();

const diskStorage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    cb(null, UPLOAD_TEMP_DIR);
  },
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, `hoyomusic_${uuidv4()}${ext}`);
  },
});

// File filter for FLAC only
const fileFilter = (req: any, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
  const allowedMimeTypes = ['audio/flac', 'audio/x-flac'];
  const ext = path.extname(file.originalname).toLowerCase();

  if (allowedMimeTypes.includes(file.mimetype) || ext === '.flac') {
    cb(null, true);
  } else {
    cb(new Error('Only FLAC files are allowed'));
  }
};

const upload = multer({
  storage: diskStorage,
  fileFilter,
  limits: {
    fileSize: 500 * 1024 * 1024, // 500MB max per FLAC file
  },
});

// Cover image upload configuration (也使用内存存储)
const coverStorage = multer.memoryStorage();

// Cover image filter
const imageFilter = (req: any, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
  const allowedMimeTypes = ['image/jpeg', 'image/png', 'image/jpg', 'image/webp'];
  const ext = path.extname(file.originalname).toLowerCase();
  const allowedExts = ['.jpg', '.jpeg', '.png', '.webp'];

  if (allowedMimeTypes.includes(file.mimetype) || allowedExts.includes(ext)) {
    cb(null, true);
  } else {
    cb(new Error('Only image files (JPEG, PNG, WebP) are allowed'));
  }
};

export const coverUpload = multer({
  storage: coverStorage,
  fileFilter: imageFilter,
  limits: {
    fileSize: 20 * 1024 * 1024, // 20MB max per cover image
  },
});

// Lyrics upload configuration (也使用内存存储)
const lyricsStorage = multer.memoryStorage();

const lyricsFilter = (req: any, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
  const ext = path.extname(file.originalname).toLowerCase();
  if (ext === '.lrc') {
    cb(null, true);
  } else {
    cb(new Error('Only LRC files are allowed'));
  }
};

export const lyricsUpload = multer({
  storage: lyricsStorage,
  fileFilter: lyricsFilter,
  limits: {
    fileSize: 1 * 1024 * 1024, // 1MB max per LRC file
  },
});

// JSON import file upload configuration (credits import etc.)
const jsonStorage = multer.memoryStorage();

const jsonFilter = (req: any, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
  const ext = path.extname(file.originalname).toLowerCase();
  if (ext === '.json' || file.mimetype === 'application/json') {
    cb(null, true);
  } else {
    cb(new Error('Only JSON files are allowed'));
  }
};

export const jsonUpload = multer({
  storage: jsonStorage,
  fileFilter: jsonFilter,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB max per JSON file
  },
});

export default upload;

