#!/usr/bin/env node
// Usage: node add-products.js <folder-or-image>
// Image filename = artwork title, e.g. "Martini Time.png"
// Accepts a folder of images or individual image files dropped via the droplet.

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const { createPaymentLink, loadEnv } = require('./stripe-link');
loadEnv();
const DEFAULT_PRICE = 100;

const input = process.argv.slice(2).join(' ');
if (!input) {
  console.error('Usage: node add-products.js <folder-or-image>');
  process.exit(1);
}

const productsDir = path.join(__dirname, '_products');
const shopImagesDir = path.join(__dirname, 'shop-images');

// Load existing products to check for duplicate titles
const existingProducts = fs.readdirSync(productsDir)
  .filter(f => f.endsWith('.json'))
  .map(f => JSON.parse(fs.readFileSync(path.join(productsDir, f), 'utf8')));

const existingTitles = new Set(
  existingProducts.map(p => (p.title || '').trim().toLowerCase())
);

// Find the next available fc-N number
const existingNums = existingProducts
  .map(p => parseInt((p.id || '').replace('fc-', ''), 10))
  .filter(n => !isNaN(n));
let nextN = Math.max(200, existingNums.length > 0 ? Math.max(...existingNums) + 1 : 200);

// Resolve list of {dir, file} pairs — works for both folder and single file drops
const stat = fs.statSync(input);
const pairs = stat.isDirectory()
  ? fs.readdirSync(input)
      .filter(f => /\.(png|jpg|jpeg|webp|tiff|heic)$/i.test(f))
      .sort()
      .map(f => ({ dir: input, file: f }))
  : /\.(png|jpg|jpeg|webp|tiff|heic)$/i.test(path.basename(input))
      ? [{ dir: path.dirname(input), file: path.basename(input) }]
      : [];

if (pairs.length === 0) {
  console.log('No supported images found.');
  process.exit(0);
}

let added = 0, skipped = 0;

(async () => {

for (const { dir, file } of pairs) {
  const title = path.basename(file, path.extname(file)).trim();
  const titleKey = title.toLowerCase();

  if (existingTitles.has(titleKey)) {
    console.warn(`⚠ DUPLICATE — "${title}" already exists. Skipping.`);
    skipped++;
    continue;
  }

  const id = `fc-${nextN}`;
  const imgFile = `frame-${nextN}.webp`;
  const srcPath = path.join(dir, file);
  const outPath = path.join(shopImagesDir, imgFile);

  execSync(`/opt/homebrew/bin/magick "${srcPath}" -resize 1400x1400\\> -quality 85 "${outPath}"`);

  // Generate Stripe payment link
  let stripeLink = '';
  if (process.env.STRIPE_KEY) {
    process.stdout.write(`  generating Stripe link... `);
    try {
      stripeLink = await createPaymentLink(title, DEFAULT_PRICE);
      console.log(`✓ ${stripeLink}`);
    } catch (e) {
      console.log(`⚠ Stripe error: ${e.message}`);
    }
  }

  const product = {
    id,
    title,
    price: DEFAULT_PRICE,
    description: '',
    status: 'available',
    images: [`shop-images/${imgFile}`],
    stripe_link: stripeLink,
  };
  fs.writeFileSync(path.join(productsDir, `${id}.json`), JSON.stringify(product, null, 2));

  console.log(`✓ "${file}" → ${id} — "${title}"`);
  existingTitles.add(titleKey);
  nextN++;
  added++;
}

  console.log(`\nDone: ${added} added, ${skipped} skipped (duplicates).`);
  if (added > 0) {
    execSync('/opt/homebrew/bin/git add shop-images/ _products/ && /opt/homebrew/bin/git commit -m "Add new products" && /opt/homebrew/bin/git pull origin main --rebase && /opt/homebrew/bin/git push origin main', { stdio: 'inherit' });
  }
})().catch(e => { console.error(e.message); process.exit(1); });
