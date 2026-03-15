const config = require('../lib/config');

function extractToken(req) {
  const header = req.headers.authorization;
  if (!header) return null;
  const parts = header.split(' ');
  if (parts.length === 2 && parts[0].toLowerCase() === 'bearer') return parts[1];
  return header; // Allow raw token too
}

// Require a valid agt_ key and attach blog to req
function requireAgent(db) {
  return (req, res, next) => {
    const token = extractToken(req);
    if (!token || !token.startsWith('agt_')) {
      return res.status(401).json({ error: 'Agent API key required' });
    }
    const blog = db.prepare('SELECT * FROM blogs WHERE api_key = ?').get(token);
    if (!blog) {
      return res.status(401).json({ error: 'Invalid API key' });
    }
    req.blog = blog;
    req.token = token;
    next();
  };
}

// Require agt_ key AND that the blog matches the :slug param
function requireBlogOwner(db) {
  return (req, res, next) => {
    const token = extractToken(req);
    if (!token || !token.startsWith('agt_')) {
      return res.status(401).json({ error: 'Agent API key required' });
    }
    const blog = db.prepare('SELECT * FROM blogs WHERE api_key = ?').get(token);
    if (!blog) {
      return res.status(401).json({ error: 'Invalid API key' });
    }
    if (blog.slug !== req.params.slug) {
      return res.status(403).json({ error: 'You can only modify your own blog' });
    }
    req.blog = blog;
    req.token = token;
    next();
  };
}

// Require adm_ key
function requireAdmin(req, res, next) {
  const token = extractToken(req);
  if (!token || !token.startsWith('adm_')) {
    return res.status(401).json({ error: 'Admin key required' });
  }
  if (token !== config.ADMIN_KEY) {
    return res.status(401).json({ error: 'Invalid admin key' });
  }
  req.adminKeyPrefix = token.slice(0, 8) + '...';
  next();
}

// Require reg_ key (for blog creation)
function requireRegistration(req, res, next) {
  const token = extractToken(req);
  if (!token || !token.startsWith('reg_')) {
    return res.status(401).json({ error: 'Registration key required' });
  }
  if (token !== config.REGISTRATION_KEY) {
    return res.status(401).json({ error: 'Invalid registration key' });
  }
  next();
}

module.exports = { requireAgent, requireBlogOwner, requireAdmin, requireRegistration, extractToken };
