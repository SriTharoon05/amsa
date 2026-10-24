# AMSA Ayurvedic — Good roots. Great rituals.

A complete lightweight redesign of the Keshya Hair Oil storefront. Forest green, warm cream, botanical photography and expressive serif typography replace the former 3D scroll journey. Both pages use normal document scrolling, responsive layouts and small CSS transitions.

## Run

```sh
npm install
npm run dev
npm run typecheck
npm run build
node scripts/verify-storefront.mjs
```

Next.js statically exports `/` and `/ingredients` into `out/`. `.openai/hosting.json` retains the existing Site identity. The source is also maintained at https://github.com/SriTharoon05/amsa.

## Architecture

- `components/Storefront.tsx`: photographic product hero, brand story, ingredient gallery, product purchase section, ritual, FAQ and floating shopping button.
- `components/SiteChrome.tsx`: shared responsive navigation, footer, local newsletter feedback and shopping dialogs. Drawer/checkout code loads only when opened.
- `components/IngredientsExplorer.tsx`: redesigned directory with search, first-letter filters, sorting, card/list views and links that prefill a selected ingredient.
- `lib/ingredients.ts`: 52 unique brand-supplied ingredient names in supplied order. Hibiscus rosa-sinensis appears once.
- `CartProvider.tsx`, `Cart.tsx`, `Checkout.tsx`, `Dialog.tsx`: persistent quantity, subtotal, removal, drawer and native modal demo checkout. Only quantity is saved locally.
- `app/globals.css` and `app/ingredients.css`: complete design system, mobile layouts, keyboard focus styles and reduced-motion support.

No Three.js, WebGL, GSAP, scroll pinning, model downloads or animation render loop remains in the website. Former components, CSS and deployed models are archived under `design-source/legacy-3d`; original Blender sources remain in `design-source`. Those directories are excluded from the static export.

## Image and font budgets

Five concept photographs were created with built-in ImageGen: reference-matched AMSA bottle, an illustrative hair-care moment, coconut, hibiscus and neem. These are generated brand visuals, not customer testimonials or verified product photography. The bottle label uses the supplied 52-ingredient formulation instead of the reference image's older 18-herb line.

The native images and provenance are retained in `design-source/redesign`. `scripts/prepare-redesign-assets.mjs` reproduces the responsive WebP files from those native images; it only trims transparent margins, resizes and compresses. The product silhouette and complete cap/base are preserved.

- Bottle: 28,010 bytes at 600px tall, 83,842 bytes at 1200px tall, with transparency.
- Editorial photograph: 25,772 / 73,954 bytes.
- Botanical photographs: 14,244–41,644 bytes each, depending on size.
- All ten responsive WebP files together: under 500 KB. Browsers choose the appropriate responsive sizes; below-fold images load lazily.
- Three self-hosted Latin variable fonts: 101,736 bytes combined, with `font-display:swap`, primary font preloads, source hashes and OFL licenses.

Only the hero bottle receives high fetch priority. Native image dimensions reserve layout space. The shopping bag reuses the compressed bottle asset. No external font service or image CDN is required.

## Store preview

The price is INR 1,290 for 100 ml, editable in `lib/product.ts`. This remains a frontend concept: no payments, orders or newsletters are sent. Checkout uses required shipping fields and a fixed mock card; it never asks for real card credentials. Shipping fields stay in the mounted form. Newsletter confirmation is local and does not store an email. Product use directions, pricing and delivery terms need brand confirmation before real commerce.

## Validation limits

Production compilation, TypeScript, ingredient filter checks, responsive image metadata, static export routes, bundle exclusions and media budgets are checked locally. Browser automation is blocked by policy in this environment; actual browser rendering, mobile interaction and device performance scores are not claimed as verified. No Lighthouse score is invented.

## Ingredient card images

Every ingredient has a distinct local WebP thumbnail, served only on `/ingredients`. The matching helper is `lib/ingredient-images.ts`; existing search, letter filters, sorting and card/list modes all retain the same cached image URL for each ingredient. Grid cards show a reserved 4:3 photo area, while list rows reuse the same file as a compact thumbnail.

The native photos, exact generation prompts and optimized per-file manifest are retained in `design-source/ingredient-photos`. Existing coconut, hibiscus and neem photographs are reused from the redesign source. Other images are representative AI-generated ingredient photography; pictured plant parts do not imply an extraction specification. That distinction is also stated on the directory page.

Run `node scripts/optimize-ingredient-photos.mjs` to resize and compress the native sources. Output is fixed at 240×180 with a strict 6 KB per-image maximum and 250 KB total budget for all 52 thumbnails. Each image uses native `loading="lazy"`, `decoding="async"` and low fetch priority, with explicit dimensions to reserve space. No third-party image service, base64 bundle payload, animation library, observer or new JavaScript dependency is added. The homepage does not reference these images.

The storefront verifier checks the complete name/image mapping, all 52 distinct files, dimensions and byte budgets, lazy-loading attributes, deployed asset existence and the unchanged original homepage photo budget.

Full-size newly generated ingredient source PNGs are retained locally but ignored by Git to keep repository transfers small. The optimized thumbnails, exact image-generation prompts and byte/hash manifest are versioned. Recompression requires the local native source cache; the deployed website only needs the tracked WebP files.

Directory styles are imported by the ingredients route rather than the root layout, so the homepage does not load the ingredient-card stylesheet.
