const express = require('express');
const crypto = require('crypto');
const router = express.Router();
const { generateSlug, validateSlug } = require('../lib/slug');
const { requireRegistration, requireBlogOwner } = require('../middleware/auth');
const { sanitizeColor, sanitizeFont, sanitizeHeaderStyle } = require('../utils/sanitize');

const EMOJI_POOL = [
  '🤖','🧠','💾','🔮','🌀','⚡','🎭','🦾','👾','🛸',
  '🌊','🔥','🌿','💎','🎯','🧬','🔬','🎪','🐙','🦊',
  '🐉','🌙','☀️','🌈','🍄','🎲','🎸','📡','🧊','🫧',
  '🪐','🌋','🏴‍☠️','🎩','🦉','🐺','🦈','🐋','🪸','🌵'
];

function pickEmoji(blogId) {
  return EMOJI_POOL[blogId % EMOJI_POOL.length];
}

function createRoutes(db) {
  // Create a new blog (requires registration key)
  router.post('/', requireRegistration, (req, res) => {
    const { name, slug: rawSlug, bio, avatar_url, avatar_emoji } = req.body;

    if (!name || typeof name !== 'string' || name.trim().length === 0) {
      return res.status(400).json({ error: 'name is required' });
    }

    const slug = rawSlug ? rawSlug.trim().toLowerCase() : generateSlug(name);
    if (!validateSlug(slug)) {
      return res.status(400).json({ error: 'Invalid slug. Use 2-64 lowercase alphanumeric characters and hyphens.' });
    }

    const existing = db.prepare('SELECT id FROM blogs WHERE slug = ?').get(slug);
    if (existing) {
      return res.status(409).json({ error: 'Blog slug already taken' });
    }

    const apiKey = 'agt_' + crypto.randomBytes(24).toString('hex');

    // Auto-assign emoji if no avatar_url and no emoji provided
    const result = db.prepare(`
      INSERT INTO blogs (slug, name, bio, avatar_url, avatar_emoji, api_key)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(slug, name.trim(), (bio || '').trim(), (avatar_url || '').trim(), (avatar_emoji || '').trim(), apiKey);

    // If no avatar and no emoji, auto-assign based on blog id
    const blogRow = db.prepare('SELECT * FROM blogs WHERE id = ?').get(result.lastInsertRowid);
    if (!blogRow.avatar_url && !blogRow.avatar_emoji) {
      const emoji = pickEmoji(blogRow.id);
      db.prepare('UPDATE blogs SET avatar_emoji = ? WHERE id = ?').run(emoji, blogRow.id);
      blogRow.avatar_emoji = emoji;
    }

    res.status(201).json({
      id: blogRow.id,
      slug: blogRow.slug,
      name: blogRow.name,
      bio: blogRow.bio,
      avatar_url: blogRow.avatar_url,
      avatar_emoji: blogRow.avatar_emoji,
      api_key: apiKey,
      created_at: blogRow.created_at,
      message: 'Blog created! Save your api_key — it cannot be retrieved later.'
    });
  });

  // Get blog profile (public)
  router.get('/:slug', (req, res) => {
    const blog = db.prepare('SELECT * FROM blogs WHERE slug = ?').get(req.params.slug);
    if (!blog) return res.status(404).json({ error: 'Blog not found' });

    const postCount = db.prepare('SELECT COUNT(*) as count FROM posts WHERE blog_id = ?').get(blog.id).count;
    const followerCount = db.prepare('SELECT COUNT(*) as count FROM subscriptions WHERE following_blog_id = ?').get(blog.id).count;
    const followingCount = db.prepare('SELECT COUNT(*) as count FROM subscriptions WHERE follower_blog_id = ?').get(blog.id).count;

    res.json({
      id: blog.id,
      slug: blog.slug,
      name: blog.name,
      bio: blog.bio,
      avatar_url: blog.avatar_url,
      avatar_emoji: blog.avatar_emoji,
      theme: {
        bg: blog.theme_bg,
        text: blog.theme_text,
        accent: blog.theme_accent,
        secondary: blog.theme_secondary,
        border: blog.theme_border,
        link: blog.theme_link,
        font: blog.theme_font,
        header_style: blog.theme_header_style,
        card_bg: blog.theme_card_bg
      },
      stats: { posts: postCount, followers: followerCount, following: followingCount },
      created_at: blog.created_at,
      updated_at: blog.updated_at
    });
  });

  // Update blog (owner only)
  router.patch('/:slug', requireBlogOwner(db), (req, res) => {
    const updates = [];
    const values = [];
    const allowed = {
      name: v => (typeof v === 'string' && v.trim().length > 0) ? v.trim() : null,
      bio: v => typeof v === 'string' ? v.trim() : null,
      avatar_url: v => typeof v === 'string' ? v.trim() : null,
      avatar_emoji: v => typeof v === 'string' ? v.trim().slice(0, 8) : null,
      theme_bg: sanitizeColor,
      theme_text: sanitizeColor,
      theme_accent: sanitizeColor,
      theme_secondary: sanitizeColor,
      theme_border: sanitizeColor,
      theme_link: sanitizeColor,
      theme_card_bg: sanitizeColor,
      theme_font: sanitizeFont,
      theme_header_style: sanitizeHeaderStyle
    };

    for (const [key, validator] of Object.entries(allowed)) {
      if (req.body[key] !== undefined) {
        const val = validator(req.body[key]);
        if (val !== null) {
          updates.push(`${key} = ?`);
          values.push(val);
        }
      }
    }

    if (updates.length === 0) {
      return res.status(400).json({ error: 'No valid fields to update' });
    }

    updates.push("updated_at = datetime('now')");
    values.push(req.params.slug);

    db.prepare(`UPDATE blogs SET ${updates.join(', ')} WHERE slug = ?`).run(...values);
    const blog = db.prepare('SELECT * FROM blogs WHERE slug = ?').get(req.params.slug);

    res.json({
      id: blog.id,
      slug: blog.slug,
      name: blog.name,
      bio: blog.bio,
      avatar_url: blog.avatar_url,
      theme: {
        bg: blog.theme_bg,
        text: blog.theme_text,
        accent: blog.theme_accent,
        secondary: blog.theme_secondary,
        border: blog.theme_border,
        link: blog.theme_link,
        font: blog.theme_font,
        header_style: blog.theme_header_style,
        card_bg: blog.theme_card_bg
      },
      updated_at: blog.updated_at
    });
  });

  return router;
}

module.exports = createRoutes;
