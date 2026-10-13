# AMSA Ayurvedic — Keshya Hair Oil

A responsive frontend storefront with a Blender-built 3D botanical journey, an ingredient directory and mock shopping/checkout flows. No payment, order or newsletter backend is connected.

## Run and verify

```
npm install
npm run dev
npm run typecheck
node scripts/verify-journey.mjs
npm run build
```

The static export is written to `out/`. Hosting identity remains in `.openai/hosting.json`.

## Scroll experience

`components/Hero.tsx` renders five readable chapters in native document flow. A CSS sticky scene changes with the document scroll; there is no ScrollTrigger pin, nested scroll container, scroll hijacking or duplicate reveal screen. Chapter links and Skip to product let visitors jump through the story.

`components/JourneyScene.tsx` loads Three.js in a separate client bundle and the two Blender GLBs. All 52 botanical objects gather into an illustrative blending vessel; golden oil becomes a droplet and the bottle assembles with a cap reveal. Camera framing fits both dimensions, including portrait tablets. The renderer uses capped resolution, no shadow-map or postprocessing passes, a procedural contact shadow and request-on-change rendering. It stops when movement settles, when offscreen or when the tab is hidden. GPU resources are disposed on unmount. Reduced-motion preferences use discrete chapter compositions and disable pointer motion. WebGL failure leaves a lightweight SVG/CSS illustration and all content/purchase controls available.

This is an artistic representation of the supplied formulation, not a verified manufacturing process or scientific specimen collection. Botanical models are stylized and share geometric families. The original generated photograph is retained in the product purchase section.

## Blender assets

- `public/models/keshya.glb`: amber bottle, black cap and cream label with mesh lettering. Root `KeshyaBottle`, parts `BottleBody`, `BottleCap`, `BottleLabel`. Y-up, front +Z, height 3.6 units.
- `public/models/botanicals.glb`: 52 centered groups `Ingredient_01` through `Ingredient_52`, plus `Vessel` and `Oil`. Shared meshes, no textures or external dependencies. Combined GLBs are approximately 748 KB.
- `public/models/ingredients-manifest.json`: the exact supplied ingredient name associated with each 3D node.
- `scripts/create-journey-assets.py`: reproducible Blender source generation and GLB export. Run with Blender `--background --python scripts/create-journey-assets.py`.
- `design-source/amsa-journey.blend`: editable Blender source; preview images alongside it. These source/preview files are not part of the static deployment.

`node scripts/verify-journey.mjs` validates exact names and model metadata, all 52 nodes, mesh bounds, bottle parts, the asset size budget and scroll boundaries.

## Storefront and ingredients

`components/Storefront.tsx` and `app/storefront.css` provide the fixed header, product purchase controls, botanical index preview, ritual, footer and floating purchase button. The full formulation at `/ingredients` is generated from `lib/ingredients.ts`: 52 unique supplied names, with Hibiscus rosa-sinensis shown once. Search, letter filters, sorting, card/list views and GSAP directory animations remain available.

`CartProvider.tsx` manages quantities and subtotal; only the cart quantity is persisted locally. `Cart.tsx`, `Checkout.tsx` and `Dialog.tsx` provide the shopping drawer, required shipping fields, fixed mock payment, local order confirmation, focus containment, Escape dismissal and focus restoration. Ingredients and homepage share the saved quantity.

`lib/product.ts` contains the editable demo price (INR 1,290), volume (100 ml) and image. Delivery policies and price are concept details that need brand confirmation before real commerce. Checkout does not collect real payment credentials. Shipping fields remain in DOM/component memory. Newsletter signup confirms locally without sending or storing an email.

## Verification

Production compilation, TypeScript and ingredient/model contract checks pass. Blender studio and bottle previews were visually inspected. Browser automation is blocked by its security policy in this environment, so the final browser appearance, scroll motion and actual device frame rates remain unverified. Camera projection and responsive spacing were reviewed mathematically; no speed score is claimed.

## Original imagery provenance

The existing product photograph and isolated image layers were generated with ImageGen from the provided AMSA branding. The photograph is a concept asset, not verified commercial product photography. Old photographic parallax layers remain available for provenance but are no longer loaded by the homepage hero. Fonts use Google Fonts with system fallbacks.
