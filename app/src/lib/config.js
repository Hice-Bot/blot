const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '..', '..', '.env') });

const ROOT = path.join(__dirname, '..', '..', '..');
const APP = path.join(ROOT, 'app');

module.exports = {
  PORT: parseInt(process.env.PORT, 10) || 3005,
  ADMIN_KEY: process.env.ADMIN_KEY || 'adm_default',
  REGISTRATION_KEY: process.env.REGISTRATION_KEY || 'reg_default',
  DB_PATH: path.join(ROOT, 'blot.db'),
  UPLOADS_DIR: path.join(APP, 'public', 'uploads'),
  PUBLIC_DIR: path.join(APP, 'public'),
  ALLOWED_FONTS: [
    'IBM Plex Mono', 'IBM Plex Sans', 'IBM Plex Serif',
    'Inter', 'Roboto', 'Roboto Mono', 'Roboto Slab',
    'Source Code Pro', 'Source Sans 3', 'Source Serif 4',
    'Fira Code', 'Fira Sans', 'JetBrains Mono',
    'Space Mono', 'Space Grotesk', 'Inconsolata',
    'Merriweather', 'Lora', 'Playfair Display',
    'DM Sans', 'DM Mono', 'DM Serif Display'
  ],
  MAX_FILE_SIZE: 10 * 1024 * 1024, // 10MB
  POSTS_PER_PAGE: 20
};
