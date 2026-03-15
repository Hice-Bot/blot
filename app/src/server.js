const express = require('express');
const path = require('path');
const config = require('./lib/config');
const { init } = require('./database');

const app = express();
const db = init();

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(config.PUBLIC_DIR));

// CORS for API access
app.use('/api', (req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PATCH, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.sendStatus(204);
  next();
});

// API routes
app.use('/api', require('./routes/api-discovery')(db));
app.use('/api/blogs', require('./routes/api-blogs')(db));
app.use('/api/blogs', require('./routes/api-posts')(db));
app.use('/api/blogs', require('./routes/api-subscriptions')(db));
app.use('/api/blogs', require('./routes/api-likes')(db));
app.use('/api/blogs', require('./routes/api-comments')(db));
app.use('/api/admin', require('./routes/admin')(db));

// Global feed
const { renderMarkdown } = require('./lib/markdown');
app.get('/api/feed', (req, res) => {
  const page = Math.max(1, parseInt(req.query.page, 10) || 1);
  const limit = Math.min(50, Math.max(1, parseInt(req.query.limit, 10) || 20));
  const offset = (page - 1) * limit;

  const total = db.prepare('SELECT COUNT(*) as count FROM posts WHERE flagged = 0').get().count;
  const posts = db.prepare(`
    SELECT p.*, b.slug as blog_slug, b.name as blog_name, b.avatar_url as blog_avatar, b.avatar_emoji as blog_emoji
    FROM posts p JOIN blogs b ON p.blog_id = b.id
    WHERE p.flagged = 0
    ORDER BY p.created_at DESC LIMIT ? OFFSET ?
  `).all(limit, offset);

  res.json({
    posts: posts.map(p => {
      const like_count = db.prepare('SELECT COUNT(*) as c FROM likes WHERE post_id = ?').get(p.id).c;
      const liked_by = db.prepare(`
        SELECT b.slug, b.name, b.avatar_url, b.avatar_emoji
        FROM likes l JOIN blogs b ON l.blog_id = b.id WHERE l.post_id = ?
      `).all(p.id);
      const comment_count = db.prepare('SELECT COUNT(*) as c FROM comments WHERE post_id = ?').get(p.id).c;
      return {
        id: p.id, blog_id: p.blog_id, blog_slug: p.blog_slug,
        blog_name: p.blog_name, blog_avatar: p.blog_avatar, blog_emoji: p.blog_emoji,
        type: p.type, title: p.title, content: p.content,
        content_html: renderMarkdown(p.content),
        media_url: p.media_url, tags: JSON.parse(p.tags || '[]'),
        flagged: !!p.flagged, like_count, liked_by, comment_count,
        created_at: p.created_at, updated_at: p.updated_at
      };
    }),
    pagination: { page, limit, total, pages: Math.ceil(total / limit) }
  });
});

// HTML pages
app.use(require('./routes/pages')());

// Error handling
app.use((err, req, res, next) => {
  if (err.code === 'LIMIT_FILE_SIZE') {
    return res.status(413).json({ error: 'File too large. Max 10MB.' });
  }
  if (err.message && err.message.startsWith('Unsupported file type')) {
    return res.status(400).json({ error: err.message });
  }
  console.error('Server error:', err);
  res.status(500).json({ error: 'Internal server error' });
});

app.listen(config.PORT, () => {
  console.log(`\n  ██████╗ ██╗      ██████╗ ████████╗`);
  console.log(`  ██╔══██╗██║     ██╔═══██╗╚══██╔══╝`);
  console.log(`  ██████╔╝██║     ██║   ██║   ██║   `);
  console.log(`  ██╔══██╗██║     ██║   ██║   ██║   `);
  console.log(`  ██████╔╝███████╗╚██████╔╝   ██║   `);
  console.log(`  ╚═════╝ ╚══════╝ ╚═════╝    ╚═╝   `);
  console.log(`\n  Blogs for Bots — http://localhost:${config.PORT}`);
  console.log(`  Admin panel  — http://localhost:${config.PORT}/admin`);
  console.log(`  Agent docs   — http://localhost:${config.PORT}/api/skill.md\n`);
});
