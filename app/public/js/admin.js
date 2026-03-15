(function () {
  'use strict';

  let adminKey = localStorage.getItem('blot_admin_key') || '';
  const keyInput = document.getElementById('admin-key');
  const authBtn = document.getElementById('auth-btn');
  const mainEl = document.getElementById('admin-main');

  keyInput.value = adminKey;

  authBtn.addEventListener('click', connect);
  keyInput.addEventListener('keydown', function (e) { if (e.key === 'Enter') connect(); });

  // Tab switching
  document.querySelectorAll('.admin-tab').forEach(function (tab) {
    tab.addEventListener('click', function () {
      document.querySelectorAll('.admin-tab').forEach(function (t) { t.classList.remove('active'); });
      document.querySelectorAll('.admin-section').forEach(function (s) { s.classList.remove('active'); });
      tab.classList.add('active');
      document.getElementById('section-' + tab.dataset.tab).classList.add('active');
    });
  });

  if (adminKey) connect();

  function connect() {
    adminKey = keyInput.value.trim();
    if (!adminKey) return;
    localStorage.setItem('blot_admin_key', adminKey);
    loadAll();
  }

  function headers() {
    return { Authorization: 'Bearer ' + adminKey, 'Content-Type': 'application/json' };
  }

  async function apiFetch(url, opts) {
    const res = await fetch(url, Object.assign({ headers: headers() }, opts || {}));
    if (res.status === 401) {
      mainEl.style.display = 'none';
      alert('Invalid admin key');
      throw new Error('Unauthorized');
    }
    return res.json();
  }

  async function loadAll() {
    try {
      await Promise.all([loadStats(), loadBlogs(), loadPosts(), loadFlagged(), loadActions()]);
      mainEl.style.display = 'block';
    } catch (e) {
      console.error(e);
    }
  }

  async function loadStats() {
    const data = await apiFetch('/api/admin/stats');
    document.getElementById('stats-grid').innerHTML = [
      stat(data.blogs, 'Blogs'), stat(data.posts, 'Posts'),
      stat(data.flagged, 'Flagged'), stat(data.subscriptions, 'Subscriptions'),
      stat(data.today.posts, 'Posts Today'), stat(data.today.blogs, 'Blogs Today')
    ].join('');
  }

  function stat(value, label) {
    return '<div class="stat-card"><div class="stat-value">' + value + '</div><div class="stat-label">' + label + '</div></div>';
  }

  async function loadBlogs() {
    const data = await apiFetch('/api/admin/blogs');
    var tbody = document.querySelector('#blogs-table tbody');
    tbody.innerHTML = data.blogs.map(function (b) {
      return '<tr>' +
        '<td><strong>' + esc(b.name) + '</strong></td>' +
        '<td><a href="/blog/' + esc(b.slug) + '">' + esc(b.slug) + '</a></td>' +
        '<td>' + b.post_count + '</td>' +
        '<td>' + b.follower_count + '</td>' +
        '<td>' + shortDate(b.created_at) + '</td>' +
        '<td class="actions"><button class="btn btn-danger btn-sm" onclick="BlotAdmin.deleteBlog(\'' + esc(b.slug) + '\')">Delete</button></td>' +
        '</tr>';
    }).join('');
  }

  async function loadPosts() {
    const data = await apiFetch('/api/admin/posts');
    var tbody = document.querySelector('#posts-table tbody');
    tbody.innerHTML = data.posts.map(function (p) {
      return '<tr>' +
        '<td>' + p.id + '</td>' +
        '<td><a href="/blog/' + esc(p.blog_slug) + '">' + esc(p.blog_name) + '</a></td>' +
        '<td>' + esc(p.type) + '</td>' +
        '<td class="text-truncate">' + esc(p.title || '(untitled)') + '</td>' +
        '<td>' + (p.flagged ? '<span class="badge badge-danger">flagged</span>' : '<span class="text-muted">ok</span>') + '</td>' +
        '<td>' + shortDate(p.created_at) + '</td>' +
        '<td class="actions">' +
          (p.flagged
            ? '<button class="btn btn-sm" onclick="BlotAdmin.unflagPost(' + p.id + ')">Unflag</button>'
            : '<button class="btn btn-sm" onclick="BlotAdmin.flagPost(' + p.id + ')">Flag</button>') +
          ' <button class="btn btn-danger btn-sm" onclick="BlotAdmin.deletePost(' + p.id + ')">Delete</button>' +
        '</td></tr>';
    }).join('');
  }

  async function loadFlagged() {
    const data = await apiFetch('/api/admin/posts?flagged=true');
    var tbody = document.querySelector('#flagged-table tbody');
    if (data.posts.length === 0) {
      tbody.innerHTML = '<tr><td colspan="7" class="text-muted" style="text-align:center;padding:2rem">No flagged posts</td></tr>';
      return;
    }
    tbody.innerHTML = data.posts.map(function (p) {
      return '<tr>' +
        '<td>' + p.id + '</td>' +
        '<td><a href="/blog/' + esc(p.blog_slug) + '">' + esc(p.blog_name) + '</a></td>' +
        '<td>' + esc(p.type) + '</td>' +
        '<td>' + esc(p.title || '(untitled)') + '</td>' +
        '<td class="text-truncate">' + esc(p.content) + '</td>' +
        '<td>' + shortDate(p.created_at) + '</td>' +
        '<td class="actions">' +
          '<button class="btn btn-sm" onclick="BlotAdmin.unflagPost(' + p.id + ')">Unflag</button>' +
          ' <button class="btn btn-danger btn-sm" onclick="BlotAdmin.deletePost(' + p.id + ')">Delete</button>' +
        '</td></tr>';
    }).join('');
  }

  async function loadActions() {
    const data = await apiFetch('/api/admin/actions');
    var tbody = document.querySelector('#actions-table tbody');
    if (data.actions.length === 0) {
      tbody.innerHTML = '<tr><td colspan="5" class="text-muted" style="text-align:center;padding:2rem">No actions yet</td></tr>';
      return;
    }
    tbody.innerHTML = data.actions.map(function (a) {
      return '<tr>' +
        '<td>' + esc(a.action) + '</td>' +
        '<td>' + esc(a.target_type) + ' #' + a.target_id + '</td>' +
        '<td>' + esc(a.admin_key_prefix) + '</td>' +
        '<td class="text-truncate">' + esc(a.details) + '</td>' +
        '<td>' + shortDate(a.created_at) + '</td>' +
        '</tr>';
    }).join('');
  }

  // Admin actions
  async function flagPost(id) {
    await apiFetch('/api/admin/posts/' + id + '/flag', { method: 'POST' });
    loadAll();
  }

  async function unflagPost(id) {
    await apiFetch('/api/admin/posts/' + id + '/unflag', { method: 'POST' });
    loadAll();
  }

  async function deletePost(id) {
    if (!confirm('Delete post #' + id + '?')) return;
    await apiFetch('/api/admin/posts/' + id, { method: 'DELETE' });
    loadAll();
  }

  async function deleteBlog(slug) {
    if (!confirm('Delete blog "' + slug + '" and all its posts?')) return;
    await apiFetch('/api/admin/blogs/' + slug, { method: 'DELETE' });
    loadAll();
  }

  function shortDate(dateStr) {
    return new Date(dateStr + 'Z').toLocaleDateString();
  }

  function esc(str) {
    if (!str) return '';
    var d = document.createElement('div');
    d.textContent = str;
    return d.innerHTML;
  }

  window.BlotAdmin = { flagPost: flagPost, unflagPost: unflagPost, deletePost: deletePost, deleteBlog: deleteBlog };
})();
