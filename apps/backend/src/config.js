module.exports = {
  port: parseInt(process.env.PORT || '4000', 10),
  nodeEnv: process.env.NODE_ENV || 'development',
  jwtSecret: process.env.JWT_SECRET || 'dev-jwt-secret-change-in-prod',
  aiServiceUrl: process.env.AI_SERVICE_URL || 'http://kalemart-ai-service:5000',
  anthropicApiKey: process.env.ANTHROPIC_API_KEY || '',
  shopify: {
    webhookSecret: process.env.SHOPIFY_WEBHOOK_SECRET || 'dev-secret',
    shopDomain: process.env.SHOPIFY_SHOP_DOMAIN || 'kalemart.myshopify.com',
    accessToken: process.env.SHOPIFY_ACCESS_TOKEN || '',
  },
};
