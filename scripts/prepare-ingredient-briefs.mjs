import {readFile,writeFile} from 'node:fs/promises';
const manifest=JSON.parse(await readFile('design-source/legacy-3d/models/ingredients-manifest.json','utf8'));
const overrides={
 3:'A few oval castor seeds, glossy mottled brown and cream seed coats and pale raised caruncles.',
 4:'A tiny clear shallow glass dish containing golden amber vitamin E oil, with two round amber oil drops alongside. This is Tocopherol, a vitamin, not a plant or flower.',
 5:'A few dark red-brown alkanet root fragments with a reddish cut surface and natural rough bark.',
 6:'A small fresh flowering avaram senna sprig with bright yellow five-petalled blossoms, visible brown anthers, and paired oval green leaflets.',
 7:'A small fresh cluster of white Jasminum officinale jasmine flowers, five narrow pointed petals and a few delicate green leaflets.',
 8:'One pale blush Damask rose, many loosely layered natural petals and a short stem with two serrated green rose leaves.',
 17:'Several small creamy white star-like bakul flowers, many narrow pointed petals, with two glossy elliptical Mimusops leaves.',
 20:'A small arrangement of pale tan sandalwood heartwood chips, one short sandalwood stick and a little wood shaving. Warm natural wood grain.',
 35:'A small tied bundle of fine tan vetiver roots with a few delicate green grass blades, earthy real root texture.',
 36:'Delicate tangled golden yellow Cassytha filiformis twining stems, almost leafless, with a few tiny pale buds.',
 38:'A few irregular red-brown Indian madder root pieces showing a distinctly reddish inner cut surface.',
 40:'A few licorice root sticks with brown bark and one bright pale-yellow freshly cut cross section.',
 41:'A small cluster of nutgrass rhizome tubers with fine fibrous roots and a short green sedge blade.'
};
const shared='Use case: photorealistic-natural. Asset type: small Ayurvedic ingredient directory thumbnail. Make ONE clean, realistic botanical still-life photograph of the specified ingredient. Center the complete small specimen on a solid pale warm ivory studio surface (#eeefde), with soft diffuse light, subtle contact shadow and 12% clear margin. Square composition, large recognizable subject occupying the middle 75% of the image. Real natural texture, premium understated editorial photography. No words, labels, numbers, border, collage, packaging or watermark. No 3D illustration. This is representative ingredient imagery, not a dosage or extraction specification.';
const items=manifest.entries.map(item=>({id:item.id,name:item.name,slug:String(item.id).padStart(2,'0')+'-'+item.name.toLowerCase().replace(/[^a-z0-9]+/g,'-'),subject:overrides[item.id]||item.representation,prompt:`${shared} Subject: ${item.name}. ${overrides[item.id]||item.representation}.`,reuse:({26:'design-source/redesign/hibiscus-native.png',39:'design-source/redesign/neem-native.png',52:'design-source/redesign/coconut-native.png'})[item.id]||null}));
await writeFile('design-source/ingredient-photos/briefs.json',JSON.stringify({created:'2026-10-24',mode:'built-in image_gen',note:'Representative AI-generated ingredient photography. Plant part pictured is not an extraction specification.',items},null,2));
console.log(JSON.stringify(items));
