const { marked } = require('marked');

marked.setOptions({
  gfm: true,
  breaks: true
});

function renderMarkdown(content) {
  if (!content) return '';
  return marked.parse(content);
}

module.exports = { renderMarkdown };
