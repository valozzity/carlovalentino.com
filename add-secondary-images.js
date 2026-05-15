#!/usr/bin/env node
// Usage: node add-secondary-images.js <folder-of-images>
// Images must be named after the artwork title, e.g. "draco.png"
// Matches case-insensitively to product titles and adds as secondary images.

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const inputDir = process.argv[2];
if (!inputDir) {
  console.error('Usage: node add-secondary-images.js <folder>');
  process.exit(1);
}

const productsDir = path.join(__dirname, '_products');
const shopImagesDir = path.join(__dirname, 'shop-images');

// Load all products
const products = fs.readdirSync(productsDir)
  .filter(f => f.endsWith('.json'))
  .map(f => ({
    file: path.join(productsDir, f),
    data: JSON.parse(fs.readFileSync(path.join(productsDir, f), 'utf8')),
  }));

// Process each image in the input folder
const images = fs.readdirSync(inputDir)
  .filter(f => /\.(png|jpg|jpeg|webp|tiff|heic)$/i.test(f));

let matched = 0, skipped = 0;

for (const img of images) {
  const nameNoExt = path.basename(img, path.extname(img)).trim().toLowerCase();

  const product = products.find(p =>
    (p.data.title || '').trim().toLowerCase() === nameNoExt
  );

  if (!product) {
    console.log(`⚠ No match for "${img}" — no product with title "${nameNoExt}"`);
    skipped++;
    continue;
  }

  // Convert to webp and save to shop-images
  const slug = nameNoExt.replace(/\s+/g, '-');
  const outFile = `${slug}-secondary.webp`;
  const outPath = path.join(shopImagesDir, outFile);
  const srcPath = path.join(inputDir, img);

  execSync(`magick "${srcPath}" -resize 1400x1400\\> -quality 85 "${outPath}"`);

  // Add to product images if not already there
  const imgRef = `shop-images/${outFile}`;
  if (!product.data.images.includes(imgRef)) {
    product.data.images.push(imgRef);
    fs.writeFileSync(product.file, JSON.stringify(product.data, null, 2));
    console.log(`✓ Added "${outFile}" to "${product.data.title}" (${path.basename(product.file)})`);
    matched++;
  } else {
    console.log(`— "${outFile}" already in "${product.data.title}", skipping`);
    skipped++;
  }
}

console.log(`\nDone: ${matched} added, ${skipped} skipped.`);
if (matched > 0) {
  console.log('\nRun: git add shop-images/ _products/ && git commit -m "Add secondary images" && git push origin main');
}
