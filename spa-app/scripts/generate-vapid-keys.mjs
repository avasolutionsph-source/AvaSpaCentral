#!/usr/bin/env node
/**
 * Generate a VAPID keypair for Web Push.
 *
 *   node scripts/generate-vapid-keys.mjs
 *
 * Public key (URL-safe base64) → frontend env var VITE_VAPID_PUBLIC_KEY.
 * Private key (URL-safe base64) → Supabase secret  VAPID_PRIVATE_KEY.
 *
 * The keypair is generated locally with Node's built-in crypto; nothing
 * leaves this machine. Run once per environment and store the keys in
 * a password manager — losing the private key invalidates every active
 * subscription on every device.
 */
import { generateKeyPairSync } from 'node:crypto';

const { publicKey, privateKey } = generateKeyPairSync('ec', { namedCurve: 'P-256' });

const pubJwk = publicKey.export({ format: 'jwk' });
const prvJwk = privateKey.export({ format: 'jwk' });

const x = Buffer.from(pubJwk.x, 'base64url');
const y = Buffer.from(pubJwk.y, 'base64url');
const publicKeyRaw = Buffer.concat([Buffer.from([0x04]), x, y]); // 65 bytes
const publicKeyB64 = publicKeyRaw.toString('base64url');

const privateKeyRaw = Buffer.from(prvJwk.d, 'base64url');
const privateKeyB64 = privateKeyRaw.toString('base64url');

console.log('VAPID keypair generated.\n');
console.log('--- frontend (.env) ---');
console.log(`VITE_VAPID_PUBLIC_KEY=${publicKeyB64}\n`);
console.log('--- Supabase secrets (Edge Function notify-push) ---');
console.log(`VAPID_PUBLIC_KEY=${publicKeyB64}`);
console.log(`VAPID_PRIVATE_KEY=${privateKeyB64}`);
console.log(`VAPID_SUBJECT=mailto:owner@yourbusiness.com   # change to a real address`);
console.log('\nNext steps:');
console.log('  1. Paste the VITE_VAPID_PUBLIC_KEY line into .env (commit-safe)');
console.log('  2. Set the three Supabase secrets via the dashboard or CLI');
console.log('  3. Re-deploy the notify-push Edge Function so it picks them up');
