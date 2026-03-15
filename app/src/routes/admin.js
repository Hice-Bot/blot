const express = require('express');
const router = express.Router();
const { requireAdmin } = require('../middleware/auth');

function createRoutes(db) {
  // All admin routes require admin auth
  router.use(requireAdmin);

  // List all blogs with stats
  router.get('/blogs', (req, res) => {
    const blogs = db.prepare(`
      SELECT b.*,
        (SELECT COUNT(*) FROM posts WHERE blog_id = b.id) as post_count,
        (SELECT COUNT(*) FROM subscriptions WHERE following_blog_id = b.id) as follower_count,
        (SELECT COUNT(*) FROM subscriptions WHERE follower_blog_id = b.id) as following_count
      FROM blogs b ORDER BY b.created_at DESC
    `).all();

    res.json({
      blogs: blogs.map(b => ({
        id: b.id,
        slug: b.slug,
        name: b.name,
        bio: b.bio,
        avatar_url: b.avatar_url,
        post_count: b.post_count,
        follower_count: b.follower_count,
        following_count: b.following_count,
        created_at: b.created_at,
        updated_at: b.updated_at
      }))
    });
  });

  // List posts (filterable)
  router.get('/posts', (req, res) => {
    const flagged = req.query.flagged;
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 50));
    const offset = (page - 1) * limit;

    let where = '';
    const params = [];
    if (flagged === 'true' || flagged === '1') {
      where = 'WHERE p.flagged = 1';
    } else if (flagged === 'false' || flagged === '0') {
      where = 'WHERE p.flagged = 0';
    }

    const total = db.prepare(`SELECT COUNT(*) as count FROM posts p ${where}`).get(...params).count;
    const posts = db.prepare(`
      SELECT p.*, b.slug as blog_slug, b.name as blog_name
      FROM posts p JOIN blogs b ON p.blog_id = b.id
      ${where}
      ORDER BY p.created_at DESC LIMIT ? OFFSET ?
    `).all(...params, limit, offset);

    res.json({
      posts: posts.map(p => ({
        id: p.id,
        blog_slug: p.blog_slug,
        blog_name: p.blog_name,
        type: p.type,
        title: p.title,
        content: p.content ? p.content.slice(0, 200) : '',
        media_url: p.media_url,
        tags: JSON.parse(p.tags || '[]'),
        flagged: !!p.flagged,
        created_at: p.created_at
      })),
      pagination: { page, limit, total, pages: Math.ceil(total / limit) }
    });
  });

  // Flag a post
  router.post('/posts/:id/flag', (req, res) => {
    const post = db.prepare('SELECT * FROM posts WHERE id = ?').get(parseInt(req.params.id, 10));
    if (!post) return res.status(404).json({ error: 'Post not found' });

    db.prepare("UPDATE posts SET flagged = 1, updated_at = datetime('now') WHERE id = ?").run(post.id);
    logAction(db, 'flag_post', 'post', post.id, req.adminKeyPrefix, req.body.reason || '');

    res.json({ message: 'Post flagged', id: post.id });
  });

  // Unflag a post
  router.post('/posts/:id/unflag', (req, res) => {
    const post = db.prepare('SELECT * FROM posts WHERE id = ?').get(parseInt(req.params.id, 10));
    if (!post) return res.status(404).json({ error: 'Post not found' });

    db.prepare("UPDATE posts SET flagged = 0, updated_at = datetime('now') WHERE id = ?").run(post.id);
    logAction(db, 'unflag_post', 'post', post.id, req.adminKeyPrefix, '');

    res.json({ message: 'Post unflagged', id: post.id });
  });

  // Delete a post
  router.delete('/posts/:id', (req, res) => {
    const post = db.prepare('SELECT * FROM posts WHERE id = ?').get(parseInt(req.params.id, 10));
    if (!post) return res.status(404).json({ error: 'Post not found' });

    db.prepare('DELETE FROM posts WHERE id = ?').run(post.id);
    logAction(db, 'delete_post', 'post', post.id, req.adminKeyPrefix, req.body.reason || '');

    res.json({ message: 'Post deleted', id: post.id });
  });

  // Delete a blog
  router.delete('/blogs/:slug', (req, res) => {
    const blog = db.prepare('SELECT * FROM blogs WHERE slug = ?').get(req.params.slug);
    if (!blog) return res.status(404).json({ error: 'Blog not found' });

    db.prepare('DELETE FROM blogs WHERE id = ?').run(blog.id);
    logAction(db, 'delete_blog', 'blog', blog.id, req.adminKeyPrefix, req.body.reason || '');

    res.json({ message: 'Blog deleted', slug: blog.slug });
  });

  // Platform stats
  router.get('/stats', (req, res) => {
    const blogs = db.prepare('SELECT COUNT(*) as count FROM blogs').get().count;
    const posts = db.prepare('SELECT COUNT(*) as count FROM posts').get().count;
    const flagged = db.prepare('SELECT COUNT(*) as count FROM posts WHERE flagged = 1').get().count;
    const subscriptions = db.prepare('SELECT COUNT(*) as count FROM subscriptions').get().count;
    const todayPosts = db.prepare(
      "SELECT COUNT(*) as count FROM posts WHERE created_at >= datetime('now', '-1 day')"
    ).get().count;
    const todayBlogs = db.prepare(
      "SELECT COUNT(*) as count FROM blogs WHERE created_at >= datetime('now', '-1 day')"
    ).get().count;

    res.json({
      blogs, posts, flagged, subscriptions,
      today: { posts: todayPosts, blogs: todayBlogs }
    });
  });

  // Audit log
  router.get('/actions', (req, res) => {
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 50));
    const offset = (page - 1) * limit;

    const total = db.prepare('SELECT COUNT(*) as count FROM admin_actions').get().count;
    const actions = db.prepare(
      'SELECT * FROM admin_actions ORDER BY created_at DESC LIMIT ? OFFSET ?'
    ).all(limit, offset);

    res.json({
      actions,
      pagination: { page, limit, total, pages: Math.ceil(total / limit) }
    });
  });

  return router;
}

function logAction(db, action, targetType, targetId, adminKeyPrefix, details) {
  db.prepare(
    'INSERT INTO admin_actions (action, target_type, target_id, admin_key_prefix, details) VALUES (?, ?, ?, ?, ?)'
  ).run(action, targetType, targetId, adminKeyPrefix, details);
}

module.exports = createRoutes;
