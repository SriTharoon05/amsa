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

`components/Hero.tsx` renders five readable chapters in native document flow. A CSS sticky scene changes with document scroll; there is no ScrollTrigger pin, nested scroll container, scroll hijacking or duplicate reveal screen. Chapter links and Skip to product let visitors jump through the story.

`components/JourneyScene.tsx` loads Three.js separately from the initial page. All 52 botanical objects gather into an illustrative vessel, golden oil forms a droplet and the bottle assembles with a cap reveal. Camera framing fits both dimensions, including portrait tablets. The camera moves from a raised botanical view to a nearly frontal bottle composition.

The detailed bottle uses optically transmissive amber glass, IOR, thickness and volume attenuation, an inner oil fill, a glossy cap and a printed paper label. A generated studio environment contains vertical softboxes and dark flags for clean glass reflections. An opaque cream gradient behind the scene provides a surface for glass refraction and matches the page background. Botanical models use detailed geometry, a photographic surface atlas, normal maps and material roughness appropriate to leaves, petals, seeds and dry husks.

Textures keep their native pixels: label artwork 887×1774 and botanical color/normal atlases 1254×1254. The renderer uses native device pixel ratio up to 3 for settled views, with automatic resolution adjustment during slow animation frames and restoration to native detail when motion settles. It uses anisotropic texture filtering and asynchronous shader preparation. There are no shadow-map or postprocessing passes; a small procedural contact shadow sits beneath the product. Rendering stops when motion settles, when offscreen or when the tab is hidden. Resources are disposed on unmount. Reduced-motion preferences use discrete chapter compositions and disable pointer motion. A WebGL/asset failure leaves the lightweight illustration and all content/purchase controls available.

This is an artistic interpretation of the supplied formulation, not a verified manufacturing process or a scientific specimen collection. The ingredient list is authoritative for names; the illustrated plant part is not an extraction specification. The original generated photograph remains in the purchase section.

## Detailed Blender assets

- `public/models/keshya.glb`: 1,229,312 bytes; 22,528 triangles. Root `KeshyaBottle`, animated parts `BottleBody`, `BottleCap`, `BottleLabel` and internal `BottleOilFill`. Y-up, front +Z, height 3.6 units. Native paper artwork and a subtle paper normal map are embedded. The web oil fill is opaque amber PBR so it participates in Three.js's single-pass transmission capture; the Cycles source retains refractive oil.
- `public/models/botanicals.glb`: 3,971,064 bytes; detailed independently addressable `Ingredient_01` through `Ingredient_52`, plus `Vessel` and `Oil`. Meshopt encoding is lossless: the decoded position, normal, UV and vertex-color buffers are byte-for-byte identical to the plain export. No geometry or texture resolution was reduced. Both atlases are embedded. Three's bundled decoder loads locally, without an external decoder CDN.
- `public/models/ingredients-manifest.json`: exact supplied ingredient names, representations and node mappings. The upgraded specimens correct old mapping errors and show distinct seeds, fanned sprigs, flowers, bark, roots, fruits and coconut.
- Combined detailed GLBs are approximately 5.20 MB. The initial page text is independent of the 3D download; the heavier detail is loaded separately.

### Reproducible source

- `scripts/create-realistic-bottle.py`: regenerate the reference-matched bottle in Blender; `--export-only` skips the studio render and `--preview` creates a smaller proof. Default studio proof is 2000×2600 with 128 Cycles samples.
- `scripts/create-realistic-botanicals.py`: regenerate the detailed botanical assets and proofs. The model export keeps full-resolution textures and uses lossless Meshopt.
- `design-source/bottle-realistic-v2.blend` and `design-source/botanicals-realistic.blend`: editable Blender source with packed materials/textures.
- `design-source/bottle-realistic-preview.png`, `design-source/botanicals-realistic-collection.png` and `design-source/botanicals-realistic-detail.png`: inspected Cycles renders, not browser screenshots.
- `design-source/textures/keshya-label-v2.png` and `design-source/textures/botanical-atlas-v2.png`: native image-generation outputs. `design-source/textures/provenance.json` contains the exact prompts, built-in image-generation mode, source reference and native resolutions. The 52-ingredient label follows the owner's supplied list rather than the reference image's older 18-herb text.
- Original texture-free generator/source remains for provenance and should not be run over the detailed assets.

The source, original textures and proof images are excluded from the static build; deployed textures are embedded in the GLBs. `node scripts/verify-journey.mjs` decodes GLB textures in Node and checks exact names, all 52 nodes, mesh bounds, physical glass, native image dimensions, paper normals, the asset budget, bottle parts and scroll boundaries.

## Storefront and ingredients

`components/Storefront.tsx` and `app/storefront.css` provide the fixed header, product purchase controls, botanical index preview, ritual, footer and floating purchase button. The full formulation at `/ingredients` is generated from `lib/ingredients.ts`: 52 unique supplied names, with Hibiscus rosa-sinensis shown once. Search, letter filters, sorting, card/list views and GSAP directory animations remain available.

`CartProvider.tsx` manages quantities and subtotal; only cart quantity is persisted locally. `Cart.tsx`, `Checkout.tsx` and `Dialog.tsx` provide the drawer, required shipping fields, fixed mock payment, local order confirmation, focus containment, Escape dismissal and focus restoration. Ingredients and homepage share the saved quantity.

`lib/product.ts` contains the editable demo price (INR 1,290), volume (100 ml) and image. Delivery policies and price are concept details that need brand confirmation before real commerce. Checkout does not collect real payment credentials. Shipping fields remain in DOM/component memory. Newsletter signup confirms locally without sending or storing an email.

## Verification limits

Production compilation, TypeScript and textured ingredient/model contract checks pass. Blender proofs were inspected at high resolution, and camera projection was checked across mobile, tablet and desktop aspect ratios. Browser automation remains blocked by its security policy in this environment, so final live WebGL lighting, scroll motion and actual device frame rates are unverified. Cycles renders show the modeled materials and geometry; browser rendering uses a different lighting/rendering engine. No speed score is claimed.

## Original imagery provenance

The existing product photograph and isolated image layers were generated with ImageGen from the provided AMSA branding. The photograph is a concept asset, not verified commercial product photography. Old photographic parallax layers remain for provenance but are no longer loaded by the homepage hero. Fonts use Google Fonts with system fallbacks.
