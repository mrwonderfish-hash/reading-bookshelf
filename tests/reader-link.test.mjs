import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolveReaderBook } from '../lib/reader-page.mjs';

const catalog = JSON.parse(readFileSync(new URL('../public/library.json', import.meta.url), 'utf8'));

test('canonical book IDs are unchanged; copied trailing spaces and Chinese punctuation recover only known books', () => {
  for (const book of catalog) {
    assert.deepEqual(resolveReaderBook(catalog, book.id), { book, redirect: false });
    for (const suffix of [' ', ' ，', '\u3000。\t', '， 。 ']) {
      assert.deepEqual(resolveReaderBook(catalog, book.id + suffix), { book, redirect: true });
    }
  }
});

test('unknown IDs, internal edits and encoded delimiters are never guessed or decoded again', () => {
  for (const value of [undefined, null, [], '', 'unknown ', 'changing planes', ' changing-planes', 'CHANGING-PLANES', 'changing-planes/evil', 'changing-planes%20', 'changing-planes%2F', 'changing-planes%', '//example.com/changing-planes']) {
    assert.equal(resolveReaderBook(catalog, value), null, String(value));
  }
});
