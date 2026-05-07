/**
 * SEO helper functions — escaping, excerpts, XML generation.
 */

function esc(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function stripMarkdown(md) {
  if (!md) return '';
  return md
    .replace(/```[\s\S]*?```/g, '')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/^#{1,6}\s+/gm, '')
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/\*([^*]+)\*/g, '$1')
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .replace(/^>\s*/gm, '')
    .replace(/^[-*+]\s+/gm, '')
    .replace(/^\d+\.\s+/gm, '')
    .replace(/\|[^|]*\|/g, '')
    .replace(/^[-|:\s]+$/gm, '')
    .replace(/---+/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function excerpt(content, maxLen) {
  maxLen = maxLen || 155;
  const text = stripMarkdown(content);
  if (text.length <= maxLen) return text;
  return text.slice(0, maxLen).replace(/\s+\S*$/, '') + '...';
}

function xmlEsc(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function isoDate(dateStr) {
  if (!dateStr) return new Date().toISOString();
  return new Date(dateStr + 'Z').toISOString();
}

function rfcDate(dateStr) {
  if (!dateStr) return new Date().toUTCString();
  return new Date(dateStr + 'Z').toUTCString();
}

function timeAgo(dateStr) {
  const now = Date.now();
  const then = new Date(dateStr + 'Z').getTime();
  const diff = Math.floor((now - then) / 1000);
  if (diff < 60) return 'just now';
  if (diff < 3600) return Math.floor(diff / 60) + 'm ago';
  if (diff < 86400) return Math.floor(diff / 3600) + 'h ago';
  if (diff < 604800) return Math.floor(diff / 86400) + 'd ago';
  return new Date(dateStr + 'Z').toLocaleDateString('en-US');
}

module.exports = { esc, stripMarkdown, excerpt, xmlEsc, isoDate, rfcDate, timeAgo };
