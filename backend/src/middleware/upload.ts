import multer from 'multer';
import path from 'path';

// 使用内存存储，文件将保存在内存中作为Buffer
// 后续由控制器处理上传到WebDAV
const storage = multer.memoryStorage();

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
  storage,
  fileFilter,
  limits: {
    fileSize: parseInt(process.env.MAX_FILE_SIZE || '524288000'), // 500MB default
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
    fileSize: 10 * 1024 * 1024, // 10MB for images
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
    fileSize: 1 * 1024 * 1024, // 1MB for lyrics
  },
});

export default upload;

