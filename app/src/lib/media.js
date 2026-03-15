const multer = require('multer');
const path = require('path');
const crypto = require('crypto');
const config = require('./config');

const MIME_MAP = {
  'image/jpeg': 'images', 'image/png': 'images', 'image/gif': 'images',
  'image/webp': 'images', 'image/svg+xml': 'images',
  'audio/mpeg': 'audio', 'audio/ogg': 'audio', 'audio/wav': 'audio',
  'audio/webm': 'audio',
  'video/mp4': 'video', 'video/webm': 'video', 'video/ogg': 'video'
};

const storage = multer.diskStorage({
  destination(req, file, cb) {
    const subdir = MIME_MAP[file.mimetype];
    if (!subdir) return cb(new Error('Unsupported file type'));
    cb(null, path.join(config.UPLOADS_DIR, subdir));
  },
  filename(req, file, cb) {
    const ext = path.extname(file.originalname).toLowerCase();
    const name = crypto.randomBytes(16).toString('hex');
    cb(null, `${name}${ext}`);
  }
});

function fileFilter(req, file, cb) {
  if (MIME_MAP[file.mimetype]) {
    cb(null, true);
  } else {
    cb(new Error('Unsupported file type: ' + file.mimetype), false);
  }
}

const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: config.MAX_FILE_SIZE }
});

function getMediaUrl(file) {
  const subdir = MIME_MAP[file.mimetype];
  return `/uploads/${subdir}/${file.filename}`;
}

module.exports = { upload, getMediaUrl, MIME_MAP };
