# Setting up the Charm Bar Builder

Your `/pages/charm-bar` page now has a real, interactive **Charm Bar Builder**:
shoppers pick a base chain, add charms, drag them into place, preview the piece,
and add the whole thing to cart (base + every charm) in one go.

The builder is **self-showing**: it stays in a polite "being stocked" empty-state
until you create the two collections below and add products. So the page is safe
to publish right now — nothing breaks while you're still setting up.

Your job is a one-time setup in Shopify Admin.

---

## Step 1 — Create the two collections

**Shopify Admin → Products → Collections → Create collection** (do this twice).

1. **Bases** — the chains you build on.
   - Title: `Charm Bar Bases`
   - **URL handle must be exactly `charm-bar-bases`** (Search engine listing → Edit → URL handle).
   - Add your chain/bracelet/keychain/safety-pin products here (Manual collection is easiest).

2. **Charms** — one product per charm.
   - Title: `Charm Bar Charms`
   - **URL handle must be exactly `charm-bar-charms`**.
   - Add every charm product here.

> Prefer different names? You can. Just open **Online Store → Customize → the
> Charm Bar page → Charm Bar Builder** and type your handles into the two
> "collection handle" boxes.

---

## Step 2 — How to set up a BASE product (chain)

Each base is a normal product with a price. Two extras make it shine:

- **Product type** → this becomes the tab at the top of Step 1. Use one of:
  `Necklace`, `Bracelet`, `Keychain`, `Safety Pin` (or your own — each distinct
  type gets its own tab).
- **Length** (optional) → shows as a little pill on the card. Add a metafield:
  - Namespace & key: `custom.length`  (type: Single line text)
  - Example value: `18 inches with 2 inch extender`

---

## Step 3 — How to set up a CHARM product

Each charm is a normal product with a price (e.g. $10). Recommended extras:

- **Image**: use a **transparent PNG** cut-out. Charms sit directly on the chain
  in the Arrange step, so a transparent background looks best. (Photos on white
  still work — they'll just show their background.)
- **Size** (optional, powers the "Size" filter chips): metafield
  `custom.size` (Single line text) → `Small`, `Medium`, or `Large`.
- **Intention** (optional, powers the "Intention" filter chips): either a metafield
  `custom.intention`, **or** just use product **tags** (Love, Travel, Luck…). If any
  charm has the `custom.intention` metafield, the builder uses that; otherwise it
  falls back to tags.

---

## Step 4 — (Optional) Metals

If you want shoppers to switch **Gold / Silver**, give each product a variant
**option named `Metal`** with values `Gold` and `Silver`. The builder shows a
metal toggle automatically and keeps every charm in place when the shopper
switches — no toggle appears if your products are single-metal.

---

## Step 5 — Tune the rules (optional)

**Online Store → Customize → Charm Bar page → Charm Bar Builder** lets you set:

- **Minimum / maximum charms** (defaults: min 1, max 10)
- All headings, step labels, and the empty-state copy

---

## How it adds to cart

When the shopper hits **Add to cart**, the base chain and each charm are added
as separate line items, grouped by a hidden `_cb_build` property so you can see
which charms belong to which custom piece on the order. The total the shopper
sees is the base price plus every charm — exactly what lands in the cart.

That's it. Create the collections, drop in products, and the builder lights up.
