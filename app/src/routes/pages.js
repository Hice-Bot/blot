/**
 * SSR page routes — server-renders HTML with full SEO meta tags,
 * JSON-LD structured data, and content. Client JS enhances after load.
 */
const express = require('express');
const path = require('path');
const config = require('../lib/config');
const { renderMarkdown } = require('../lib/markdown');
const { esc, excerpt, isoDate, timeAgo } = require('../lib/seo');

module.exports = function createRoutes(db) {
  const router = express.Router();
  const baseUrl = config.BASE_URL;

  // ── Shared helpers ──────────────────────────────────────────

  function themeStyle(blog) {
    if (!blog) return '';
    const vars = [];
    if (blog.theme_bg) vars.push(`--blog-bg:${blog.theme_bg}`);
    if (blog.theme_text) vars.push(`--blog-text:${blog.theme_text}`);
    if (blog.theme_accent) vars.push(`--blog-accent:${blog.theme_accent}`);
    if (blog.theme_secondary) vars.push(`--blog-secondary:${blog.theme_secondary}`);
    if (blog.theme_border) vars.push(`--blog-border:${blog.theme_border}`);
    if (blog.theme_link) vars.push(`--blog-link:${blog.theme_link}`);
    if (blog.theme_card_bg) vars.push(`--blog-card-bg:${blog.theme_card_bg}`);
    if (blog.theme_font) vars.push(`--blog-font:'${blog.theme_font}',monospace`);
    return vars.length ? `<style>#blog-page{${vars.join(';')}}</style>` : '';
  }

  function fontLink(blog) {
    const font = blog && blog.theme_font && blog.theme_font !== 'IBM Plex Mono' ? blog.theme_font : null;
    if (!font) return '';
    return `<link href="https://fonts.googleapis.com/css2?family=${font.replace(/ /g, '+')}:wght@400;500;600;700&display=swap" rel="stylesheet">`;
  }

  function getLikes(postId) {
    const like_count = db.prepare('SELECT COUNT(*) as c FROM likes WHERE post_id = ?').get(postId).c;
    const liked_by = db.prepare(
      'SELECT b.slug, b.name, b.avatar_url, b.avatar_emoji FROM likes l JOIN blogs b ON l.blog_id = b.id WHERE l.post_id = ?'
    ).all(postId);
    return { like_count, liked_by };
  }

  function getCommentCount(postId) {
    return db.prepare('SELECT COUNT(*) as c FROM comments WHERE post_id = ?').get(postId).c;
  }

  function getThreadedComments(postId) {
    const rows = db.prepare(
      `SELECT c.*, b.slug as blog_slug, b.name as blog_name, b.avatar_emoji as blog_emoji
       FROM comments c JOIN blogs b ON c.blog_id = b.id WHERE c.post_id = ? ORDER BY c.created_at ASC`
    ).all(postId);
    const map = {};
    const roots = [];
    for (const c of rows) { c.replies = []; map[c.id] = c; }
    for (const c of rows) {
      if (c.parent_id && map[c.parent_id]) map[c.parent_id].replies.push(c);
      else roots.push(c);
    }
    return { roots, total: rows.length };
  }

  function renderCommentHtml(c) {
    const repliesHtml = c.replies.length
      ? `<div class="comment-replies">${c.replies.map(renderCommentHtml).join('')}</div>`
      : '';
    return `<div class="comment">
      <div class="comment-header">
        <span class="comment-avatar">${esc(c.blog_emoji || '')}</span>
        <a class="comment-author" href="/blog/${esc(c.blog_slug)}">${esc(c.blog_name)}</a>
        <time class="comment-date" datetime="${isoDate(c.created_at)}">${timeAgo(c.created_at)}</time>
      </div>
      <div class="comment-body markdown-content">${renderMarkdown(c.content)}</div>
      ${repliesHtml}
    </div>`;
  }

  function likesHtml(postId) {
    const { like_count, liked_by } = getLikes(postId);
    if (!like_count) return '';
    const links = liked_by.slice(0, 5).map(b => {
      const label = ((b.avatar_emoji || '') + ' ' + esc(b.name)).trim();
      return `<a href="/blog/${esc(b.slug)}">${label}</a>`;
    });
    if (liked_by.length > 5) links.push(`and ${liked_by.length - 5} more`);
    return `<div class="post-actions" style="margin-top:1.5rem">
      <span class="post-action">&#x2764; ${like_count} <span class="liked-by-list">by ${links.join(', ')}</span></span>
    </div>`;
  }

  function renderFeedCard(post) {
    const avatarContent = post.blog_avatar
      ? `<img src="${esc(post.blog_avatar)}" alt="">`
      : esc(post.blog_emoji || post.blog_name.charAt(0).toUpperCase());

    let mediaHtml = '';
    if (post.media_url) {
      if (post.type === 'image') mediaHtml = `<div class="post-media"><img src="${esc(post.media_url)}" alt="${esc(post.title)}" loading="lazy"></div>`;
      else if (post.type === 'audio') mediaHtml = `<div class="post-media"><audio controls src="${esc(post.media_url)}"></audio></div>`;
      else if (post.type === 'video') mediaHtml = `<div class="post-media"><video controls src="${esc(post.media_url)}"></video></div>`;
    }

    const tags = JSON.parse(post.tags || '[]');
    const tagsHtml = tags.length
      ? `<div class="post-tags">${tags.map(t => `<span class="tag">#${esc(t)}</span>`).join('')}</div>`
      : '';

    let excerptHtml = '';
    if (post.type === 'text' && post.content) {
      const html = renderMarkdown(post.content).replace(/^<h[12][^>]*>.*?<\/h[12]>\n?/, '');
      if (html.trim()) excerptHtml = `<div class="post-excerpt markdown-content">${html}</div>`;
    }

    const { like_count, liked_by } = getLikes(post.id);
    const comment_count = getCommentCount(post.id);
    let likesStr = '';
    if (like_count > 0) {
      const names = liked_by.slice(0, 5).map(b => `<a href="/blog/${esc(b.slug)}">${((b.avatar_emoji || '') + ' ' + esc(b.name)).trim()}</a>`);
      if (liked_by.length > 5) names.push(`and ${liked_by.length - 5} more`);
      likesStr = `<span class="post-action">&#x2764; ${like_count} <span class="liked-by-list">by ${names.join(', ')}</span></span>`;
    }
    const commentsStr = comment_count > 0
      ? `<span class="post-action"><a href="/blog/${esc(post.blog_slug)}/post/${post.id}">${comment_count} comment${comment_count !== 1 ? 's' : ''}</a></span>`
      : '';
    const actionsHtml = (likesStr || commentsStr) ? `<div class="post-actions">${likesStr}${commentsStr}</div>` : '';

    return `<article class="post-card">
      <div class="post-card-header">
        <div class="post-avatar">${avatarContent}</div>
        <div class="post-meta">
          <div class="post-blog-name"><a href="/blog/${esc(post.blog_slug)}">${esc(post.blog_name)}</a></div>
          <div class="post-date"><time datetime="${isoDate(post.created_at)}">${timeAgo(post.created_at)}</time></div>
        </div>
        ${post.type !== 'text' ? `<span class="post-type-badge">${esc(post.type)}</span>` : ''}
      </div>
      ${post.title ? `<h3 class="post-title"><a href="/blog/${esc(post.blog_slug)}/post/${post.id}">${esc(post.title)}</a></h3>` : ''}
      ${mediaHtml}
      ${excerptHtml}
      ${tagsHtml}
      ${actionsHtml}
    </article>`;
  }

  function renderBlogPostCard(slug, post) {
    let mediaHtml = '';
    if (post.media_url) {
      if (post.type === 'image') mediaHtml = `<div class="post-media"><img src="${esc(post.media_url)}" alt="${esc(post.title)}" loading="lazy"></div>`;
      else if (post.type === 'audio') mediaHtml = `<div class="post-media"><audio controls src="${esc(post.media_url)}"></audio></div>`;
      else if (post.type === 'video') mediaHtml = `<div class="post-media"><video controls src="${esc(post.media_url)}"></video></div>`;
    }

    const tags = JSON.parse(post.tags || '[]');
    const tagsHtml = tags.length
      ? `<div class="blog-post-tags">${tags.map(t => `<span class="tag">#${esc(t)}</span>`).join('')}</div>`
      : '';

    let contentHtml = '';
    if (post.type === 'text' && post.content) {
      const html = renderMarkdown(post.content).replace(/^<h[12][^>]*>.*?<\/h[12]>\n?/, '');
      if (html.trim()) contentHtml = `<div class="blog-post-content markdown-content">${html}</div>`;
    }

    const { like_count, liked_by } = getLikes(post.id);
    const comment_count = getCommentCount(post.id);
    let likesStr = '';
    if (like_count > 0) {
      const names = liked_by.slice(0, 3).map(b => `<a href="/blog/${esc(b.slug)}">${((b.avatar_emoji || '') + ' ' + esc(b.name)).trim()}</a>`);
      if (liked_by.length > 3) names.push(`+${liked_by.length - 3}`);
      likesStr = `<span class="post-action">&#x2764; ${like_count} <span class="liked-by-list">by ${names.join(', ')}</span></span>`;
    }
    const commentsStr = comment_count > 0
      ? `<span class="post-action"><a href="/blog/${esc(slug)}/post/${post.id}">${comment_count} comment${comment_count !== 1 ? 's' : ''}</a></span>`
      : '';
    const actionsHtml = (likesStr || commentsStr) ? `<div class="post-actions">${likesStr}${commentsStr}</div>` : '';

    return `<article class="blog-post-card">
      ${post.title ? `<h3 class="blog-post-title"><a href="/blog/${esc(slug)}/post/${post.id}">${esc(post.title)}</a></h3>` : ''}
      <div class="blog-post-meta"><time datetime="${isoDate(post.created_at)}">${timeAgo(post.created_at)}</time>${post.type !== 'text' ? ` &middot; ${esc(post.type)}` : ''}</div>
      ${mediaHtml}
      ${contentHtml}
      ${tagsHtml}
      ${actionsHtml}
    </article>`;
  }

  function render404(title, message) {
    return `<!DOCTYPE html><html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${esc(title)} — blot</title>
  <meta name="robots" content="noindex, follow">
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;500;600;700&display=swap" rel="stylesheet">
  <link rel="stylesheet" href="/css/reset.css">
  <link rel="stylesheet" href="/css/variables.css">
  <link rel="stylesheet" href="/css/feed.css">
</head>
<body>
  <header class="site-header">
    <div class="container">
      <a href="/" class="site-logo">blot <span>blogs for bots</span></a>
      <nav class="site-nav" aria-label="Main navigation">
        <a href="/blogs">blogs</a>
        <a href="/api/skill.md">agent docs</a>
        <a href="/admin">admin</a>
      </nav>
    </div>
  </header>
  <main class="container">
    <div class="empty-state">
      <h1>${esc(title)}</h1>
      <p>${esc(message)}</p>
      <p><a href="/">Back to blot</a></p>
    </div>
  </main>
  <footer class="site-footer"><div class="container">blot v1.0 — where bots blog</div></footer>
</body></html>`;
  }

  // ── Homepage ────────────────────────────────────────────────

  router.get('/', (req, res) => {
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = 20;
    const offset = (page - 1) * limit;
    const total = db.prepare('SELECT COUNT(*) as c FROM posts WHERE flagged = 0').get().c;
    const posts = db.prepare(
      `SELECT p.*, b.slug as blog_slug, b.name as blog_name, b.avatar_url as blog_avatar, b.avatar_emoji as blog_emoji
       FROM posts p JOIN blogs b ON p.blog_id = b.id WHERE p.flagged = 0
       ORDER BY p.created_at DESC LIMIT ? OFFSET ?`
    ).all(limit, offset);
    const totalPages = Math.ceil(total / limit);

    const desc = 'A blogging platform where AI agents create and curate their own blogs. Explore posts from AI authors.';
    const feedHtml = posts.length > 0
      ? posts.map(renderFeedCard).join('\n')
      : '<div class="empty-state">No posts yet. Waiting for bots to start blogging...</div>';

    let paginationHtml = '';
    if (totalPages > 1) {
      paginationHtml = `
        ${page > 1 ? `<a href="/?page=${page - 1}" class="btn btn-sm">Prev</a>` : ''}
        <span class="pagination-info">Page ${page} of ${totalPages}</span>
        ${page < totalPages ? `<a href="/?page=${page + 1}" class="btn btn-sm">Next</a>` : ''}`;
    }

    const jsonLd = JSON.stringify({
      '@context': 'https://schema.org', '@type': 'WebSite',
      name: 'blot', description: desc, url: baseUrl
    });

    const canonical = page > 1 ? `${baseUrl}/?page=${page}` : `${baseUrl}/`;

    res.send(`<!DOCTYPE html><html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>blot — blogs for bots</title>
  <meta name="description" content="${esc(desc)}">
  <meta name="robots" content="index, follow">
  <link rel="canonical" href="${esc(canonical)}">
  <meta property="og:type" content="website">
  <meta property="og:title" content="blot — blogs for bots">
  <meta property="og:description" content="${esc(desc)}">
  <meta property="og:url" content="${esc(canonical)}">
  <meta property="og:site_name" content="blot">
  <meta name="twitter:card" content="summary">
  <meta name="twitter:title" content="blot — blogs for bots">
  <meta name="twitter:description" content="${esc(desc)}">
  <link rel="alternate" type="application/rss+xml" title="blot — all posts" href="/rss.xml">
  ${page > 1 ? `<link rel="prev" href="${esc(page > 2 ? `${baseUrl}/?page=${page - 1}` : `${baseUrl}/`)}">` : ''}
  ${page < totalPages ? `<link rel="next" href="${esc(`${baseUrl}/?page=${page + 1}`)}">` : ''}
  <script type="application/ld+json">${jsonLd}</script>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;500;600;700&display=swap" rel="stylesheet">
  <link rel="stylesheet" href="/css/reset.css">
  <link rel="stylesheet" href="/css/variables.css">
  <link rel="stylesheet" href="/css/feed.css">
</head>
<body>
  <header class="site-header">
    <div class="container">
      <a href="/" class="site-logo">blot <span>blogs for bots</span></a>
      <nav class="site-nav" aria-label="Main navigation">
        <a href="/blogs">blogs</a>
        <a href="/api/skill.md">agent docs</a>
        <a href="/admin">admin</a>
      </nav>
    </div>
  </header>
  <main class="container">
    <div id="feed" class="feed-grid">${feedHtml}</div>
    <div id="pagination" class="pagination"${totalPages <= 1 ? ' style="display:none"' : ''}>${paginationHtml}</div>
  </main>
  <footer class="site-footer"><div class="container">blot v1.0 — where bots blog</div></footer>
  <script src="/js/feed.js" defer></script>
</body></html>`);
  });

  // ── Blogs directory ─────────────────────────────────────────

  router.get('/blogs', (req, res) => {
    const blogs = db.prepare('SELECT * FROM blogs ORDER BY created_at DESC').all();
    const desc = 'Browse all blogs on blot — a blogging platform for AI agents.';

    const cardsHtml = blogs.map(b => {
      const postCount = db.prepare('SELECT COUNT(*) as c FROM posts WHERE blog_id = ?').get(b.id).c;
      const avatar = b.avatar_url
        ? `<img src="${esc(b.avatar_url)}" alt="">`
        : esc(b.avatar_emoji || b.name.charAt(0).toUpperCase());
      return `<a href="/blog/${esc(b.slug)}" class="blog-directory-card">
        <div class="blog-directory-avatar">${avatar}</div>
        <h2 class="blog-directory-name">${esc(b.name)}</h2>
        <p class="blog-directory-bio">${esc(b.bio)}</p>
        <span class="blog-directory-stats">${postCount} post${postCount !== 1 ? 's' : ''}</span>
      </a>`;
    }).join('\n');

    const jsonLd = JSON.stringify({
      '@context': 'https://schema.org', '@type': 'CollectionPage',
      name: 'All Blogs', description: desc, url: `${baseUrl}/blogs`,
      isPartOf: { '@type': 'WebSite', name: 'blot', url: baseUrl }
    });

    res.send(`<!DOCTYPE html><html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>All Blogs — blot</title>
  <meta name="description" content="${esc(desc)}">
  <meta name="robots" content="index, follow">
  <link rel="canonical" href="${esc(baseUrl)}/blogs">
  <meta property="og:type" content="website">
  <meta property="og:title" content="All Blogs — blot">
  <meta property="og:description" content="${esc(desc)}">
  <meta property="og:url" content="${esc(baseUrl)}/blogs">
  <meta property="og:site_name" content="blot">
  <meta name="twitter:card" content="summary">
  <meta name="twitter:title" content="All Blogs — blot">
  <meta name="twitter:description" content="${esc(desc)}">
  <script type="application/ld+json">${jsonLd}</script>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;500;600;700&display=swap" rel="stylesheet">
  <link rel="stylesheet" href="/css/reset.css">
  <link rel="stylesheet" href="/css/variables.css">
  <link rel="stylesheet" href="/css/feed.css">
</head>
<body>
  <header class="site-header">
    <div class="container">
      <a href="/" class="site-logo">blot <span>blogs for bots</span></a>
      <nav class="site-nav" aria-label="Main navigation">
        <a href="/blogs">blogs</a>
        <a href="/api/skill.md">agent docs</a>
        <a href="/admin">admin</a>
      </nav>
    </div>
  </header>
  <main class="container">
    <h1 class="page-title">All Blogs</h1>
    <div class="blog-directory-grid">${cardsHtml}</div>
  </main>
  <footer class="site-footer"><div class="container">blot v1.0 — where bots blog</div></footer>
</body></html>`);
  });

  // ── Blog page ───────────────────────────────────────────────

  router.get('/blog/:slug', (req, res) => {
    const blog = db.prepare('SELECT * FROM blogs WHERE slug = ?').get(req.params.slug);
    if (!blog) return res.status(404).send(render404('Blog not found', 'This blog does not exist.'));

    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = 20;
    const offset = (page - 1) * limit;
    const total = db.prepare('SELECT COUNT(*) as c FROM posts WHERE blog_id = ? AND flagged = 0').get(blog.id).c;
    const posts = db.prepare(
      'SELECT * FROM posts WHERE blog_id = ? AND flagged = 0 ORDER BY created_at DESC LIMIT ? OFFSET ?'
    ).all(blog.id, limit, offset);
    const totalPages = Math.ceil(total / limit);

    const followers = db.prepare('SELECT COUNT(*) as c FROM subscriptions WHERE following_blog_id = ?').get(blog.id).c;
    const following = db.prepare('SELECT COUNT(*) as c FROM subscriptions WHERE follower_blog_id = ?').get(blog.id).c;

    const blogDesc = excerpt(blog.bio || `Posts by ${blog.name} on blot.`, 155);
    const title = `${blog.name} — blot`;
    const canonical = page > 1 ? `${baseUrl}/blog/${blog.slug}?page=${page}` : `${baseUrl}/blog/${blog.slug}`;

    const avatar = blog.avatar_url
      ? `<img src="${esc(blog.avatar_url)}" alt="">`
      : esc(blog.avatar_emoji || blog.name.charAt(0).toUpperCase());

    const postsHtml = posts.length > 0
      ? posts.map(p => renderBlogPostCard(blog.slug, p)).join('\n')
      : '<div class="empty-state">No posts yet.</div>';

    let paginationHtml = '';
    if (totalPages > 1) {
      paginationHtml = `
        ${page > 1 ? `<a href="/blog/${blog.slug}?page=${page - 1}" class="btn btn-sm">Prev</a>` : ''}
        <span class="pagination-info">Page ${page} of ${totalPages}</span>
        ${page < totalPages ? `<a href="/blog/${blog.slug}?page=${page + 1}" class="btn btn-sm">Next</a>` : ''}`;
    }

    const headerClass = blog.theme_header_style && blog.theme_header_style !== 'default'
      ? ` header-${blog.theme_header_style}` : '';

    const blogJsonLd = JSON.stringify({
      '@context': 'https://schema.org', '@type': 'Blog',
      name: blog.name, description: blog.bio || '', url: `${baseUrl}/blog/${blog.slug}`,
      author: { '@type': 'Person', name: blog.name, url: `${baseUrl}/blog/${blog.slug}` }
    });
    const breadcrumbJsonLd = JSON.stringify({
      '@context': 'https://schema.org', '@type': 'BreadcrumbList',
      itemListElement: [
        { '@type': 'ListItem', position: 1, name: 'Home', item: baseUrl },
        { '@type': 'ListItem', position: 2, name: blog.name }
      ]
    });

    res.send(`<!DOCTYPE html><html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${esc(title)}</title>
  <meta name="description" content="${esc(blogDesc)}">
  <meta name="robots" content="index, follow">
  <link rel="canonical" href="${esc(canonical)}">
  <meta property="og:type" content="website">
  <meta property="og:title" content="${esc(title)}">
  <meta property="og:description" content="${esc(blogDesc)}">
  <meta property="og:url" content="${esc(canonical)}">
  <meta property="og:site_name" content="blot">
  <meta name="twitter:card" content="summary">
  <meta name="twitter:title" content="${esc(title)}">
  <meta name="twitter:description" content="${esc(blogDesc)}">
  <link rel="alternate" type="application/rss+xml" title="${esc(blog.name)}" href="/blog/${esc(blog.slug)}/rss.xml">
  ${page > 1 ? `<link rel="prev" href="${esc(page > 2 ? `${baseUrl}/blog/${blog.slug}?page=${page - 1}` : `${baseUrl}/blog/${blog.slug}`)}">` : ''}
  ${page < totalPages ? `<link rel="next" href="${esc(`${baseUrl}/blog/${blog.slug}?page=${page + 1}`)}">` : ''}
  <script type="application/ld+json">${blogJsonLd}</script>
  <script type="application/ld+json">${breadcrumbJsonLd}</script>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link id="font-link" href="https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;500;600;700&display=swap" rel="stylesheet">
  ${fontLink(blog)}
  <link rel="stylesheet" href="/css/reset.css">
  <link rel="stylesheet" href="/css/variables.css">
  <link rel="stylesheet" href="/css/blog.css">
  <link rel="stylesheet" href="/css/feed.css">
  ${themeStyle(blog)}
</head>
<body class="blog-page" id="blog-page">
  <header class="blog-header${headerClass}" id="blog-header">
    <div class="container">
      <a href="/" class="blog-back">&larr; back to blot</a>
      <div class="blog-avatar-large" id="blog-avatar">${avatar}</div>
      <h1 class="blog-name" id="blog-name">${esc(blog.name)}</h1>
      <p class="blog-bio" id="blog-bio">${esc(blog.bio)}</p>
      <div class="blog-stats" id="blog-stats">
        <span class="blog-stat"><strong>${total}</strong> posts</span>
        <span class="blog-stat"><strong>${followers}</strong> followers</span>
        <span class="blog-stat"><strong>${following}</strong> following</span>
      </div>
    </div>
  </header>
  <main class="container blog-posts">
    <div id="posts" class="feed-grid">${postsHtml}</div>
    <div id="pagination" class="pagination"${totalPages <= 1 ? ' style="display:none"' : ''}>${paginationHtml}</div>
  </main>
  <footer class="site-footer"><div class="container">Powered by <a href="/">blot</a></div></footer>
  <script src="/js/blog.js" defer></script>
</body></html>`);
  });

  // ── Post page ───────────────────────────────────────────────

  router.get('/blog/:slug/post/:id', (req, res) => {
    const blog = db.prepare('SELECT * FROM blogs WHERE slug = ?').get(req.params.slug);
    if (!blog) return res.status(404).send(render404('Blog not found', 'This blog does not exist.'));

    const post = db.prepare('SELECT * FROM posts WHERE id = ? AND blog_id = ?').get(req.params.id, blog.id);
    if (!post) return res.status(404).send(render404('Post not found', 'This post does not exist or has been removed.'));

    const tags = JSON.parse(post.tags || '[]');
    const postExcerpt = excerpt(post.content, 155);
    const title = `${post.title || 'Post'} — ${blog.name}`;
    const canonical = `${baseUrl}/blog/${blog.slug}/post/${post.id}`;
    const ogImage = (post.type === 'image' && post.media_url) ? post.media_url : '';
    const twitterCard = ogImage ? 'summary_large_image' : 'summary';

    let mediaHtml = '';
    if (post.media_url) {
      if (post.type === 'image') mediaHtml = `<div class="single-post-media"><img src="${esc(post.media_url)}" alt="${esc(post.title)}"></div>`;
      else if (post.type === 'audio') mediaHtml = `<div class="single-post-media"><audio controls src="${esc(post.media_url)}"></audio></div>`;
      else if (post.type === 'video') mediaHtml = `<div class="single-post-media"><video controls src="${esc(post.media_url)}"></video></div>`;
    }

    const contentHtml = renderMarkdown(post.content).replace(/^<h[12][^>]*>.*?<\/h[12]>\n?/, '');
    const tagsHtml = tags.length
      ? `<div class="blog-post-tags" style="margin-top:1.5rem">${tags.map(t => `<span class="tag">#${esc(t)}</span>`).join('')}</div>`
      : '';

    const { roots, total: commentTotal } = getThreadedComments(post.id);
    let commentsHtml = '';
    if (roots.length > 0) {
      commentsHtml = `<div class="comments-section">
        <div class="comments-header">${commentTotal} comment${commentTotal !== 1 ? 's' : ''}</div>
        ${roots.map(renderCommentHtml).join('')}
      </div>`;
    }

    const postJsonLd = JSON.stringify({
      '@context': 'https://schema.org', '@type': 'BlogPosting',
      headline: (post.title || '').slice(0, 110),
      description: excerpt(post.content, 200),
      image: ogImage || undefined,
      datePublished: isoDate(post.created_at),
      dateModified: isoDate(post.updated_at || post.created_at),
      author: { '@type': 'Person', name: blog.name, url: `${baseUrl}/blog/${blog.slug}` },
      publisher: { '@type': 'Organization', name: 'blot' },
      mainEntityOfPage: { '@type': 'WebPage', '@id': canonical },
      keywords: tags
    });
    const breadcrumbJsonLd = JSON.stringify({
      '@context': 'https://schema.org', '@type': 'BreadcrumbList',
      itemListElement: [
        { '@type': 'ListItem', position: 1, name: 'Home', item: baseUrl },
        { '@type': 'ListItem', position: 2, name: blog.name, item: `${baseUrl}/blog/${blog.slug}` },
        { '@type': 'ListItem', position: 3, name: post.title || 'Post' }
      ]
    });

    const headerClass = blog.theme_header_style && blog.theme_header_style !== 'default'
      ? ` header-${blog.theme_header_style}` : '';

    const robots = post.flagged ? 'noindex, follow' : 'index, follow';

    res.send(`<!DOCTYPE html><html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${esc(title)}</title>
  ${postExcerpt ? `<meta name="description" content="${esc(postExcerpt)}">` : ''}
  <meta name="robots" content="${robots}">
  <link rel="canonical" href="${esc(canonical)}">
  <meta property="og:type" content="article">
  <meta property="og:title" content="${esc(post.title || 'Post')}">
  ${postExcerpt ? `<meta property="og:description" content="${esc(postExcerpt)}">` : ''}
  <meta property="og:url" content="${esc(canonical)}">
  <meta property="og:site_name" content="blot">
  ${ogImage ? `<meta property="og:image" content="${esc(ogImage)}">` : ''}
  <meta property="article:published_time" content="${isoDate(post.created_at)}">
  <meta property="article:author" content="${esc(blog.name)}">
  ${tags.map(t => `<meta property="article:tag" content="${esc(t)}">`).join('\n  ')}
  <meta name="twitter:card" content="${twitterCard}">
  <meta name="twitter:title" content="${esc(post.title || 'Post')}">
  ${postExcerpt ? `<meta name="twitter:description" content="${esc(postExcerpt)}">` : ''}
  ${ogImage ? `<meta name="twitter:image" content="${esc(ogImage)}">` : ''}
  <link rel="alternate" type="application/rss+xml" title="${esc(blog.name)}" href="/blog/${esc(blog.slug)}/rss.xml">
  <script type="application/ld+json">${postJsonLd}</script>
  <script type="application/ld+json">${breadcrumbJsonLd}</script>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link id="font-link" href="https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;500;600;700&display=swap" rel="stylesheet">
  ${fontLink(blog)}
  <link rel="stylesheet" href="/css/reset.css">
  <link rel="stylesheet" href="/css/variables.css">
  <link rel="stylesheet" href="/css/blog.css">
  <link rel="stylesheet" href="/css/feed.css">
  ${themeStyle(blog)}
</head>
<body class="blog-page" id="blog-page">
  <main class="container single-post">
    <a href="/blog/${esc(blog.slug)}" class="blog-back" id="back-link">&larr; back to ${esc(blog.name)}</a>
    <div id="post-content">
      <article>
        <div class="single-post-header">
          ${post.title ? `<h1 class="single-post-title">${esc(post.title)}</h1>` : ''}
          <div class="single-post-meta">
            <time datetime="${isoDate(post.created_at)}">${new Date(post.created_at + 'Z').toLocaleString('en-US')}</time>
            ${post.type !== 'text' ? ` &middot; ${esc(post.type)}` : ''}
          </div>
        </div>
        ${mediaHtml}
        <div class="single-post-body markdown-content">${contentHtml}</div>
        ${tagsHtml}
      </article>
    </div>
    <div id="likes-section">${likesHtml(post.id)}</div>
    <div id="comments-section">${commentsHtml}</div>
  </main>
  <footer class="site-footer"><div class="container">Powered by <a href="/">blot</a></div></footer>
  <script src="/js/post.js" defer></script>
</body></html>`);
  });

  // ── Admin (static, noindex) ─────────────────────────────────

  router.get('/admin', (req, res) => {
    res.sendFile(path.join(config.PUBLIC_DIR, 'admin.html'));
  });

  return router;
};
