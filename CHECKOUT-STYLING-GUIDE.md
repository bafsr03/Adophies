# Making checkout match the cart page

Your cart page's cream / gold / brown look is styled by the theme — but Shopify renders
**checkout separately**, so the theme can't touch it. Checkout has its own style panel
in the admin. This is a one-time, ~3 minute change; nothing here can break checkout,
and every step can be undone.

## Where to go

**Shopify Admin → Settings → Checkout →** click **Customize** on your checkout profile.
In the editor that opens, click the **paintbrush (Branding / Design) icon** in the left
sidebar. That panel is where the current pink background, sparkle image, and Playfair
Display font live.

## What to set (exact values from your cart page)

| Setting | Value | Matches |
|---|---|---|
| **Background color** | `#fffaec` | The warm cream behind "Your cart" |
| **Background image** | Remove it (the pink sparkles) | The cart has a plain cream background — keeping the image will cover the new color |
| **Order summary / sidebar background** | `#feefe7` | The soft cream used on cart fields |
| **Heading font** | `Cormorant Garamond` | Your cart's serif headings |
| **Body font** | `Cormorant Garamond` | Same as above |
| **Accent color** (links, highlights) | `#deb071` | The gold of "Continue shopping" / "Remove" |
| **Button color** | `#544541` | The brown CHECK OUT pill button |
| **Button text** | `#fffaec` (if offered) | Cream text on the brown button |
| **Corner radius** (if offered) | Fullest / "Pill" | Your cart's rounded buttons |
| **Error color** | Leave as-is | Errors should stay loud and readable |

Your logo is already set and stays as-is.

> If you'd rather keep the gold sparkles, that works too — just re-upload the sparkle
> image on a **cream** background instead of pink, or leave it and skip the background
> color change. Your call on the vibes. ✨

## Check it

Click **Save**, then from the store add anything to the cart and hit checkout — you
should see cream background, gold links, the serif font, and the brown button, just
like the cart page.

## If you get stuck

Send a screenshot of the branding panel you see — the checkout editor's option names
vary slightly by store, and we can map these values to whatever yours shows.
