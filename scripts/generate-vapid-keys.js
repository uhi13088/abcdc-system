#!/usr/bin/env node

/**
 * VAPID Key Generator for Web Push Notifications
 *
 * Run: node scripts/generate-vapid-keys.js
 *
 * This script generates VAPID (Voluntary Application Server Identification)
 * keys needed for Web Push notifications.
 */

const crypto = require('crypto');

// Generate ECDSA key pair using P-256 curve
function generateVapidKeys() {
  const { publicKey, privateKey } = crypto.generateKeyPairSync('ec', {
    namedCurve: 'prime256v1',
    publicKeyEncoding: {
      type: 'spki',
      format: 'der',
    },
    privateKeyEncoding: {
      type: 'pkcs8',
      format: 'der',
    },
  });

  // Extract raw public key (skip DER header - last 65 bytes for uncompressed point)
  const rawPublicKey = publicKey.slice(-65);

  // Extract raw private key (32 bytes)
  const rawPrivateKey = privateKey.slice(-32);

  // Convert to base64url
  const publicKeyBase64 = rawPublicKey
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '');

  const privateKeyBase64 = rawPrivateKey
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '');

  return {
    publicKey: publicKeyBase64,
    privateKey: privateKeyBase64,
  };
}

// Generate keys
const keys = generateVapidKeys();

console.log('\n========================================');
console.log('   VAPID Keys Generated Successfully!');
console.log('========================================\n');

console.log('Add these to your .env file:\n');
console.log(`NEXT_PUBLIC_VAPID_PUBLIC_KEY=${keys.publicKey}`);
console.log(`VAPID_PRIVATE_KEY=${keys.privateKey}`);
console.log('');

console.log('----------------------------------------');
console.log('Important Notes:');
console.log('----------------------------------------');
console.log('1. Keep the PRIVATE key secret! Never expose it in client code.');
console.log('2. The PUBLIC key can be safely used in client-side code.');
console.log('3. These keys are used for Web Push notifications.');
console.log('4. If you change these keys, all existing push subscriptions will be invalidated.');
console.log('');
