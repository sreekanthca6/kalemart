const express = require('express');
const config = require('./config');
const errorHandler = require('./middleware/errorHandler');
const requestLogger = require('./middleware/requestLogger');
const authMiddleware = require('./middleware/auth');
const { registerInventoryObservables } = require('./metrics');
const pool = require('./db/pool');
const { migrate } = require('./db/migrate');

const app = express();

app.use(express.json({
  verify: (req, _res, buf) => { req.rawBody = buf.toString(); },
}));
app.use(requestLogger);

// Public routes
app.get('/health', (_req, res) => res.json({ status: 'ok', service: 'backend', env: config.nodeEnv }));
app.use('/auth', require('./routes/auth'));

// All /api routes require a valid JWT — tenant context set by authMiddleware
app.use('/api', authMiddleware);
app.use('/api/inventory', require('./routes/inventory'));
app.use('/api/products', require('./routes/products'));
app.use('/api/orders', require('./routes/orders'));
app.use('/api/shopify', require('./routes/shopify'));
app.use('/api/ai', require('./routes/ai'));
app.use('/api/supervisor', require('./routes/supervisor'));
app.use('/api/finance',      require('./routes/finance'));
app.use('/api/order-basket', require('./routes/orderBasket'));
app.use('/api/bookkeeping',  require('./routes/bookkeeping'));
app.use('/api/tax',          require('./routes/tax'));
app.use('/api/setup',        require('./routes/setup'));
app.use('/api/ops',          require('./routes/ops'));

app.use(errorHandler);

registerInventoryObservables(pool);

let server;

async function start() {
  try {
    await migrate();
  } catch (err) {
    console.error(JSON.stringify({ event: 'db_init_error', error: err.message }));
  }
  server = app.listen(config.port, () => {
    console.log(JSON.stringify({ event: 'server_start', port: config.port, env: config.nodeEnv }));
  });
}

async function shutdown() {
  console.log(JSON.stringify({ event: 'server_shutdown' }));
  server?.close(async () => {
    await pool.end().catch(() => {});
    process.exit(0);
  });
  setTimeout(() => process.exit(1), 25000);
}

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);

start();
