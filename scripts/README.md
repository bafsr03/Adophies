# Adophies 3D asset pipeline

Your 15 raw `.glb` files total **432 MB**. Some single files are 75–111 MB.
That's a non-starter for a public website. This folder is the workflow that
turns them into web-ready assets and hosts them via Shopify Files.

## One-time setup

Install Node.js (>= 18) if you don't have it, then:

```bash
npm install -g @gltf-transform/cli
```

That's the only dependency.

## Step 1 — Compress every GLB

From the theme root:

```bash
bash scripts/compress-glb.sh
```

That reads `../JewelryRenders/` and writes optimized copies to
`../compressed-glb/`. Expect each file to shrink **20–50×**:

| File                | Raw     | Target    |
|---------------------|---------|-----------|
| bracelet001.glb     | 111 MB  | ~3–5 MB   |
| earing005.glb       | 75 MB   | ~2–4 MB   |
| earing002.glb       | 28 MB   | ~1–3 MB   |
| Ring003.glb         | 5 MB    | <1 MB     |

If a file ends up too detailed (still > 5 MB), re-run that one with a
smaller texture size:

```bash
TEX_SIZE=512 bash scripts/compress-glb.sh
```

## Step 2 — Generate a poster image per model

Each card on the website shows a **2D poster first** and only loads the
GLB when the visitor clicks it. So you need one `.png` (or `.webp`) per
model.

Easiest path:

1. Open https://modelviewer.dev/editor/ in a browser
2. Drag in `compressed-glb/Ring001.glb`
3. Frame the model nicely
4. Right-click the canvas → **Save image as** → `Ring001.png`
5. Repeat for all 15

Aim for ~600 × 600 px posters. Keep them under ~200 KB each.

(If you have Blender or a 3D app already, screenshot from there instead.)

## Step 3 — Upload to Shopify

In your Shopify admin:

1. Go to **Content** → **Files**
2. Upload everything from `../compressed-glb/`
3. Upload every poster `.png` you made in step 2
4. For each file, click it and copy the CDN URL (looks like
   `https://cdn.shopify.com/s/files/1/xxxx/yyyy/files/Ring001.glb`)

## Step 4 — Wire into the theme

In the Shopify theme customizer:

- Homepage → **Jewelry 3D Teaser** section → fill in the 3 featured pieces
  (paste their GLB URL + poster URL + name + material + price)
- Pages → **Charm Bar** → **Jewelry 3D Gallery** section → add a block
  per piece (one per model, up to 15+)

That's it. The theme handles the rest: lazy loading, poster-first
display, click-to-reveal GLB downloads, mobile fullscreen viewing,
shared lighting environment.

## How the loading strategy keeps the page fast

- **Homepage teaser (3 pieces):** loads eagerly, total budget ~10 MB
  post-compression. Below the fold so it doesn't block hero.
- **Charm Bar gallery (15 pieces):** initial load is **just the 15 poster
  PNGs** (~2–3 MB total). GLBs are downloaded one at a time, only when
  the visitor clicks a card. So a visitor who looks at 4 of 15 only ever
  pays for 4 GLBs.
- **Mobile:** clicking a card opens a fullscreen modal with one big
  viewer. The grid cards stay as posters. Keeps GPU memory bounded.
- **Reduced motion:** auto-rotate is disabled if
  `prefers-reduced-motion: reduce` is set.
