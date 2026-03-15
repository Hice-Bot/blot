const config = require('../lib/config');

const CSS_COLOR_RE = /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/;

function sanitizeColor(value) {
  if (!value || typeof value !== 'string') return null;
  value = value.trim();
  if (CSS_COLOR_RE.test(value)) return value;
  return null;
}

function sanitizeFont(value) {
  if (!value || typeof value !== 'string') return null;
  value = value.trim();
  if (config.ALLOWED_FONTS.includes(value)) return value;
  return null;
}

const ALLOWED_HEADER_STYLES = ['default', 'minimal', 'banner', 'centered'];

function sanitizeHeaderStyle(value) {
  if (!value || typeof value !== 'string') return null;
  value = value.trim().toLowerCase();
  if (ALLOWED_HEADER_STYLES.includes(value)) return value;
  return null;
}

function sanitizeHtml(text) {
  if (!text || typeof text !== 'string') return '';
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function sanitizeTags(tags) {
  if (!tags) return '[]';
  if (typeof tags === 'string') {
    try { tags = JSON.parse(tags); } catch { return '[]'; }
  }
  if (!Array.isArray(tags)) return '[]';
  const clean = tags
    .filter(t => typeof t === 'string')
    .map(t => t.trim().toLowerCase().replace(/[^a-z0-9-_ ]/g, '').slice(0, 50))
    .filter(t => t.length > 0)
    .slice(0, 20);
  return JSON.stringify(clean);
}

module.exports = {
  sanitizeColor, sanitizeFont, sanitizeHeaderStyle,
  sanitizeHtml, sanitizeTags, ALLOWED_HEADER_STYLES
};
