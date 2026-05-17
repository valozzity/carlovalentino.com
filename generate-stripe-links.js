#!/usr/bin/env node
// Backfills Stripe payment links for all products missing one.
// Usage: node generate-stripe-links.js

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const { createPaymentLink, loadEnv } = require('./stripe-link');

loadEnv();

if (!process.env.STRIPE_KEY) {
  console.error('Error: STRIPE_KEY not set.\nAdd STRIPE_KEY=rk_... to a .env file in the repo root.');
  process.exit(1);
}

const productsDir = path.join(__dirname, '_products');

async function run() {
  const files = fs.readdirSync(productsDir).filter(f => f.endsWith('.json'));
  let updated = 0;

  for (const file of files) {
    const filePath = path.join(productsDir, file);
    const product = JSON.parse(fs.readFileSync(filePath, 'utf8'));

    if (product.stripe_link && product.stripe_link.trim()) {
      console.log(`— ${product.title || file}: already has link, skipping`);
      continue;
    }

    const title = product.title || path.basename(file, '.json');
    const price = product.price || 100;

    process.stdout.write(`⟳ ${title} ($${price})... `);
    try {
      const url = await createPaymentLink(title, price);
      product.stripe_link = url;
      if (!product.price) product.price = price;
      fs.writeFileSync(filePath, JSON.stringify(product, null, 2));
      console.log(`✓ ${url}`);
      updated++;
    } catch (e) {
      console.log(`✗ ${e.message}`);
    }
  }

  if (updated > 0) {
    console.log(`\nPushing ${updated} updated product(s)...`);
    execSync(
      '/opt/homebrew/bin/git add _products/ && ' +
      '/opt/homebrew/bin/git commit -m "Add Stripe payment links" && ' +
      '/opt/homebrew/bin/git pull origin main --rebase && ' +
      '/opt/homebrew/bin/git push origin main',
      { stdio: 'inherit', cwd: __dirname }
    );
  } else {
    console.log('\nNo products needed updating.');
  }
}

run().catch(e => { console.error(e.message); process.exit(1); });
