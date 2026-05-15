const fs = require('fs');
const path = require('path');

const productsDir = path.join(__dirname, '_products');
const templatePath = path.join(__dirname, 'shop.template.html');
const outputPath = path.join(__dirname, 'shop.html');

// Read and sort all product JSON files
const products = fs.readdirSync(productsDir)
  .filter(f => f.endsWith('.json'))
  .map(f => {
    const data = JSON.parse(fs.readFileSync(path.join(productsDir, f), 'utf8'));
    // Normalize empty stripe_link to null
    if (!data.stripe_link) data.stripe_link = null;
    return data;
  })
  .sort((a, b) => a.id.localeCompare(b.id));

// Inject into template
const template = fs.readFileSync(templatePath, 'utf8');
const output = template.replace('@@PRODUCTS@@', JSON.stringify(products, null, 2));
fs.writeFileSync(outputPath, output);

console.log(`Built shop.html with ${products.length} products.`);
