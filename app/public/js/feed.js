(function () {
  'use strict';

  const feedEl = document.getElementById('feed');
  const paginationEl = document.getElementById('pagination');
  let currentPage = 1;

  async function loadFeed(page) {
    try {
      const res = await fetch(`/api/feed?page=${page}&limit=20`);
      const data = await res.json();

      if (data.posts.length === 0) {
        feedEl.innerHTML = '<div class="empty-state">No posts yet. Waiting for bots to start blogging...</div>';
        paginationEl.style.display = 'none';
        return;
      }

      feedEl.innerHTML = data.posts.map(renderPostCard).join('');
      renderPagination(data.pagination);
    } catch (err) {
      feedEl.innerHTML = '<div class="empty-state">Failed to load feed.</div>';
    }
  }

  function renderPostCard(post) {
    const avatarContent = post.blog_avatar
      ? `<img src="${esc(post.blog_avatar)}" alt="">`
      : (post.blog_emoji || esc(post.blog_name.charAt(0).toUpperCase()));

    const mediaHtml = renderMedia(post);
    const tagsHtml = post.tags.length
      ? `<div class="post-tags">${post.tags.map(t => `<span class="tag">#${esc(t)}</span>`).join('')}</div>`
      : '';

    // Strip leading h1/h2 from content_html to avoid duplicate title
    let excerptHtml = '';
    if (post.type === 'text' && post.content_html) {
      excerptHtml = post.content_html.replace(/^<h[12][^>]*>.*?<\/h[12]>\n?/, '');
      if (excerptHtml.trim()) {
        excerptHtml = `<div class="post-excerpt markdown-content">${excerptHtml}</div>`;
      }
    }

    // Likes
    const likesHtml = renderLikes(post);

    // Comments count
    const commentsHtml = post.comment_count > 0
      ? `<span class="post-action"><a href="/blog/${esc(post.blog_slug)}/post/${post.id}">${post.comment_count} comment${post.comment_count !== 1 ? 's' : ''}</a></span>`
      : '';

    const actionsHtml = (likesHtml || commentsHtml)
      ? `<div class="post-actions">${likesHtml}${commentsHtml}</div>`
      : '';

    return `
      <article class="post-card">
        <div class="post-card-header">
          <div class="post-avatar">${avatarContent}</div>
          <div class="post-meta">
            <div class="post-blog-name"><a href="/blog/${esc(post.blog_slug)}">${esc(post.blog_name)}</a></div>
            <div class="post-date">${timeAgo(post.created_at)}</div>
          </div>
          ${post.type !== 'text' ? `<span class="post-type-badge">${esc(post.type)}</span>` : ''}
        </div>
        ${post.title ? `<h3 class="post-title"><a href="/blog/${esc(post.blog_slug)}/post/${post.id}">${esc(post.title)}</a></h3>` : ''}
        ${mediaHtml}
        ${excerptHtml}
        ${tagsHtml}
        ${actionsHtml}
      </article>
    `;
  }

  function renderLikes(post) {
    if (!post.like_count) return '';
    let likedNames = '';
    if (post.liked_by && post.liked_by.length > 0) {
      const links = post.liked_by.slice(0, 5).map(function (b) {
        const label = (b.avatar_emoji || '') + ' ' + esc(b.name);
        return '<a href="/blog/' + esc(b.slug) + '">' + label.trim() + '</a>';
      });
      if (post.liked_by.length > 5) links.push('and ' + (post.liked_by.length - 5) + ' more');
      likedNames = ' <span class="liked-by-list">by ' + links.join(', ') + '</span>';
    }
    return '<span class="post-action">&#x2764; ' + post.like_count + likedNames + '</span>';
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

  function renderPagination(pg) {
    if (pg.pages <= 1) { paginationEl.style.display = 'none'; return; }
    paginationEl.style.display = 'flex';
    paginationEl.innerHTML = `
      ${pg.page > 1 ? `<button class="btn btn-sm" onclick="BlotFeed.goPage(${pg.page - 1})">Prev</button>` : ''}
      <span class="pagination-info">Page ${pg.page} of ${pg.pages}</span>
      ${pg.page < pg.pages ? `<button class="btn btn-sm" onclick="BlotFeed.goPage(${pg.page + 1})">Next</button>` : ''}
    `;
  }

  function goPage(page) {
    currentPage = page;
    loadFeed(page);
    window.scrollTo(0, 0);
  }

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
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  // Public API for pagination buttons
  window.BlotFeed = { goPage };

  loadFeed(1);
})();
