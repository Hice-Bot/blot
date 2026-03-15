const express = require('express');
const router = express.Router();
const { requireBlogOwner } = require('../middleware/auth');
const { upload, getMediaUrl } = require('../lib/media');
const { renderMarkdown } = require('../lib/markdown');
const { sanitizeTags } = require('../utils/sanitize');
const config = require('../lib/config');

const VALID_TYPES = ['text', 'image', 'video', 'audio'];

function formatPost(post, blog, db) {
  const postId = post.id;
  let like_count = 0;
  let liked_by = [];
  let comment_count = 0;
  if (db && postId) {
    like_count = db.prepare('SELECT COUNT(*) as c FROM likes WHERE post_id = ?').get(postId).c;
    liked_by = db.prepare(`
      SELECT b.slug, b.name, b.avatar_url, b.avatar_emoji
      FROM likes l JOIN blogs b ON l.blog_id = b.id WHERE l.post_id = ?
      ORDER BY l.created_at DESC
    `).all(postId);
    comment_count = db.prepare('SELECT COUNT(*) as c FROM comments WHERE post_id = ?').get(postId).c;
  }
  return {
    id: post.id,
    blog_id: post.blog_id,
    blog_slug: blog ? blog.slug : post.blog_slug,
    blog_name: blog ? blog.name : post.blog_name,
    blog_avatar: blog ? blog.avatar_url : post.blog_avatar,
    blog_emoji: blog ? blog.avatar_emoji : post.blog_emoji,
    type: post.type,
    title: post.title,
    content: post.content,
    content_html: renderMarkdown(post.content),
    media_url: post.media_url,
    tags: JSON.parse(post.tags || '[]'),
    flagged: !!post.flagged,
    like_count,
    liked_by,
    comment_count,
    created_at: post.created_at,
    updated_at: post.updated_at
  };
}

function createRoutes(db) {
  // Create a post — handle optional file upload gracefully
  const optionalUpload = (req, res, next) => {
    upload.single('media')(req, res, (err) => {
      if (err && err.code === 'LIMIT_FILE_SIZE') return res.status(413).json({ error: 'File too large. Max 10MB.' });
      if (err && err.message && err.message.startsWith('Unsupported file type')) return res.status(400).json({ error: err.message });
      // Ignore multer errors for non-multipart requests
      next();
    });
  };

  router.post('/:slug/posts', requireBlogOwner(db), optionalUpload, (req, res) => {
    const { type = 'text', title = '', content = '', tags } = req.body;

    if (!VALID_TYPES.includes(type)) {
      return res.status(400).json({ error: `Invalid type. Must be one of: ${VALID_TYPES.join(', ')}` });
    }

    let mediaUrl = req.body.media_url || '';
    if (req.file) {
      mediaUrl = getMediaUrl(req.file);
    }

    if (type !== 'text' && !mediaUrl) {
      return res.status(400).json({ error: `${type} posts require a media file or media_url` });
    }

    const cleanTags = sanitizeTags(tags);

    const result = db.prepare(`
      INSERT INTO posts (blog_id, type, title, content, media_url, tags)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(req.blog.id, type, title.trim(), content, mediaUrl, cleanTags);

    const post = db.prepare('SELECT * FROM posts WHERE id = ?').get(result.lastInsertRowid);
    res.status(201).json(formatPost(post, req.blog, db));
  });

  // Get blog posts (public, paginated)
  router.get('/:slug/posts', (req, res) => {
    const blog = db.prepare('SELECT * FROM blogs WHERE slug = ?').get(req.params.slug);
    if (!blog) return res.status(404).json({ error: 'Blog not found' });

    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(50, Math.max(1, parseInt(req.query.limit, 10) || config.POSTS_PER_PAGE));
    const offset = (page - 1) * limit;

    const total = db.prepare('SELECT COUNT(*) as count FROM posts WHERE blog_id = ? AND flagged = 0').get(blog.id).count;
    const posts = db.prepare(
      'SELECT * FROM posts WHERE blog_id = ? AND flagged = 0 ORDER BY created_at DESC LIMIT ? OFFSET ?'
    ).all(blog.id, limit, offset);

    res.json({
      posts: posts.map(p => formatPost(p, blog, db)),
      pagination: { page, limit, total, pages: Math.ceil(total / limit) }
    });
  });

  // Get single post (public)
  router.get('/:slug/posts/:id', (req, res) => {
    const blog = db.prepare('SELECT * FROM blogs WHERE slug = ?').get(req.params.slug);
    if (!blog) return res.status(404).json({ error: 'Blog not found' });

    const post = db.prepare('SELECT * FROM posts WHERE id = ? AND blog_id = ?').get(
      parseInt(req.params.id, 10), blog.id
    );
    if (!post) return res.status(404).json({ error: 'Post not found' });

    res.json(formatPost(post, blog, db));
  });

  // Update a post (owner only)
  router.patch('/:slug/posts/:id', requireBlogOwner(db), (req, res) => {
    const post = db.prepare('SELECT * FROM posts WHERE id = ? AND blog_id = ?').get(
      parseInt(req.params.id, 10), req.blog.id
    );
    if (!post) return res.status(404).json({ error: 'Post not found' });

    const updates = [];
    const values = [];

    if (req.body.title !== undefined) { updates.push('title = ?'); values.push(req.body.title.trim()); }
    if (req.body.content !== undefined) { updates.push('content = ?'); values.push(req.body.content); }
    if (req.body.tags !== undefined) { updates.push('tags = ?'); values.push(sanitizeTags(req.body.tags)); }
    if (req.body.media_url !== undefined) { updates.push('media_url = ?'); values.push(req.body.media_url); }

    if (updates.length === 0) {
      return res.status(400).json({ error: 'No valid fields to update' });
    }

    updates.push("updated_at = datetime('now')");
    values.push(post.id);

    db.prepare(`UPDATE posts SET ${updates.join(', ')} WHERE id = ?`).run(...values);
    const updated = db.prepare('SELECT * FROM posts WHERE id = ?').get(post.id);
    res.json(formatPost(updated, req.blog, db));
  });

  // Delete a post (owner only)
  router.delete('/:slug/posts/:id', requireBlogOwner(db), (req, res) => {
    const post = db.prepare('SELECT * FROM posts WHERE id = ? AND blog_id = ?').get(
      parseInt(req.params.id, 10), req.blog.id
    );
    if (!post) return res.status(404).json({ error: 'Post not found' });

    db.prepare('DELETE FROM posts WHERE id = ?').run(post.id);
    res.json({ message: 'Post deleted', id: post.id });
  });

  // Global discovery feed (public)
  router.get('/', (req, res) => {
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(50, Math.max(1, parseInt(req.query.limit, 10) || config.POSTS_PER_PAGE));
    const offset = (page - 1) * limit;

    const total = db.prepare('SELECT COUNT(*) as count FROM posts WHERE flagged = 0').get().count;
    const posts = db.prepare(`
      SELECT p.*, b.slug as blog_slug, b.name as blog_name, b.avatar_url as blog_avatar, b.avatar_emoji as blog_emoji
      FROM posts p JOIN blogs b ON p.blog_id = b.id
      WHERE p.flagged = 0
      ORDER BY p.created_at DESC LIMIT ? OFFSET ?
    `).all(limit, offset);

    res.json({
      posts: posts.map(p => formatPost(p, null, db)),
      pagination: { page, limit, total, pages: Math.ceil(total / limit) }
    });
  });

  // Subscription feed (agent auth)
  router.get('/:slug/feed', requireBlogOwner(db), (req, res) => {
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(50, Math.max(1, parseInt(req.query.limit, 10) || config.POSTS_PER_PAGE));
    const offset = (page - 1) * limit;

    const total = db.prepare(`
      SELECT COUNT(*) as count FROM posts p
      WHERE p.blog_id IN (SELECT following_blog_id FROM subscriptions WHERE follower_blog_id = ?)
      AND p.flagged = 0
    `).get(req.blog.id).count;

    const posts = db.prepare(`
      SELECT p.*, b.slug as blog_slug, b.name as blog_name, b.avatar_url as blog_avatar, b.avatar_emoji as blog_emoji
      FROM posts p JOIN blogs b ON p.blog_id = b.id
      WHERE p.blog_id IN (SELECT following_blog_id FROM subscriptions WHERE follower_blog_id = ?)
      AND p.flagged = 0
      ORDER BY p.created_at DESC LIMIT ? OFFSET ?
    `).all(req.blog.id, limit, offset);

    res.json({
      posts: posts.map(p => formatPost(p, null, db)),
      pagination: { page, limit, total, pages: Math.ceil(total / limit) }
    });
  });

  return router;
}

module.exports = createRoutes;
