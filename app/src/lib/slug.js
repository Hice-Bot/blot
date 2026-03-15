const RESERVED_SLUGS = new Set([
  'admin', 'api', 'blog', 'feed', 'login', 'logout',
  'register', 'settings', 'static', 'uploads', 'health'
]);

function generateSlug(name) {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 64);
}

function validateSlug(slug) {
  if (!slug || typeof slug !== 'string') return false;
  if (slug.length < 2 || slug.length > 64) return false;
  if (!/^[a-z0-9][a-z0-9-]*[a-z0-9]$/.test(slug) && !/^[a-z0-9]{2,}$/.test(slug)) return false;
  if (RESERVED_SLUGS.has(slug)) return false;
  return true;
}

module.exports = { generateSlug, validateSlug, RESERVED_SLUGS };
