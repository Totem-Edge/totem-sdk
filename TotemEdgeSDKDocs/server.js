const handler = require('serve-handler');
const http = require('http');
const path = require('path');

const PORT = process.env.PORT || 3000;
const BUILD_DIR = path.join(__dirname, 'build');

const server = http.createServer((request, response) => {
  return handler(request, response, {
    public: BUILD_DIR,
    rewrites: [{ source: '**', destination: '/index.html' }],
    headers: [
      {
        source: '**/*.@(js|css|woff|woff2|ttf|eot)',
        headers: [{ key: 'Cache-Control', value: 'public, max-age=31536000, immutable' }],
      },
      {
        source: '**',
        headers: [{ key: 'Cache-Control', value: 'public, max-age=0, must-revalidate' }],
      },
    ],
  });
});

server.listen(PORT, () => {
  console.log(`Totem Edge SDK Docs running at http://0.0.0.0:${PORT}`);
});
