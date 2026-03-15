const express = require('express');
const router = express.Router();
const { requireBlogOwner } = require('../middleware/auth');

function createRoutes(db) {
  // Follow a blog
  router.post('/:slug/subscribe/:target', requireBlogOwner(db), (req, res) => {
    const target = db.prepare('SELECT * FROM blogs WHERE slug = ?').get(req.params.target);
    if (!target) return res.status(404).json({ error: 'Target blog not found' });

    if (target.id === req.blog.id) {
      return res.status(400).json({ error: 'Cannot follow yourself' });
    }

    const existing = db.prepare(
      'SELECT id FROM subscriptions WHERE follower_blog_id = ? AND following_blog_id = ?'
    ).get(req.blog.id, target.id);

    if (existing) {
      return res.status(409).json({ error: 'Already following this blog' });
    }

    db.prepare(
      'INSERT INTO subscriptions (follower_blog_id, following_blog_id) VALUES (?, ?)'
    ).run(req.blog.id, target.id);

    res.status(201).json({
      message: `Now following ${target.name}`,
      follower: req.blog.slug,
      following: target.slug
    });
  });

  // Unfollow a blog
  router.delete('/:slug/subscribe/:target', requireBlogOwner(db), (req, res) => {
    const target = db.prepare('SELECT * FROM blogs WHERE slug = ?').get(req.params.target);
    if (!target) return res.status(404).json({ error: 'Target blog not found' });

    const result = db.prepare(
      'DELETE FROM subscriptions WHERE follower_blog_id = ? AND following_blog_id = ?'
    ).run(req.blog.id, target.id);

    if (result.changes === 0) {
      return res.status(404).json({ error: 'Not following this blog' });
    }

    res.json({
      message: `Unfollowed ${target.name}`,
      follower: req.blog.slug,
      unfollowed: target.slug
    });
  });

  // Get followers
  router.get('/:slug/followers', (req, res) => {
    const blog = db.prepare('SELECT * FROM blogs WHERE slug = ?').get(req.params.slug);
    if (!blog) return res.status(404).json({ error: 'Blog not found' });

    const followers = db.prepare(`
      SELECT b.slug, b.name, b.avatar_url, s.created_at as followed_at
      FROM subscriptions s JOIN blogs b ON s.follower_blog_id = b.id
      WHERE s.following_blog_id = ?
      ORDER BY s.created_at DESC
    `).all(blog.id);

    res.json({ followers });
  });

  // Get following
  router.get('/:slug/following', (req, res) => {
    const blog = db.prepare('SELECT * FROM blogs WHERE slug = ?').get(req.params.slug);
    if (!blog) return res.status(404).json({ error: 'Blog not found' });

    const following = db.prepare(`
      SELECT b.slug, b.name, b.avatar_url, s.created_at as followed_at
      FROM subscriptions s JOIN blogs b ON s.following_blog_id = b.id
      WHERE s.follower_blog_id = ?
      ORDER BY s.created_at DESC
    `).all(blog.id);

    res.json({ following });
  });

  return router;
}

module.exports = createRoutes;
