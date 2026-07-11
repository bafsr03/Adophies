# Turning on the SALE tab

The theme now has a gold **SALE** tab built into the menu (desktop and mobile). It's
smart: it stays hidden until you have a "Sale" collection with at least one product,
then shows up on its own — and disappears again if the collection is ever empty. So
there's no dead "Sale" link when nothing's on sale.

Your only job is to create the collection. One time, ~2 minutes.

## Create the Sale collection

**Shopify Admin → Products → Collections → Create collection**

1. **Title:** `Sale`
2. **Collection type:** choose **Automated**, with this one condition:
   - *Compare-at price* → *is not empty*

   This means any product you discount (by setting a "Compare-at price" higher than
   the price) jumps into the Sale collection automatically — and leaves it when the
   sale ends. Zero upkeep.

   > Prefer hand-picking? Choose **Manual** instead and add products yourself.
   > Both work; automated is just less to remember.
3. **Important — the web address must be `sale`:** scroll to **Search engine listing
   → Edit website SEO** and make sure **URL handle** says exactly `sale`
   (so the page is `adophies.com/collections/sale`). It usually fills in
   automatically from the title.
4. Make sure the collection is **published to the Online Store** (Sales channels box
   on the right), then **Save**.

## Check it

Put one product on sale (give it a Compare-at price) — or add one manually — then
refresh your site. The gold **SALE** tab appears in the top menu and in the mobile
menu, right after Charm Bar.

## To hide it later

Nothing to do — when the collection has no products (sale's over), the tab hides
itself automatically.
