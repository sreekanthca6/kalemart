const express = require('express');
const config = require('./config');
const errorHandler = require('./middleware/errorHandler');
const requestLogger = require('./middleware/requestLogger');
const { registerInventoryObservables } = require('./metrics');
const store = require('./db/store');

const app = express();

// Capture raw body for Shopify HMAC verification via verify callback
app.use(express.json({
  verify: (req, _res, buf) => { req.rawBody = buf.toString(); },
}));
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
