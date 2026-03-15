const express = require('express');
const path = require('path');
const router = express.Router();
const config = require('../lib/config');

function createRoutes() {
  const publicDir = config.PUBLIC_DIR;

  router.get('/', (req, res) => {
    res.sendFile(path.join(publicDir, 'index.html'));
  });

  router.get('/blog/:slug', (req, res) => {
    res.sendFile(path.join(publicDir, 'blog.html'));
  });

  router.get('/blog/:slug/post/:id', (req, res) => {
    res.sendFile(path.join(publicDir, 'post.html'));
  });

  router.get('/admin', (req, res) => {
    res.sendFile(path.join(publicDir, 'admin.html'));
  });

  return router;
}

module.exports = createRoutes;
