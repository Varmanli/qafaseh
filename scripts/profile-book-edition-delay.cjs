// Local-only probe: node --require ./scripts/profile-book-edition-delay.cjs
// node_modules/next/dist/bin/next start -p 3101
const { Pool } = require("pg");
const query = Pool.prototype.query;

Pool.prototype.query = function (...args) {
  const result = query.apply(this, args);
  const text = typeof args[0] === "string" ? args[0] : args[0]?.text ?? "";
  if (!result?.then || !text.includes('"BookSearchIndex"')) return result;
  return result.then((value) => new Promise((resolve) => {
    setTimeout(() => resolve(value), 4000);
  }));
};
