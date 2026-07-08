# Editing the Jewelry page

The Jewelry page (`/pages/jewelry`) and each product page now stay in sync, because
they both read from the **product** in Shopify. Edit the product once and both update.

---

## 1. Change a product's name, photo, or price

**Shopify Admin → Products →** open the product (e.g. "Lumi Earrings").

| To change… | Edit this | Updates |
|---|---|---|
| **Name** | The product **Title** | Jewelry card + product page |
| **Photo** | The product **Media** (the **first image** is shown on the card) | Jewelry card + product page |
| **Price** | The variant **Price** | Jewelry card + product page |

> Tip: to change the card photo, add your new image to the product's Media and drag it
> to the **first** position (or delete the old first image).

---

## 2. Material / Size shown on the cards

These come from the product's **metafields**, so the card and product page match.

**Shopify Admin → Products →** open the product → scroll to **Metafields**:

- `custom.material`  → e.g. `14k Gold-filled`
- `custom.dimensions` → e.g. `18mm x 24mm`

If a product has no material/dimensions metafield, that overlay simply doesn't show for
that item (no error). One-time setup: if these metafield definitions don't exist yet,
create them under **Settings → Custom data → Products** (type: single-line text) with the
keys `material` and `dimensions` in the `custom` namespace.

---

## 3. Add / remove / reorder items on the Jewelry page

**Online Store → Themes → Customize →** open `/pages/jewelry` → **Jewelry trio** section.

- Each item is an **Earring**, **Ring**, or **Bracelet** block with a single **Product** picker.
- **Add** a block → choose its category → pick the product.
- **Remove** a block to take an item off the page.
- **Drag** blocks to reorder within a category.

You are only choosing *which product* goes where — the name, photo, and price always
come from the product (Step 1).

---

## 4. The hero photo + intro text at the top

Same **Jewelry trio** section, in the section settings (top):

- **Hero image** – the large editorial/lifestyle photo. Upload your own.
- **Hero title / Hero subtitle / Hero eyebrow** – the writing next to the photo.
