#!/usr/bin/env node
// Usage: node add-secondary-images.js <folder-of-images>
// Images named after artwork title, with optional trailing number for multiples:
//   fire flame.png, fire flame 1.png, fire flame 2.png → all go to "fire flame"

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

const images = fs.readdirSync(inputDir)
  .filter(f => /\.(png|jpg|jpeg|webp|tiff|heic)$/i.test(f))
  .sort();

let matched = 0, skipped = 0;

for (const img of images) {
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
  const srcPath = path.join(inputDir, img);

  execSync(`magick "${srcPath}" -resize 1400x1400\\> -quality 85 "${outPath}"`);

  const imgRef = `shop-images/${outFile}`;
  if (!product.data.images.includes(imgRef)) {
    product.data.images.push(imgRef);
    fs.writeFileSync(product.file, JSON.stringify(product.data, null, 2));
    console.log(`✓ "${img}" → "${outFile}" added to "${product.data.title}"`);
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
