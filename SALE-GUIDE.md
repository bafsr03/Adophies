# Running a sale

Everything on the site that says "on sale" — the rose sale price, the **50% OFF** badge,
the struck-through original price, the SALE tab's collection — works off one thing:
the variant's **Compare-at price** being higher than its **Price**.

That's why discounting by hand means typing two numbers on every variant. This guide is
how to stop doing that.

---

## What you do from now on

**One-time setup (about 5 minutes), then every sale is three clicks.**

### One time only — install the app

Shopify Admin → **Apps** → search **Smart Bulk Price Editor** → **Install**.

The **free plan is $0** and covers up to 100 products per sale, with rollback and
scheduling included. If you ever outgrow it, it's $8/month or $100 once, forever.

(Alternative if you prefer it: **Bulk Price Editor ‑ Springify** — also has a free tier,
100 price changes a month.)

### Every time you want a sale

1. Open the app → **New campaign** (some versions call it "New price job").
2. **Which products:** choose **Collection** → **Sale**.
3. **What to do:** *Decrease price* → **50** → **%**. (Or 60, or whatever you want.)
4. Turn ON **"Set compare-at price to original price."**
   ⚠️ **This is the one setting that matters.** It's what makes your site show the
   crossed-out original price and the **50% OFF** badge. Without it the price just
   quietly drops and nothing looks like a sale.
5. **Rounding:** set prices to end in **.99**, so $39.99 at 50% off becomes $19.99
   instead of $20.00.
6. **Apply.** Every variant of every product in the collection updates at once — the
   4-variant items included. No more opening products one by one.

Want it to run by itself? Set a **start and end date** in the same screen — it'll start
Friday and put the prices back Monday without you touching anything.

### Every time you want to end a sale

Open the app → find the campaign → **Rollback**. Original prices come back and the
compare-at prices are cleared, so the site stops showing the sale on its own.

> ⚠️ Always end a sale with **Rollback**, never by editing prices by hand. If a
> compare-at price gets left behind, that product keeps showing as discounted forever.

### Changing your mind mid-sale

Want to go from 50% to 60%? Just run it again at 60%. It discounts from the original
price, not from the already-discounted one — so you'll never accidentally end up at 80%
off.

---

## What customers will see

Once a product has a compare-at price above its price:

- **Collection and jewelry pages:** original price struck through, sale price in rose, and
  a small **50% OFF** badge.
- **Product page:** the same, and the badge updates when they switch variants — so a
  product where only one size is discounted shows correctly.
- **Cart and checkout:** the discounted price, no code needed.

The percentage is calculated from the real prices, so it's always accurate — 40% off shows
"40% OFF" without anyone typing it.

---

## The SALE tab

The gold **SALE** tab in the menu points at `adophies.com/collections/sale` and is
**always visible**.

Which means: **if the Sale collection is empty, that tab is a dead end.** Either keep
something in it, or ask us to hide the tab between sales.

Set the collection up once (Shopify Admin → **Products → Collections → Create collection**):

- **Title:** `Sale`
- **Type:** **Automated**, with the condition *Compare-at price* → *is not empty*.
  Anything discounted joins the collection on its own and leaves when the sale ends.
- **URL handle** must be exactly `sale` (under *Search engine listing → Edit website SEO*).
- Published to the **Online Store**.

---

## If you'd rather not use an app at all

Message us with the collection and the percentage — "50% off the Sale collection" — and we
run it for you in a few seconds, and revert it just as fast when the sale is over. Costs
nothing; the only trade-off is that you go through us to start and stop a sale.

Technical details of that route are in `scripts/README.md`.
