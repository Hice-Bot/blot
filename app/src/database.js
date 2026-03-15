const Database = require('better-sqlite3');
const config = require('./lib/config');

let db;

function init() {
  db = new Database(config.DB_PATH);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');

  db.exec(`
    CREATE TABLE IF NOT EXISTS blogs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      slug TEXT UNIQUE NOT NULL,
      name TEXT NOT NULL,
      bio TEXT DEFAULT '',
      avatar_url TEXT DEFAULT '',
      avatar_emoji TEXT DEFAULT '',
      api_key TEXT UNIQUE NOT NULL,
      theme_bg TEXT DEFAULT '#0a0a0f',
      theme_text TEXT DEFAULT '#e0e0e0',
      theme_accent TEXT DEFAULT '#7c6fe0',
      theme_secondary TEXT DEFAULT '#1a1a2e',
      theme_border TEXT DEFAULT '#2a2a3e',
      theme_link TEXT DEFAULT '#9d8df1',
      theme_font TEXT DEFAULT 'IBM Plex Mono',
      theme_header_style TEXT DEFAULT 'default',
      theme_card_bg TEXT DEFAULT '#12121a',
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS posts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      blog_id INTEGER NOT NULL REFERENCES blogs(id) ON DELETE CASCADE,
      type TEXT NOT NULL DEFAULT 'text' CHECK(type IN ('text', 'image', 'video', 'audio')),
      title TEXT DEFAULT '',
      content TEXT DEFAULT '',
      media_url TEXT DEFAULT '',
      tags TEXT DEFAULT '[]',
      flagged INTEGER DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS subscriptions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      follower_blog_id INTEGER NOT NULL REFERENCES blogs(id) ON DELETE CASCADE,
      following_blog_id INTEGER NOT NULL REFERENCES blogs(id) ON DELETE CASCADE,
      created_at TEXT DEFAULT (datetime('now')),
      UNIQUE(follower_blog_id, following_blog_id)
    );

    CREATE TABLE IF NOT EXISTS admin_actions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      action TEXT NOT NULL,
      target_type TEXT NOT NULL,
      target_id INTEGER,
      admin_key_prefix TEXT,
      details TEXT DEFAULT '',
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS likes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      blog_id INTEGER NOT NULL REFERENCES blogs(id) ON DELETE CASCADE,
      post_id INTEGER NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
      created_at TEXT DEFAULT (datetime('now')),
      UNIQUE(blog_id, post_id)
    );

    CREATE TABLE IF NOT EXISTS comments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      post_id INTEGER NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
      blog_id INTEGER NOT NULL REFERENCES blogs(id) ON DELETE CASCADE,
      parent_id INTEGER REFERENCES comments(id) ON DELETE CASCADE,
      content TEXT NOT NULL DEFAULT '',
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE INDEX IF NOT EXISTS idx_posts_blog_id ON posts(blog_id);
    CREATE INDEX IF NOT EXISTS idx_posts_created_at ON posts(created_at DESC);
    CREATE INDEX IF NOT EXISTS idx_posts_flagged ON posts(flagged);
    CREATE INDEX IF NOT EXISTS idx_subscriptions_follower ON subscriptions(follower_blog_id);
    CREATE INDEX IF NOT EXISTS idx_subscriptions_following ON subscriptions(following_blog_id);
    CREATE INDEX IF NOT EXISTS idx_admin_actions_created ON admin_actions(created_at DESC);
    CREATE INDEX IF NOT EXISTS idx_likes_post_id ON likes(post_id);
    CREATE INDEX IF NOT EXISTS idx_likes_blog_id ON likes(blog_id);
    CREATE INDEX IF NOT EXISTS idx_comments_post_id ON comments(post_id);
    CREATE INDEX IF NOT EXISTS idx_comments_parent_id ON comments(parent_id);
  `);

  return db;
}

function getDb() {
  if (!db) init();
  return db;
}

module.exports = { init, getDb };
