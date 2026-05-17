// Creates a Stripe Payment Link for an artwork product.
// Requires STRIPE_KEY in environment or .env file.

const https = require('https');
const qs = require('querystring');

function loadEnv() {
  const fs = require('fs'), path = require('path');
  const envPath = path.join(__dirname, '.env');
  if (fs.existsSync(envPath)) {
    fs.readFileSync(envPath, 'utf8').split('\n').forEach(line => {
      const [k, ...v] = line.split('=');
      if (k && v.length) process.env[k.trim()] = v.join('=').trim();
    });
  }
}

function stripePost(endpoint, params) {
  return new Promise((resolve, reject) => {
    const key = process.env.STRIPE_KEY;
    if (!key) throw new Error('STRIPE_KEY not set. Add it to .env or export it.');
    const body = qs.stringify(params);
    const req = https.request({
      hostname: 'api.stripe.com',
      path: `/v1/${endpoint}`,
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${key}`,
        'Content-Type': 'application/x-www-form-urlencoded',
        'Content-Length': Buffer.byteLength(body),
        'Stripe-Version': '2026-04-22.dahlia',
      },
    }, res => {
      let data = '';
      res.on('data', d => data += d);
      res.on('end', () => {
        const parsed = JSON.parse(data);
        if (parsed.error) reject(new Error(parsed.error.message));
        else resolve(parsed);
      });
    });
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

async function createPaymentLink(title, priceUsd) {
  loadEnv();
  const cents = Math.round(priceUsd * 100);

  // 1. Create product
  const product = await stripePost('products', { name: title });

  // 2. Create price
  const price = await stripePost('prices', {
    product: product.id,
    unit_amount: cents,
    currency: 'usd',
  });

  // 3. Create payment link
  const link = await stripePost('payment_links', {
    'line_items[0][price]': price.id,
    'line_items[0][quantity]': 1,
  });

  return link.url;
}

module.exports = { createPaymentLink, loadEnv };
