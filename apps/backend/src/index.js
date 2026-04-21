const express = require('express');
const config = require('./config');
const errorHandler = require('./middleware/errorHandler');
const requestLogger = require('./middleware/requestLogger');
const { registerInventoryObservables } = require('./metrics');
const store = require('./db/store');

const app = express();

// Parse raw body for Shopify HMAC verification
app.use((req, _res, next) => {
  let raw = '';
  req.on('data', chunk => { raw += chunk; });
  req.on('end', () => { req.rawBody = raw; next(); });
});
app.use(express.json());
app.use(requestLogger);

app.get('/health', (_req, res) => res.json({ status: 'ok', service: 'backend', env: config.nodeEnv }));

app.use('/api/inventory', require('./routes/inventory'));
app.use('/api/products', require('./routes/products'));
app.use('/api/orders', require('./routes/orders'));
app.use('/api/shopify', require('./routes/shopify'));
app.use('/api/ai', require('./routes/ai'));

app.use(errorHandler);

registerInventoryObservables(store);

app.listen(config.port, () => {
  console.log(JSON.stringify({ event: 'server_start', port: config.port, env: config.nodeEnv }));
});
