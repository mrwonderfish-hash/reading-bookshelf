// Select the book on the server: no dependency on query parameters surviving
// a browser or authentication redirect.
export function renderReader(template, book) {
  const config = JSON.stringify(book).replace(/</g, '\\u003c');
  return template.replace('<!-- BOOK_CONFIG -->', `<script id="reader-config" type="application/json">${config}</script>`);
}

// Route params and URLSearchParams are already decoded once. Do not decode
// again: a literal %20 must not be mistaken for a space after double encoding.
export function resolveReaderBook(catalog, bookId) {
  if (typeof bookId !== 'string') return null;
  const exact = catalog.find(book => book.id === bookId);
  if (exact) return { book: exact, redirect: false };
  // Pasting a URL from a sentence can include trailing spaces or Chinese
  // punctuation. Only recover if removing that suffix identifies a real book.
  const cleanId = bookId.replace(/[\s，。]+$/u, '');
  const book = catalog.find(book => book.id === cleanId);
  return book ? { book, redirect: true } : null;
}
