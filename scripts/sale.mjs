#!/usr/bin/env node
/**
 * Adophies — apply or revert a percentage sale across a collection.
 *
 * The theme shows a product as "on sale" whenever compare_at_price > price, so this
 * script sets both: compare-at holds the original price, price holds the discount.
 *
 *   SHOPIFY_STORE=adophies.myshopify.com \
 *   SHOPIFY_ADMIN_TOKEN=shpat_xxx \
 *   node scripts/sale.mjs --collection sale --percent 50 --yes
 *
 *   node scripts/sale.mjs --revert --yes
 *
 * Without --yes it runs as a dry run and only prints what it would change.
 * Every original price is written to scripts/.sale-backup.json before anything is
 * touched; --revert restores from that file.
 *
 * Discounts are always calculated from the ORIGINAL price (compare-at when one already
 * exists), so re-running with a different percentage never compounds.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const BACKUP = path.join(HERE, '.sale-backup.json');

const STORE = process.env.SHOPIFY_STORE;
const TOKEN = process.env.SHOPIFY_ADMIN_TOKEN;
const API_VERSION = process.env.SHOPIFY_API_VERSION || '2025-07';

function arg(name, fallback) {
  const i = process.argv.indexOf('--' + name);
  if (i === -1) return fallback;
  const next = process.argv[i + 1];
  return next && !next.startsWith('--') ? next : true;
}

const REVERT = !!arg('revert', false);
const APPLY = !!arg('yes', false);
const HANDLE = String(arg('collection', 'sale'));
const PERCENT = Number(arg('percent', 0));

if (!STORE || !TOKEN) {
  console.error('Set SHOPIFY_STORE and SHOPIFY_ADMIN_TOKEN in the environment.');
  process.exit(1);
}
if (!REVERT && (!(PERCENT > 0) || PERCENT >= 100)) {
  console.error('--percent must be between 1 and 99 (or pass --revert).');
  process.exit(1);
}

async function gql(query, variables) {
  const res = await fetch(`https://${STORE}/admin/api/${API_VERSION}/graphql.json`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Shopify-Access-Token': TOKEN
    },
    body: JSON.stringify({ query, variables })
  });
  if (!res.ok) throw new Error(`HTTP ${res.status} ${await res.text()}`);
  const body = await res.json();
  if (body.errors) throw new Error(JSON.stringify(body.errors));
  return body.data;
}

/** Nearest price ending in .99, never below 0.99. */
function toNinetyNine(amount) {
  const rounded = Math.round(amount - 0.99) + 0.99;
  return Math.max(0.99, rounded).toFixed(2);
}

const PRODUCTS_QUERY = `
  query($q: String!, $after: String) {
    collections(first: 1, query: $q) {
      nodes {
        title
        products(first: 50, after: $after) {
          pageInfo { hasNextPage endCursor }
          nodes {
            id
            title
            variants(first: 100) {
              nodes { id title price compareAtPrice }
            }
          }
        }
      }
    }
  }
`;

const UPDATE = `
  mutation($productId: ID!, $variants: [ProductVariantsBulkInput!]!) {
    productVariantsBulkUpdate(productId: $productId, variants: $variants) {
      userErrors { field message }
    }
  }
`;

async function fetchCollectionProducts(handle) {
  const products = [];
  let after = null;
  let title = null;
  do {
    const data = await gql(PRODUCTS_QUERY, { q: `handle:${handle}`, after });
    const collection = data.collections.nodes[0];
    if (!collection) throw new Error(`No collection with handle "${handle}".`);
    title = collection.title;
    products.push(...collection.products.nodes);
    after = collection.products.pageInfo.hasNextPage
      ? collection.products.pageInfo.endCursor
      : null;
  } while (after);
  return { title, products };
}

async function pushVariants(productId, variants) {
  const data = await gql(UPDATE, { productId, variants });
  const errors = data.productVariantsBulkUpdate.userErrors;
  if (errors.length) throw new Error(JSON.stringify(errors));
}

async function applySale() {
  const { title, products } = await fetchCollectionProducts(HANDLE);
  console.log(`Collection "${title}" — ${products.length} product(s), ${PERCENT}% off\n`);

  const backup = {};
  const updates = [];

  for (const product of products) {
    const variants = [];
    for (const v of product.variants.nodes) {
      // Original = the compare-at price when one is already set, so re-running
      // at a different percentage discounts the true original, not the sale price.
      const original = Number(v.compareAtPrice || v.price);
      const target = toNinetyNine(original * (1 - PERCENT / 100));
      if (Number(target) >= original) {
        console.log(`  skip  ${product.title} / ${v.title} — no room to discount`);
        continue;
      }
      backup[v.id] = { price: v.price, compareAtPrice: v.compareAtPrice };
      variants.push({ id: v.id, price: target, compareAtPrice: original.toFixed(2) });
      console.log(
        `  ${product.title} / ${v.title}: $${original.toFixed(2)} → $${target}`
      );
    }
    if (variants.length) updates.push({ productId: product.id, variants });
  }

  const count = updates.reduce((n, u) => n + u.variants.length, 0);
  if (!APPLY) {
    console.log(`\nDry run — ${count} variant(s) would change. Re-run with --yes.`);
    return;
  }

  fs.writeFileSync(BACKUP, JSON.stringify(backup, null, 2));
  console.log(`\nOriginal prices saved to ${BACKUP}`);

  for (const u of updates) await pushVariants(u.productId, u.variants);
  console.log(`Done — ${count} variant(s) updated.`);
}

async function revertSale() {
  if (!fs.existsSync(BACKUP)) {
    console.error(`No backup at ${BACKUP} — nothing to revert.`);
    process.exit(1);
  }
  const backup = JSON.parse(fs.readFileSync(BACKUP, 'utf8'));
  const ids = Object.keys(backup);
  console.log(`Reverting ${ids.length} variant(s) from ${BACKUP}\n`);

  // Group by product: the bulk mutation is per product.
  const byProduct = new Map();
  for (const [variantId, prices] of Object.entries(backup)) {
    const productId = await variantProductId(variantId);
    if (!byProduct.has(productId)) byProduct.set(productId, []);
    byProduct.get(productId).push({
      id: variantId,
      price: prices.price,
      // null clears the compare-at price we added, ending the sale.
      compareAtPrice: prices.compareAtPrice
    });
  }

  if (!APPLY) {
    console.log('Dry run — re-run with --yes to restore these prices.');
    return;
  }

  for (const [productId, variants] of byProduct) await pushVariants(productId, variants);
  fs.renameSync(BACKUP, BACKUP + '.reverted');
  console.log(`Done — prices restored, backup moved to ${BACKUP}.reverted`);
}

const variantProductCache = new Map();
async function variantProductId(variantId) {
  if (variantProductCache.has(variantId)) return variantProductCache.get(variantId);
  const data = await gql(
    `query($id: ID!) { productVariant(id: $id) { product { id } } }`,
    { id: variantId }
  );
  const id = data.productVariant.product.id;
  variantProductCache.set(variantId, id);
  return id;
}

try {
  await (REVERT ? revertSale() : applySale());
} catch (err) {
  console.error('\nFailed:', err.message);
  process.exit(1);
}
