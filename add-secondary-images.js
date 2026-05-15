#!/usr/bin/env node
// Usage: node add-secondary-images.js <folder-of-images>
// Images named after artwork title, with optional trailing number for multiples:
//   fire flame.png, fire flame 1.png, fire flame 2.png → all go to "fire flame"

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const input = process.argv.slice(2).join(' ');
if (!input) {
  console.error('Usage: node add-secondary-images.js <folder-or-image>');
  process.exit(1);
}

// Resolve to {dir, file} pairs — works for folder or single file drops
const inputStat = fs.statSync(input);
const pairs = inputStat.isDirectory()
  ? fs.readdirSync(input)
      .filter(f => /\.(png|jpg|jpeg|webp|tiff|heic)$/i.test(f))
      .sort()
      .map(f => ({ dir: input, file: f }))
  : /\.(png|jpg|jpeg|webp|tiff|heic)$/i.test(path.basename(input))
      ? [{ dir: path.dirname(input), file: path.basename(input) }]
      : [];

const productsDir = path.join(__dirname, '_products');
const shopImagesDir = path.join(__dirname, 'shop-images');

// Load all products
const products = fs.readdirSync(productsDir)
  .filter(f => f.endsWith('.json'))
  .map(f => ({
    file: path.join(productsDir, f),
    data: JSON.parse(fs.readFileSync(path.join(productsDir, f), 'utf8')),
  }));

// Strip trailing " 1", " 2" etc to get the base title for matching
function baseTitle(nameNoExt) {
  return nameNoExt.replace(/\s+\d+$/, '').trim().toLowerCase();
}

// Build a unique output filename that doesn't already exist
function uniqueOutFile(slug) {
  let candidate = `${slug}-secondary.webp`;
  let i = 1;
  while (fs.existsSync(path.join(shopImagesDir, candidate))) {
    candidate = `${slug}-secondary-${i}.webp`;
    i++;
  }
  return candidate;
}

if (pairs.length === 0) {
  console.log('No supported images found.');
  process.exit(0);
}

let matched = 0, skipped = 0;

for (const { dir: imgDir, file: img } of pairs) {
  const nameNoExt = path.basename(img, path.extname(img)).trim();
  const titleKey = baseTitle(nameNoExt);

  const product = products.find(p =>
    (p.data.title || '').trim().toLowerCase() === titleKey
  );

  if (!product) {
    console.log(`⚠ No match for "${img}" — no product titled "${titleKey}"`);
    skipped++;
    continue;
  }

  const slug = titleKey.replace(/\s+/g, '-');
  const outFile = uniqueOutFile(slug);
  const outPath = path.join(shopImagesDir, outFile);
  const srcPath = path.join(imgDir, img);

  execSync(`/opt/homebrew/bin/magick "${srcPath}" -resize 1400x1400\\> -quality 85 "${outPath}"`);

  const imgRef = `shop-images/${outFile}`;
  if (!product.data.images.includes(imgRef)) {
    product.data.images.push(imgRef);
    fs.writeFileSync(product.file, JSON.stringify(product.data, null, 2));
    console.log(`✓ "${img}" → "${outFile}" added to "${product.data.title}"`);
    matched++;
  } else {
    console.warn(`⚠ DUPLICATE — "${outFile}" already exists in "${product.data.title}". Skipping.`);
    skipped++;
  }
}

console.log(`\nDone: ${matched} added, ${skipped} skipped.`);
if (matched > 0) {
  execSync('/opt/homebrew/bin/git add shop-images/ _products/ && /opt/homebrew/bin/git commit -m "Add secondary images" && /opt/homebrew/bin/git pull origin main --rebase && /opt/homebrew/bin/git push origin main', { stdio: 'inherit' });
}
