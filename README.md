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

## Scroll experience and quality

`components/Hero.tsx` uses one native document scroll and a bounded sticky frame. Copy and artwork share that frame, with separate grid columns on desktop and separate rows on mobile. Only the active chapter is visible and focusable. The journey is 340svh on desktop and 300svh on mobile, replacing five independently scrolling full-height text sections. Progress uses the actual stage height plus fixed header, including mobile viewport changes. Chapter links and Skip to product jump through the story. There is no nested scroll area, wheel interception or duplicate reveal screen.

`components/JourneyScene.tsx` loads Three.js separately from the initial page. The complete bottle loads first; the heavier botanical asset is deferred until scrolling starts. All 52 objects gather above an illustrative vessel and dissolve with conservative bounding-sphere clearance above its rim. Bowl, oil and ripples share a transform. Golden oil becomes a smooth droplet, then the complete bottle appears with its cap attached; vessel and droplet are hidden before that bottle phase. Camera framing fits both dimensions, including portrait tablets. The sticky scene clips within its section so it cannot spill into product content.

The detailed bottle uses optically transmissive amber glass, IOR, thickness and volume attenuation, an inner oil fill, a glossy cap and a printed paper label. A generated studio environment contains vertical softboxes and dark flags for clean glass reflections. An opaque cream gradient behind the scene provides a surface for glass refraction and matches the page background. Botanical models use detailed geometry, a photographic surface atlas, normal maps and material roughness appropriate to leaves, petals, seeds and dry husks.

Textures keep their native pixels: label artwork 887×1774 and botanical color/normal atlases 1254×1254. The hero caps display pixel ratio at 2, with automatic resolution adjustment during slow frames and restoration when motion settles. Mobile studio environment resolution is 256 instead of 512. It uses anisotropic filtering and asynchronous shader preparation. There are no shadow-map or postprocessing passes. Rendering stops when motion settles, when offscreen or when the tab is hidden. Resources are disposed on unmount. Reduced-motion preferences use discrete compositions and disable pointer motion. A WebGL/asset failure leaves the lightweight CSS/SVG illustration and all purchase controls available.

`components/ProductModel.tsx` and `ProductScene.tsx` replace the purchase photograph with the same real bottle model. It loads within 200px of the viewport, supports horizontal drag, keyboard rotation and reset controls, and renders only on interaction or resize. `lib/model-assets.ts` caches one bottle download/decode while cloning resources for independent viewers. Shared image bitmaps remain valid when either viewer unmounts. The shopping bag uses a tiny CSS thumbnail rather than another image download or WebGL context. Fonts are served locally as three Latin variable WOFF2 files with `font-display:swap`.

This is an artistic interpretation of the supplied formulation, not a verified manufacturing process or a scientific specimen collection. The ingredient list is authoritative for names; the illustrated plant part is not an extraction specification. Original photographic layers are archived in `design-source/original-imagery` and excluded from deployment.

## Detailed Blender assets

- `public/models/keshya.glb`: 841,448 bytes; 22,528 triangles. Root `KeshyaBottle`, parts `BottleBody`, `BottleCap`, `BottleLabel` and internal `BottleOilFill`. Y-up, front +Z, height 3.6 units. Native paper artwork and a subtle paper normal map are embedded. The web oil fill is opaque amber PBR so it participates in Three.js's single-pass transmission capture; the Cycles source retains refractive oil.
- `public/models/botanicals.glb`: 2,341,084 bytes; 146,142 primitive triangles, with independently addressable `Ingredient_01` through `Ingredient_52`, plus `Vessel` and `Oil`. Conservative attribute quantization and Meshopt encoding retain all 100,980 combined vertices and 168,670 combined triangles, native embedded image bytes, materials, hierarchy and triangle connectivity. This encoding is not mathematically lossless for positions/normals/UVs: measured maximum position error is 0.00003052 units, normal angle 0.05791°, UV error 0.000007635. No decimation or texture resizing is used. The decoder loads locally without a decoder CDN.
- `public/models/ingredients-manifest.json`: exact supplied ingredient names, representations and node mappings. The upgraded specimens correct old mapping errors and show distinct seeds, fanned sprigs, flowers, bark, roots, fruits and coconut.
- Combined detailed GLBs are 3,182,532 bytes, down 38.8% from 5,200,376 bytes. The initial model request is only the 841,448-byte bottle; botanical loading follows scroll interaction. These are asset transfer measurements, not a device speed score.

### Reproducible source

- `scripts/create-realistic-bottle.py`: regenerate the reference-matched bottle in Blender; `--export-only` skips the studio render and `--preview` creates a smaller proof. Default studio proof is 2000×2600 with 128 Cycles samples.
- `scripts/create-realistic-botanicals.py`: regenerate the detailed botanical assets and proofs. The model export keeps full-resolution textures and uses lossless Meshopt.
- `scripts/optimize-web-models.py`: repeat the conservative web optimization; native unoptimized exports are preserved in `design-source/model-archive`. Exact error measurements and topology counts are recorded in the public ingredient manifest.
- `design-source/bottle-realistic-v2.blend` and `design-source/botanicals-realistic.blend`: editable Blender source with packed materials/textures.
- `design-source/bottle-realistic-preview.png`, `design-source/botanicals-realistic-collection.png` and `design-source/botanicals-realistic-detail.png`: inspected Cycles renders, not browser screenshots.
- `design-source/textures/keshya-label-v2.png` and `design-source/textures/botanical-atlas-v2.png`: native image-generation outputs. `design-source/textures/provenance.json` contains the exact prompts, built-in image-generation mode, source reference and native resolutions. The 52-ingredient label follows the owner's supplied list rather than the reference image's older 18-herb text.
- Original texture-free generator/source remains for provenance and should not be run over the detailed assets.

The source, original textures and proof images are excluded from the static build; deployed textures are embedded in the GLBs. `node scripts/verify-journey.mjs` decodes GLB textures in Node and checks exact names, all 52 nodes, mesh bounds, physical glass, native image dimensions, paper normals, the asset budget, bottle parts and scroll boundaries.

## Storefront and ingredients

`components/Storefront.tsx` and `app/storefront.css` provide the fixed header, product purchase controls, botanical index preview, ritual, footer and floating purchase button. The full formulation at `/ingredients` is generated from `lib/ingredients.ts`: 52 unique supplied names, with Hibiscus rosa-sinensis shown once. Search, letter filters, sorting, card/list views and GSAP directory animations remain available.

`CartProvider.tsx` manages quantities and subtotal; only cart quantity is persisted locally. `Cart.tsx`, `Checkout.tsx` and `Dialog.tsx` provide the drawer, required shipping fields, fixed mock payment, local order confirmation, focus containment, Escape dismissal and focus restoration. Ingredients and homepage share the saved quantity.

`lib/product.ts` contains the editable demo price (INR 1,290) and volume (100 ml). Delivery policies and price are concept details that need brand confirmation before real commerce. Checkout does not collect real payment credentials. Shipping fields remain in DOM/component memory. Newsletter signup confirms locally without sending or storing an email.

## Verification limits

Production compilation, TypeScript and textured ingredient/model contract checks pass. Blender proofs were inspected at high resolution, and camera projection was checked across mobile, tablet and desktop aspect ratios. Browser automation remains blocked by its security policy in this environment, so final live WebGL lighting, scroll motion and actual device frame rates are unverified. Cycles renders show the modeled materials and geometry; browser rendering uses a different lighting/rendering engine. No speed score is claimed.

## Original imagery provenance

The archived product photograph and isolated image layers were generated with ImageGen from the provided AMSA branding. The photograph is a concept asset, not verified commercial product photography. Those assets are no longer deployed or loaded by the storefront. Self-hosted Google Fonts retain their open font licenses and source URLs in `public/fonts`.
