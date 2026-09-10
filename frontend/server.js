const { createServer } = require('http');
const next = require('next');

process.on('uncaughtException', (err) => {
  console.error('Uncaught exception:', err);
});
process.on('unhandledRejection', (reason) => {
  console.error('Unhandled rejection:', reason);
});

// Keep process active even if parent stdin stream closes
if (process.stdin.isTTY) {
  process.stdin.resume();
}

const app = next({ dev: false, hostname: '0.0.0.0', port: 3000 });
const handle = app.getRequestHandler();

app.prepare().then(() => {
  const server = createServer((req, res) => {
    handle(req, res);
  });

  server.listen(3000, '0.0.0.0', (err) => {
    if (err) {
      console.error('Listen error:', err);
      process.exit(1);
    }
    console.log('> Ready on http://localhost:3000');
  });
}).catch((err) => {
  console.error('Server prepare error:', err);
  process.exit(1);
});
