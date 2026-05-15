#!/usr/bin/env node
// Usage: node add-products.js <folder-or-image>
// Image filename = artwork title, e.g. "Martini Time.png"
// Accepts a folder of images or individual image files dropped via the droplet.

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const input = process.argv.slice(2).join(' ');
if (!input) {
  console.error('Usage: node add-products.js <folder-or-image>');
  process.exit(1);
}

const productsDir = path.join(__dirname, '_products');
const shopImagesDir = path.join(__dirname, 'shop-images');

// Find the next available fc-N number
const existing = fs.readdirSync(productsDir)
  .filter(f => f.endsWith('.json'))
  .map(f => parseInt(f.replace('fc-', '').replace('.json', ''), 10))
  .filter(n => !isNaN(n));
let nextN = existing.length > 0 ? Math.max(...existing) + 1 : 1;

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

let added = 0;

for (const { dir, file } of pairs) {
  const title = path.basename(file, path.extname(file)).trim();
  const id = `fc-${nextN}`;
  const imgFile = `frame-${nextN}.webp`;
  const srcPath = path.join(dir, file);
  const outPath = path.join(shopImagesDir, imgFile);

  execSync(`/opt/homebrew/bin/magick "${srcPath}" -resize 1400x1400\\> -quality 85 "${outPath}"`);

  const product = {
    id,
    title,
    price: null,
    description: '',
    status: 'available',
    images: [`shop-images/${imgFile}`],
    stripe_link: '',
  };
  fs.writeFileSync(path.join(productsDir, `${id}.json`), JSON.stringify(product, null, 2));

  console.log(`✓ "${file}" → ${id} — "${title}"`);
  nextN++;
  added++;
}

console.log(`\nDone: ${added} product(s) added.`);
if (added > 0) {
  execSync('git add shop-images/ _products/ && git commit -m "Add new products" && git push origin main', { stdio: 'inherit' });
}
