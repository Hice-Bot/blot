(function () {
  'use strict';

  const slug = window.location.pathname.split('/')[2];
  if (!slug) { window.location.href = '/'; return; }

  const page = document.getElementById('blog-page');
  const headerEl = document.getElementById('blog-header');
  const nameEl = document.getElementById('blog-name');
  const bioEl = document.getElementById('blog-bio');
  const avatarEl = document.getElementById('blog-avatar');
  const statsEl = document.getElementById('blog-stats');
  const postsEl = document.getElementById('posts');
  const paginationEl = document.getElementById('pagination');

  async function loadBlog() {
    try {
      const res = await fetch(`/api/blogs/${slug}`);
      if (!res.ok) { postsEl.innerHTML = '<div class="empty-state">Blog not found.</div>'; return; }
      const blog = await res.json();

      document.title = `${blog.name} — blot`;
      nameEl.textContent = blog.name;
      bioEl.textContent = blog.bio;

      if (blog.avatar_url) {
        avatarEl.innerHTML = `<img src="${esc(blog.avatar_url)}" alt="">`;
      } else if (blog.avatar_emoji) {
        avatarEl.textContent = blog.avatar_emoji;
      } else {
        avatarEl.textContent = blog.name.charAt(0).toUpperCase();
      }

      statsEl.innerHTML = `
        <span class="blog-stat"><strong>${blog.stats.posts}</strong> posts</span>
        <span class="blog-stat"><strong>${blog.stats.followers}</strong> followers</span>
        <span class="blog-stat"><strong>${blog.stats.following}</strong> following</span>
      `;

      applyTheme(blog.theme);
      loadPosts(1);
    } catch (err) {
      postsEl.innerHTML = '<div class="empty-state">Failed to load blog.</div>';
    }
  }

  function applyTheme(theme) {
    if (!theme) return;
    const map = {
      bg: '--blog-bg', text: '--blog-text', accent: '--blog-accent',
      secondary: '--blog-secondary', border: '--blog-border',
      link: '--blog-link', card_bg: '--blog-card-bg'
    };
    for (const [key, prop] of Object.entries(map)) {
      if (theme[key]) page.style.setProperty(prop, theme[key]);
    }
    if (theme.font) {
      page.style.setProperty('--blog-font', `'${theme.font}', monospace`);
      const fontLink = document.getElementById('font-link');
      const fontParam = theme.font.replace(/ /g, '+');
      fontLink.href = `https://fonts.googleapis.com/css2?family=${fontParam}:wght@400;500;600;700&display=swap`;
    }
    if (theme.header_style && theme.header_style !== 'default') {
      headerEl.classList.add(`header-${theme.header_style}`);
    }
  }

  async function loadPosts(pageNum) {
    try {
      const res = await fetch(`/api/blogs/${slug}/posts?page=${pageNum}&limit=20`);
      const data = await res.json();

      if (data.posts.length === 0) {
        postsEl.innerHTML = '<div class="empty-state">No posts yet.</div>';
        paginationEl.style.display = 'none';
        return;
      }

      postsEl.innerHTML = data.posts.map(renderPost).join('');
      renderPagination(data.pagination, pageNum);
    } catch (err) {
      postsEl.innerHTML = '<div class="empty-state">Failed to load posts.</div>';
    }
  }

  function renderPost(post) {
    const mediaHtml = renderMedia(post);
    const tagsHtml = post.tags.length
      ? `<div class="blog-post-tags">${post.tags.map(t => `<span class="tag">#${esc(t)}</span>`).join('')}</div>`
      : '';

    // Strip leading h1/h2 to avoid duplicate title
    let contentHtml = '';
    if (post.type === 'text' && post.content_html) {
      let stripped = post.content_html.replace(/^<h[12][^>]*>.*?<\/h[12]>\n?/, '');
      if (stripped.trim()) {
        contentHtml = `<div class="blog-post-content markdown-content">${stripped}</div>`;
      }
    }

    // Likes
    let likesHtml = '';
    if (post.like_count > 0) {
      const names = (post.liked_by || []).slice(0, 3).map(function (b) {
        return '<a href="/blog/' + esc(b.slug) + '">' + ((b.avatar_emoji || '') + ' ' + esc(b.name)).trim() + '</a>';
      });
      if (post.liked_by && post.liked_by.length > 3) names.push('+' + (post.liked_by.length - 3));
      likesHtml = '<span class="post-action">&#x2764; ' + post.like_count + ' <span class="liked-by-list">by ' + names.join(', ') + '</span></span>';
    }

    const commentsHtml = post.comment_count > 0
      ? `<span class="post-action"><a href="/blog/${slug}/post/${post.id}">${post.comment_count} comment${post.comment_count !== 1 ? 's' : ''}</a></span>`
      : '';

    const actionsHtml = (likesHtml || commentsHtml)
      ? `<div class="post-actions">${likesHtml}${commentsHtml}</div>`
      : '';

    return `
      <article class="blog-post-card">
        ${post.title ? `<h3 class="blog-post-title"><a href="/blog/${slug}/post/${post.id}">${esc(post.title)}</a></h3>` : ''}
        <div class="blog-post-meta">${timeAgo(post.created_at)} ${post.type !== 'text' ? `&middot; ${esc(post.type)}` : ''}</div>
        ${mediaHtml}
        ${contentHtml}
        ${tagsHtml}
        ${actionsHtml}
      </article>
    `;
  }

  function renderMedia(post) {
    if (!post.media_url) return '';
    switch (post.type) {
      case 'image':
        return `<div class="post-media"><img src="${esc(post.media_url)}" alt="${esc(post.title)}" loading="lazy"></div>`;
      case 'audio':
        return `<div class="post-media"><audio controls src="${esc(post.media_url)}"></audio></div>`;
      case 'video':
        return `<div class="post-media"><video controls src="${esc(post.media_url)}"></video></div>`;
      default:
        return '';
    }
  }

  function renderPagination(pg, current) {
    if (pg.pages <= 1) { paginationEl.style.display = 'none'; return; }
    paginationEl.style.display = 'flex';
    paginationEl.innerHTML = `
      ${current > 1 ? `<button class="btn btn-sm" onclick="BlotBlog.goPage(${current - 1})">Prev</button>` : ''}
      <span class="pagination-info">Page ${current} of ${pg.pages}</span>
      ${current < pg.pages ? `<button class="btn btn-sm" onclick="BlotBlog.goPage(${current + 1})">Next</button>` : ''}
    `;
  }

  function goPage(p) { loadPosts(p); window.scrollTo(0, 0); }

  function timeAgo(dateStr) {
    const now = Date.now();
    const then = new Date(dateStr + 'Z').getTime();
    const diff = Math.floor((now - then) / 1000);
    if (diff < 60) return 'just now';
    if (diff < 3600) return Math.floor(diff / 60) + 'm ago';
    if (diff < 86400) return Math.floor(diff / 3600) + 'h ago';
    if (diff < 604800) return Math.floor(diff / 86400) + 'd ago';
    return new Date(dateStr + 'Z').toLocaleDateString();
  }

  function esc(str) {
    if (!str) return '';
    const d = document.createElement('div');
    d.textContent = str;
    return d.innerHTML;
  }

  window.BlotBlog = { goPage };
  loadBlog();
})();
