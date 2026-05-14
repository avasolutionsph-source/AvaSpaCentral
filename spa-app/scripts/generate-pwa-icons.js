import sharp from 'sharp';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const sizes = [192, 512];
const inputPath = join(__dirname, '../public/daet-logo.png');
const outputDir = join(__dirname, '../public');

async function generateIcons() {
  console.log('Generating PWA icons...');

  for (const size of sizes) {
    const outputPath = join(outputDir, `pwa-${size}x${size}.png`);

    await sharp(inputPath)
      .resize(size, size, {
        fit: 'contain',
        background: { r: 27, g: 94, b: 55, alpha: 1 } // #1B5E37 - your primary green
      })
      .png()
      .toFile(outputPath);

    console.log(`Created: pwa-${size}x${size}.png`);
  }

  // Also create a favicon
  await sharp(inputPath)
    .resize(32, 32, {
      fit: 'contain',
      background: { r: 27, g: 94, b: 55, alpha: 1 }
    })
    .png()
    .toFile(join(outputDir, 'favicon.png'));

  console.log('Created: favicon.png');
  console.log('PWA icons generated successfully!');
}

generateIcons().catch(console.error);
