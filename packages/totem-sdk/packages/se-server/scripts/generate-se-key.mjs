#!/usr/bin/env node
import { randomBytes } from 'crypto';

const key = randomBytes(32).toString('hex');
console.log(key);
console.log('');
console.log('# Add to your environment or .env file:');
console.log(`SE_KEY=${key}`);
console.log('');
console.log('# Keep this secret. Back it up offline. Losing it means losing access to all chains this SE manages.');
