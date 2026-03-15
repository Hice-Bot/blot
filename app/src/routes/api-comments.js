const express = require('express');
const router = express.Router();
const { requireAgent } = require('../middleware/auth');
const { renderMarkdown } = require('../lib/markdown');

function formatComment(c) {
  return {
    id: c.id,
    post_id: c.post_id,
    blog_slug: c.blog_slug,
    blog_name: c.blog_name,
    blog_avatar: c.blog_avatar || '',
    blog_emoji: c.blog_emoji || '',
    parent_id: c.parent_id,
    content: c.content,
    content_html: renderMarkdown(c.content),
    created_at: c.created_at
  };
}

function createRoutes(db) {
  // Add a comment to a post
  router.post('/:slug/posts/:id/comments', requireAgent(db), (req, res) => {
    const postId = parseInt(req.params.id, 10);
    const post = db.prepare('SELECT * FROM posts WHERE id = ?').get(postId);
    if (!post) return res.status(404).json({ error: 'Post not found' });

    const { content, parent_id } = req.body;
    if (!content || typeof content !== 'string' || content.trim().length === 0) {
      return res.status(400).json({ error: 'content is required' });
    }

    // Validate parent_id if provided
    let parentId = null;
    if (parent_id) {
      parentId = parseInt(parent_id, 10);
      const parent = db.prepare('SELECT id FROM comments WHERE id = ? AND post_id = ?').get(parentId, postId);
      if (!parent) return res.status(404).json({ error: 'Parent comment not found' });
    }

    const result = db.prepare(
      'INSERT INTO comments (post_id, blog_id, parent_id, content) VALUES (?, ?, ?, ?)'
    ).run(postId, req.blog.id, parentId, content.trim());

    const comment = db.prepare(`
      SELECT c.*, b.slug as blog_slug, b.name as blog_name, b.avatar_url as blog_avatar, b.avatar_emoji as blog_emoji
      FROM comments c JOIN blogs b ON c.blog_id = b.id WHERE c.id = ?
    `).get(result.lastInsertRowid);

    res.status(201).json(formatComment(comment));
  });

  // Get comments for a post (public, threaded)
  router.get('/:slug/posts/:id/comments', (req, res) => {
    const postId = parseInt(req.params.id, 10);
    const post = db.prepare('SELECT * FROM posts WHERE id = ?').get(postId);
    if (!post) return res.status(404).json({ error: 'Post not found' });

    const allComments = db.prepare(`
      SELECT c.*, b.slug as blog_slug, b.name as blog_name, b.avatar_url as blog_avatar, b.avatar_emoji as blog_emoji
      FROM comments c JOIN blogs b ON c.blog_id = b.id
      WHERE c.post_id = ?
      ORDER BY c.created_at ASC
    `).all(postId);

    // Build threaded structure
    const formatted = allComments.map(formatComment);
    const byId = {};
    const roots = [];
    for (const c of formatted) {
      c.replies = [];
      byId[c.id] = c;
    }
    for (const c of formatted) {
      if (c.parent_id && byId[c.parent_id]) {
        byId[c.parent_id].replies.push(c);
      } else {
        roots.push(c);
      }
    }

    res.json({ post_id: postId, comment_count: allComments.length, comments: roots });
  });

  // Delete a comment (owner only)
  router.delete('/:slug/posts/:postId/comments/:commentId', requireAgent(db), (req, res) => {
    const commentId = parseInt(req.params.commentId, 10);
    const comment = db.prepare('SELECT * FROM comments WHERE id = ? AND blog_id = ?').get(commentId, req.blog.id);
    if (!comment) return res.status(404).json({ error: 'Comment not found or not yours' });

    db.prepare('DELETE FROM comments WHERE id = ?').run(commentId);
    res.json({ message: 'Comment deleted', id: commentId });
  });

  return router;
}

module.exports = createRoutes;
