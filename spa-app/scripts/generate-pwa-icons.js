import sharp from 'sharp';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { readFileSync } from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const publicDir = join(__dirname, '../public');
// Framed source — lotus on green rounded square. Matches the marketing
// site's brand (gold lotus, #C99A3A) while giving the PWA installer a
// background that home-screens render cleanly. The transparent
// `ava-favicon.svg` is reserved for the browser-tab favicon.
const sourceSvg = readFileSync(join(publicDir, 'ava-favicon-framed.svg'));

const sizes = [192, 512];

async function generateIcons() {
  console.log('Generating PWA icons from ava-favicon-framed.svg...');

  for (const size of sizes) {
    const outputPath = join(publicDir, `pwa-${size}x${size}.png`);
    await sharp(sourceSvg)
      .resize(size, size)
      .png()
      .toFile(outputPath);
    console.log(`Created: pwa-${size}x${size}.png`);

    const webpPath = join(publicDir, `pwa-${size}x${size}.webp`);
    await sharp(sourceSvg)
      .resize(size, size)
      .webp({ quality: 90 })
      .toFile(webpPath);
    console.log(`Created: pwa-${size}x${size}.webp`);
  }

  // PNG/WebP fallbacks for the browser-tab favicon. Browsers prefer the
  // SVG link in index.html, but older Safari and some Android browsers
  // fall back to this PNG.
  await sharp(sourceSvg)
    .resize(64, 64)
    .png()
    .toFile(join(publicDir, 'favicon.png'));
  console.log('Created: favicon.png');

  await sharp(sourceSvg)
    .resize(64, 64)
    .webp({ quality: 90 })
    .toFile(join(publicDir, 'favicon.webp'));
  console.log('Created: favicon.webp');

  console.log('PWA icons generated successfully!');
}

generateIcons().catch((err) => {
  console.error(err);
  process.exit(1);
});
