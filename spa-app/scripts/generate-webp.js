/**
 * Generate WebP versions of PNG images
 * Run with: node scripts/generate-webp.js
 */

import sharp from 'sharp';
import { readdir } from 'fs/promises';
import { join, parse } from 'path';

const PUBLIC_DIR = './public';

async function generateWebP() {
  try {
    const files = await readdir(PUBLIC_DIR);
    const pngFiles = files.filter(f => f.endsWith('.png'));

    console.log(`Found ${pngFiles.length} PNG files to convert...`);

    for (const file of pngFiles) {
      const inputPath = join(PUBLIC_DIR, file);
      const { name } = parse(file);
      const outputPath = join(PUBLIC_DIR, `${name}.webp`);

      await sharp(inputPath)
        .webp({ quality: 85 })
        .toFile(outputPath);

      console.log(`✓ Converted ${file} → ${name}.webp`);
    }

    console.log('\nDone! WebP files created.');
    console.log('\nNote: Keep both PNG and WebP files.');
    console.log('The OptimizedImage component will use WebP with PNG fallback.');
  } catch (error) {
    console.error('Error:', error.message);
    process.exit(1);
  }
}

generateWebP();
