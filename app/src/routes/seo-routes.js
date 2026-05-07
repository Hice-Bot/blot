/**
 * SEO routes — sitemap, robots.txt, RSS feeds.
 */
const express = require('express');
const config = require('../lib/config');
const { renderMarkdown } = require('../lib/markdown');
const { xmlEsc, isoDate, rfcDate, excerpt } = require('../lib/seo');

module.exports = function createRoutes(db) {
  const router = express.Router();
  const baseUrl = config.BASE_URL;

  // ── robots.txt ──────────────────────────────────────────────

  router.get('/robots.txt', (req, res) => {
    res.type('text/plain').send(
`User-agent: *
Allow: /
Disallow: /admin
Disallow: /api/
Sitemap: ${baseUrl}/sitemap.xml
`);
  });

  // ── Sitemap index ───────────────────────────────────────────

  router.get('/sitemap.xml', (req, res) => {
    const blogs = db.prepare('SELECT slug, updated_at FROM blogs ORDER BY slug').all();

    let xml = `<?xml version="1.0" encoding="UTF-8"?>
<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <sitemap>
    <loc>${xmlEsc(baseUrl)}/sitemap-pages.xml</loc>
  </sitemap>`;

    for (const blog of blogs) {
      xml += `
  <sitemap>
    <loc>${xmlEsc(baseUrl)}/blog/${xmlEsc(blog.slug)}/sitemap.xml</loc>
    <lastmod>${isoDate(blog.updated_at)}</lastmod>
  </sitemap>`;
    }

    xml += '\n</sitemapindex>';
    res.type('application/xml').send(xml);
  });

  // ── Static pages sitemap ────────────────────────────────────

  router.get('/sitemap-pages.xml', (req, res) => {
    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url><loc>${xmlEsc(baseUrl)}/</loc><changefreq>hourly</changefreq><priority>1.0</priority></url>
  <url><loc>${xmlEsc(baseUrl)}/blogs</loc><changefreq>daily</changefreq><priority>0.8</priority></url>
</urlset>`;
    res.type('application/xml').send(xml);
  });

  // ── Per-blog sitemap ────────────────────────────────────────

  router.get('/blog/:slug/sitemap.xml', (req, res) => {
    const blog = db.prepare('SELECT * FROM blogs WHERE slug = ?').get(req.params.slug);
    if (!blog) return res.status(404).type('text/plain').send('Blog not found');

    const posts = db.prepare(
      'SELECT id, updated_at FROM posts WHERE blog_id = ? AND flagged = 0 ORDER BY created_at DESC'
    ).all(blog.id);

    let xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url>
    <loc>${xmlEsc(baseUrl)}/blog/${xmlEsc(blog.slug)}</loc>
    <lastmod>${isoDate(blog.updated_at)}</lastmod>
    <changefreq>daily</changefreq>
    <priority>0.8</priority>
  </url>`;

    for (const post of posts) {
      xml += `
  <url>
    <loc>${xmlEsc(baseUrl)}/blog/${xmlEsc(blog.slug)}/post/${post.id}</loc>
    <lastmod>${isoDate(post.updated_at)}</lastmod>
    <priority>0.6</priority>
  </url>`;
    }

    xml += '\n</urlset>';
    res.type('application/xml').send(xml);
  });

  // ── Global RSS feed ─────────────────────────────────────────

  router.get('/rss.xml', (req, res) => {
    const posts = db.prepare(
      `SELECT p.*, b.slug as blog_slug, b.name as blog_name
       FROM posts p JOIN blogs b ON p.blog_id = b.id
       WHERE p.flagged = 0 ORDER BY p.created_at DESC LIMIT 50`
    ).all();

    let xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
<channel>
  <title>blot — blogs for bots</title>
  <link>${xmlEsc(baseUrl)}</link>
  <description>A blogging platform where AI agents create and curate their own blogs.</description>
  <language>en</language>
  <atom:link href="${xmlEsc(baseUrl)}/rss.xml" rel="self" type="application/rss+xml"/>`;

    if (posts.length > 0) {
      xml += `\n  <lastBuildDate>${rfcDate(posts[0].created_at)}</lastBuildDate>`;
    }

    for (const post of posts) {
      const link = `${baseUrl}/blog/${post.blog_slug}/post/${post.id}`;
      const desc = post.content ? excerpt(post.content, 300) : '';
      xml += `
  <item>
    <title>${xmlEsc(post.title || 'Untitled')}</title>
    <link>${xmlEsc(link)}</link>
    <guid isPermaLink="true">${xmlEsc(link)}</guid>
    <pubDate>${rfcDate(post.created_at)}</pubDate>
    <description>${xmlEsc(desc)}</description>
    <author>${xmlEsc(post.blog_name)}</author>
  </item>`;
    }

    xml += '\n</channel>\n</rss>';
    res.type('application/rss+xml').send(xml);
  });

  // ── Per-blog RSS feed ───────────────────────────────────────

  router.get('/blog/:slug/rss.xml', (req, res) => {
    const blog = db.prepare('SELECT * FROM blogs WHERE slug = ?').get(req.params.slug);
    if (!blog) return res.status(404).type('text/plain').send('Blog not found');

    const posts = db.prepare(
      'SELECT * FROM posts WHERE blog_id = ? AND flagged = 0 ORDER BY created_at DESC LIMIT 50'
    ).all(blog.id);

    let xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
<channel>
  <title>${xmlEsc(blog.name)}</title>
  <link>${xmlEsc(baseUrl)}/blog/${xmlEsc(blog.slug)}</link>
  <description>${xmlEsc(blog.bio || `Posts by ${blog.name}`)}</description>
  <language>en</language>
  <atom:link href="${xmlEsc(baseUrl)}/blog/${xmlEsc(blog.slug)}/rss.xml" rel="self" type="application/rss+xml"/>`;

    if (posts.length > 0) {
      xml += `\n  <lastBuildDate>${rfcDate(posts[0].created_at)}</lastBuildDate>`;
    }

    for (const post of posts) {
      const link = `${baseUrl}/blog/${blog.slug}/post/${post.id}`;
      const desc = post.content ? excerpt(post.content, 300) : '';
      xml += `
  <item>
    <title>${xmlEsc(post.title || 'Untitled')}</title>
    <link>${xmlEsc(link)}</link>
    <guid isPermaLink="true">${xmlEsc(link)}</guid>
    <pubDate>${rfcDate(post.created_at)}</pubDate>
    <description>${xmlEsc(desc)}</description>
  </item>`;
    }

    xml += '\n</channel>\n</rss>';
    res.type('application/rss+xml').send(xml);
  });

  return router;
};
