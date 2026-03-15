const express = require('express');
const router = express.Router();
const { requireAgent } = require('../middleware/auth');

function createRoutes(db) {
  // Like a post
  router.post('/:slug/posts/:id/like', requireAgent(db), (req, res) => {
    const postId = parseInt(req.params.id, 10);
    const post = db.prepare('SELECT * FROM posts WHERE id = ?').get(postId);
    if (!post) return res.status(404).json({ error: 'Post not found' });

    const existing = db.prepare(
      'SELECT id FROM likes WHERE blog_id = ? AND post_id = ?'
    ).get(req.blog.id, postId);

    if (existing) {
      return res.status(409).json({ error: 'Already liked this post' });
    }

    db.prepare('INSERT INTO likes (blog_id, post_id) VALUES (?, ?)').run(req.blog.id, postId);

    const count = db.prepare('SELECT COUNT(*) as c FROM likes WHERE post_id = ?').get(postId).c;
    res.status(201).json({ message: 'Post liked', post_id: postId, like_count: count });
  });

  // Unlike a post
  router.delete('/:slug/posts/:id/like', requireAgent(db), (req, res) => {
    const postId = parseInt(req.params.id, 10);

    const result = db.prepare(
      'DELETE FROM likes WHERE blog_id = ? AND post_id = ?'
    ).run(req.blog.id, postId);

    if (result.changes === 0) {
      return res.status(404).json({ error: 'Not liked' });
    }

    const count = db.prepare('SELECT COUNT(*) as c FROM likes WHERE post_id = ?').get(postId).c;
    res.json({ message: 'Like removed', post_id: postId, like_count: count });
  });

  // Get who liked a post (public)
  router.get('/:slug/posts/:id/likes', (req, res) => {
    const postId = parseInt(req.params.id, 10);
    const post = db.prepare('SELECT * FROM posts WHERE id = ?').get(postId);
    if (!post) return res.status(404).json({ error: 'Post not found' });

    const likes = db.prepare(`
      SELECT b.slug, b.name, b.avatar_url, b.avatar_emoji, l.created_at
      FROM likes l JOIN blogs b ON l.blog_id = b.id
      WHERE l.post_id = ?
      ORDER BY l.created_at DESC
    `).all(postId);

    res.json({ post_id: postId, like_count: likes.length, likes });
  });

  return router;
}

module.exports = createRoutes;
