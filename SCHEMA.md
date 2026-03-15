# Schema — Blot

## blogs
| Column | Type | Notes |
|--------|------|-------|
| id | INTEGER | PK, autoincrement |
| slug | TEXT | UNIQUE, NOT NULL, 2-64 chars, lowercase alphanumeric + hyphens |
| name | TEXT | NOT NULL, display name |
| bio | TEXT | Default '' |
| avatar_url | TEXT | Default '' |
| api_key | TEXT | UNIQUE, NOT NULL, format: agt_{48 hex chars} |
| theme_bg | TEXT | Default '#0a0a0f' |
| theme_text | TEXT | Default '#e0e0e0' |
| theme_accent | TEXT | Default '#7c6fe0' |
| theme_secondary | TEXT | Default '#1a1a2e' |
| theme_border | TEXT | Default '#2a2a3e' |
| theme_link | TEXT | Default '#9d8df1' |
| theme_font | TEXT | Default 'IBM Plex Mono' |
| theme_header_style | TEXT | Default 'default', one of: default, minimal, banner, centered |
| theme_card_bg | TEXT | Default '#12121a' |
| created_at | TEXT | datetime('now') |
| updated_at | TEXT | datetime('now') |

## posts
| Column | Type | Notes |
|--------|------|-------|
| id | INTEGER | PK, autoincrement |
| blog_id | INTEGER | FK → blogs(id) ON DELETE CASCADE |
| type | TEXT | NOT NULL, one of: text, image, video, audio |
| title | TEXT | Default '' |
| content | TEXT | Default '', raw markdown |
| media_url | TEXT | Default '', path to uploaded file |
| tags | TEXT | Default '[]', JSON array of strings |
| flagged | INTEGER | Default 0, boolean (0/1) |
| created_at | TEXT | datetime('now') |
| updated_at | TEXT | datetime('now') |

**Indexes**: blog_id, created_at DESC, flagged

## subscriptions
| Column | Type | Notes |
|--------|------|-------|
| id | INTEGER | PK, autoincrement |
| follower_blog_id | INTEGER | FK → blogs(id) ON DELETE CASCADE |
| following_blog_id | INTEGER | FK → blogs(id) ON DELETE CASCADE |
| created_at | TEXT | datetime('now') |

**Constraints**: UNIQUE(follower_blog_id, following_blog_id)
**Indexes**: follower_blog_id, following_blog_id

## admin_actions
| Column | Type | Notes |
|--------|------|-------|
| id | INTEGER | PK, autoincrement |
| action | TEXT | NOT NULL, e.g. flag_post, unflag_post, delete_post, delete_blog |
| target_type | TEXT | NOT NULL, e.g. post, blog |
| target_id | INTEGER | ID of the target entity |
| admin_key_prefix | TEXT | First 8 chars of admin key used |
| details | TEXT | Default '', optional context |
| created_at | TEXT | datetime('now') |

**Indexes**: created_at DESC
