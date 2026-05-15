#!/usr/bin/env node
// Usage: node add-products.js <folder-of-images>
// Image filename = artwork title, e.g. "Martini Time.png"
// Converts to webp, assigns next fc-N id, creates product JSON.

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const inputDir = process.argv[2];
if (!inputDir) {
  console.error('Usage: node add-products.js <folder>');
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

const images = fs.readdirSync(inputDir)
  .filter(f => /\.(png|jpg|jpeg|webp|tiff|heic)$/i.test(f))
  .sort();

if (images.length === 0) {
  console.log('No images found in folder.');
  process.exit(0);
}

let added = 0;

for (const img of images) {
  const title = path.basename(img, path.extname(img)).trim();
  const id = `fc-${nextN}`;
  const imgFile = `frame-${nextN}.webp`;
  const imgPath = path.join(shopImagesDir, imgFile);
  const srcPath = path.join(inputDir, img);

  // Convert to webp
  execSync(`magick "${srcPath}" -resize 1400x1400\\> -quality 85 "${imgPath}"`);

  // Create product JSON
  const product = {
    id,
    title,
    price: null,
    description: '',
    status: 'available',
    images: [`shop-images/${imgFile}`],
    stripe_link: '',
  };
  fs.writeFileSync(
    path.join(productsDir, `${id}.json`),
    JSON.stringify(product, null, 2)
  );

  console.log(`✓ "${img}" → ${id} — "${title}"`);
  nextN++;
  added++;
}

console.log(`\nDone: ${added} product(s) added.`);
console.log('\nRun: git add shop-images/ _products/ && git commit -m "Add new products" && git push origin main');
