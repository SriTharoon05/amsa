# AMSA Ayurvedic — Keshya Hair Oil

Responsive Next.js App Router storefront using React, Tailwind CSS v4, GSAP ScrollTrigger and @gsap/react. Frontend only; no payment, email or order service is connected.

## Run

```sh
npm install
npm run dev
```

Open http://localhost:3000. `npm run build` produces a static deployment in `out/`; serve that directory with any static web host. `npm run typecheck` checks TypeScript.

## Architecture

- `components/Hero.tsx`: pinned 100svh scroll narrative, scrub:true, background/midground/foreground motion, reduced-motion fallback and atomic image loading.
- `components/CartProvider.tsx`: React Context cart; add, remove, quantity updates, total calculation, capped quantities and graceful localStorage persistence.
- `components/Cart.tsx`: slide-in shopping bag and reusable quantity control.
- `components/Checkout.tsx`: required shipping fields, email/PIN validation, prefilled mock payment and confirmation; clears cart after demo submission.
- `components/Dialog.tsx`: native modal dialog with focus containment, Escape, backdrop dismissal, focus restoration and body scroll locking.
- `components/Storefront.tsx`: header, product section, ingredient cards, ritual guide, newsletter demo and post-hero floating CTA.
- `lib/product.ts`: edit the demo price (INR 1,290), size (100 ml) and product details here.

## One source image, three layers

`public/image_1.png` is the single generated product photograph. All scene layers derive from it; no 3D model, stock imagery or alternate product view is used. Your supplied logo is `public/amsa-seal.png`.

Three image-edit operations automated the segmentation and background inpainting. The existing assets work immediately:

1. `public/isolated_background.png`: wall, window and shelf, objects removed.
2. `public/isolated_bottle.png`: bottle cutout with alpha transparency.
3. `public/foreground-complete.png`: repaired bowl and jar combined, alpha transparency. Their formerly cropped edges are reconstructed and both objects have transparent padding. The original `isolated_bowl.png` is retained for provenance.

Background and bottle use 1086×1448 canvases. The repaired foreground is 1536×1024 and independently fitted in a bounded product stage; preserve those individual canvas layouts when replacing assets. Do not use cover sizing for transparent subjects, or move source-cropped object edges into the interior of the composition. The hero styles live in `app/hero.css`. Arbitrary new photographs require new masks/inpainting; segmentation is an asset-preparation step rather than a browser effect.

The hero preloads all three layers as a group. The bottle fits with contain sizing, moving upward 54px on desktop while scaling from 0.88 to 1 and rotating from -4 to 2 degrees. Foreground moves downward 65px and the background upward 12px, producing relative depth while keeping complete silhouettes inside the scene. Mobile motion is reduced to fit its own stage. Reduced-motion preferences disable pinning and animation. Only transforms and opacity animate.

## Image prompts and provenance

Built-in ImageGen created the photograph: “Photorealistic AMSA Ayurvedic Keshya Hair Oil amber bottle, black cap, cream/gold label, warm plaster wall and window sunlight, limestone shelf, saffron/cardamom/anise bowl lower left, ivory jar lower right, premium editorial product photography.”

Derived edits used that photograph as the sole target: remove and inpaint bottle/bowl/jar for the background; extract bottle with genuine transparency; extract bowl and jar together with genuine transparency. Preserve the full canvas, branding, scale, lighting and positions. These are generated concept assets, not verified commercial product photography.

Foreground repair used built-in ImageGen: reconstruct the missing left edge of the original bowl and right edge of the jar; retain their materials and golden lighting; place the complete objects left and right with transparent padding and an empty center on a 3:2 canvas. Saved as `public/foreground-complete.png`.

## Demo boundaries

Price, volume and complimentary delivery are editable concept details. Product formulation, full INCI list, delivery/return policy and commercial claims need brand confirmation before launch. Checkout uses a fixed test card and never asks for real payment credentials. Shipping fields stay in component DOM memory; only cart quantity is persisted. Newsletter submission displays local confirmation without sending/storing an email. Fonts load from Google Fonts with system fallbacks.

Before production commerce: connect a payment provider, order service, inventory and newsletter API, and replace demo copy/policies. No backend is required to explore the current UI.
