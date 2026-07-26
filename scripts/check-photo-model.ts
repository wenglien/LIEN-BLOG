import assert from 'node:assert/strict';
import { normalizePhotoCategory, PHOTO_CATEGORIES } from '../src/types/photo';

assert.equal(normalizePhotoCategory(' LANDSCAPE '), 'landscape');
assert.equal(normalizePhotoCategory('unknown'), 'creative');
assert.equal(normalizePhotoCategory('__proto__'), 'creative');
assert.equal(normalizePhotoCategory(null), 'creative');
assert.ok('creative' in PHOTO_CATEGORIES);

console.log('Photo model check passed');
