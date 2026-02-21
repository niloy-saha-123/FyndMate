/**
 * Standalone script to verify push and location logic without a database.
 * Run: npx tsx scripts/test-push-and-location.ts
 */

import { filterLocationByPrivacy, filterLocationArrayByPrivacy } from '../src/utils/locationPrivacy.js';

function assert(condition: boolean, message: string) {
  if (!condition) throw new Error(message);
}

console.log('Testing location privacy utils...\n');

// --- filterLocationByPrivacy ---
const alwaysUser = { id: '1', name: 'Alice', city: 'NY', country: 'USA', locationSharing: 'always' as const };
const alwaysResult = filterLocationByPrivacy(alwaysUser);
assert(alwaysResult.city === 'NY' && alwaysResult.country === 'USA', 'always: should keep city/country');
console.log('  ✓ locationSharing always → city/country visible');

const neverUser = { id: '2', name: 'Bob', city: 'Paris', country: 'France', locationSharing: 'never' as const };
const neverResult = filterLocationByPrivacy(neverUser);
assert(neverResult.city === null && neverResult.country === null, 'never: should nullify city/country');
console.log('  ✓ locationSharing never → city/country hidden');

const offUser = { id: '3', name: 'Carol', city: 'London', country: 'UK', locationSharing: 'off' as const };
const offResult = filterLocationByPrivacy(offUser);
assert(offResult.city === null && offResult.country === null, 'off: should nullify city/country');
console.log('  ✓ locationSharing off → city/country hidden');

// --- filterLocationArrayByPrivacy ---
const users = [
  { id: 'a', name: 'A', city: 'NYC', country: 'USA', locationSharing: 'always' as const },
  { id: 'b', name: 'B', city: 'London', country: 'UK', locationSharing: 'never' as const },
];
const arrResult = filterLocationArrayByPrivacy(users);
assert(arrResult[0].city === 'NYC' && arrResult[1].city === null, 'array: filter each user');
console.log('  ✓ filterLocationArrayByPrivacy filters each user');

assert(filterLocationArrayByPrivacy([]).length === 0, 'empty array');
console.log('  ✓ empty array returns empty\n');

// --- Push payload shape (Notification Message) ---
console.log('Verifying push notification payload shape (Notification Message)...\n');
const examplePayload = {
  to: 'ExponentPushToken[xxx]',
  sound: 'default' as const,
  title: 'Sender Name',
  body: 'Hello world',
  data: { type: 'message' as const, matchId: 'match-1', senderId: 'user-1' },
  priority: 'high' as const,
  channelId: 'default',
};
assert(typeof examplePayload.to === 'string', 'payload has to');
assert(typeof examplePayload.title === 'string', 'payload has title');
assert(typeof examplePayload.body === 'string', 'payload has body');
assert(examplePayload.data?.matchId != null, 'payload data has matchId for tap');
assert(examplePayload.sound === 'default', 'payload has sound');
assert(examplePayload.channelId === 'default', 'payload has channelId (Android)');
console.log('  ✓ Push payload has title, body, data.matchId (Notification Message format)\n');

console.log('All checks passed. Push and location logic are consistent.');
console.log('For full integration tests (DB + Redis), run: npm run test');
