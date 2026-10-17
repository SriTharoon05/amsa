import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';
import { Box3, Vector3, Group, OrthographicCamera } from 'three';
import sharp from 'sharp';
import { ingredientNames } from '../lib/ingredients.ts';
import { getJourneyProgress, getJourneyChapter, getBlendFrame, getBotanicalPose, smoothRange, mix } from '../lib/journey.ts';

const root = new URL('../', import.meta.url);
// Decode embedded texture bytes in Node; no browser, GPU or page automation.
globalThis.self = globalThis;
globalThis.createImageBitmap = async blob => {
  const { data, info } = await sharp(Buffer.from(await blob.arrayBuffer())).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  return { width: info.width, height: info.height, data, close() {} };
};
const manifest = JSON.parse(await readFile(new URL('public/models/ingredients-manifest.json', root), 'utf8'));
assert.deepEqual(manifest.entries.map(entry => entry.name), [...ingredientNames]);
assert.equal(new Set(ingredientNames).size, 52);
assert.equal(ingredientNames.filter(name => name === 'Hibiscus rosa-sinensis').length, 1);
const loader = new GLTFLoader().setMeshoptDecoder(MeshoptDecoder);
let total = 0;
const modelBuffers = new Map();
const models = await Promise.all(['botanicals', 'keshya'].map(async name => {
  const url = new URL(`public/models/${name}.glb`, root);
  const buffer = await readFile(url); total += buffer.byteLength; modelBuffers.set(name, buffer);
  assert.equal(buffer.byteLength, manifest.compression.assets[name].afterBytes, `${name} matches its measured transfer size`);
  return loader.parseAsync(buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength), '');
}));
for (const entry of manifest.entries) {
  const node = models[0].scene.getObjectByName(entry.node);
  assert.ok(node, entry.name);
  assert.equal(node.userData.ingredient_name, entry.name);
  const bounds = new Box3().setFromObject(node);
  assert.ok(bounds.getCenter(new Vector3()).length() < .001, `${entry.name} is centered`);
  assert.ok(Math.abs(Math.max(...bounds.getSize(new Vector3()).toArray()) - .62) < .001, `${entry.name} fits the shared scale`);
}
for (const node of ['Vessel', 'Oil']) assert.ok(models[0].scene.getObjectByName(node));
for (const node of ['KeshyaBottle', 'BottleBody', 'BottleCap', 'BottleLabel']) assert.ok(models[1].scene.getObjectByName(node));
const bottleBounds = new Box3().setFromObject(models[1].scene);
assert.ok(Math.abs(bottleBounds.getSize(new Vector3()).y - 3.6) < .001);
assert.ok(total < 3_300_000, 'Detailed 3D assets stay within the 3.3 MB loading budget');
assert.equal(total, manifest.compression.totalAfterBytes);
assert.equal(manifest.compression.simplification, false);
assert.equal(manifest.compression.embeddedTextureBytesPreserved, true);
for (const metrics of Object.values(manifest.compression.assets)) {
  assert.ok(metrics.maximumComponentError.POSITION < .0001);
  assert.ok(metrics.maximumNormalAngleDegrees < .1);
  assert.ok(metrics.maximumComponentError.TEXCOORD_0 < .00001);
}

// Compare every decoded primitive with the authored native-precision archive.
// Meshopt may cyclically rotate triangle indices, which preserves winding.
const canonicalTriangle = (a, b, c) => a <= b && a <= c ? [a, b, c] : b <= a && b <= c ? [b, c, a] : [c, a, b];
const meshesByName = scene => {
  const result = new Map();
  scene.traverse(object => { if (object.isMesh) { assert.ok(!result.has(object.name)); result.set(object.name, object); } });
  return result;
};
const embeddedImages = buffer => {
  const jsonLength = buffer.readUInt32LE(12);
  const json = JSON.parse(buffer.subarray(20, 20 + jsonLength).toString());
  const binaryStart = 20 + jsonLength + 8;
  return json.images.map(image => {
    const view = json.bufferViews[image.bufferView];
    assert.equal(view.buffer, 0);
    return createHash('sha256').update(buffer.subarray(binaryStart + (view.byteOffset || 0), binaryStart + (view.byteOffset || 0) + view.byteLength)).digest('hex');
  });
};
let totalTriangles = 0, totalVertices = 0;
for (const [index, name] of ['botanicals', 'keshya'].entries()) {
  const nativeBuffer = await readFile(new URL(`design-source/model-archive/${name}-native-precision.glb`, root));
  const native = await loader.parseAsync(nativeBuffer.buffer.slice(nativeBuffer.byteOffset, nativeBuffer.byteOffset + nativeBuffer.byteLength), '');
  assert.deepEqual(embeddedImages(modelBuffers.get(name)), embeddedImages(nativeBuffer), `${name} preserves every embedded texture byte`);
  const originalMeshes = meshesByName(native.scene), currentMeshes = meshesByName(models[index].scene);
  assert.equal(currentMeshes.size, originalMeshes.size);
  let triangles = 0, vertices = 0;
  for (const [nodeName, original] of originalMeshes) {
    const current = currentMeshes.get(nodeName);
    assert.ok(current, nodeName);
    const first = original.geometry.index.array, second = current.geometry.index.array;
    assert.equal(first.length, second.length, `${nodeName}: full index count`);
    assert.equal(original.geometry.attributes.position.count, current.geometry.attributes.position.count, `${nodeName}: full vertex count`);
    for (let i = 0; i < first.length; i += 3) assert.deepEqual(canonicalTriangle(first[i], first[i + 1], first[i + 2]), canonicalTriangle(second[i], second[i + 1], second[i + 2]), `${nodeName}: triangle ${i / 3} retains winding`);
    triangles += first.length / 3; vertices += original.geometry.attributes.position.count;
  }
  assert.equal(triangles, manifest.compression.assets[name].triangleCount);
  assert.equal(vertices, manifest.compression.assets[name].vertexCount);
  totalTriangles += triangles; totalVertices += vertices;
}
assert.equal(totalTriangles, 168_670);
assert.equal(totalVertices, 100_980);
const materialSet = new Set();
models[1].scene.traverse(object => { if (object.isMesh) (Array.isArray(object.material) ? object.material : [object.material]).forEach(material => materialSet.add(material)); });
assert.ok([...materialSet].some(material => material.isMeshPhysicalMaterial && material.transmission >= .85 && material.thickness > 0 && Math.abs(material.ior - 1.46) < .02), 'Bottle uses real optical glass');
assert.ok([...materialSet].some(material => material.map?.image?.width >= 887 && material.map?.image?.height >= 1774), 'Full native label texture is embedded');
assert.ok([...materialSet].some(material => material.normalMap), 'Paper surface normal detail is embedded');
assert.ok([...materialSet].some(material => material.name === 'Keshya oil fill' && material.metalness === 0 && (!material.transmission || material.transmission === 0)), 'Inner oil participates in the web glass refraction pass');
const botanicalMaterials = new Set();
models[0].scene.traverse(object => { if (object.isMesh) (Array.isArray(object.material) ? object.material : [object.material]).forEach(material => botanicalMaterials.add(material)); });
assert.ok([...botanicalMaterials].some(material => material.map?.image?.width >= 1254), 'Full native botanical surface texture is embedded');
// Use each loaded specimen's actual bounding sphere radius with the shared
// runtime pose helper. Every visible sphere stays above the moving vessel rim.
let clearanceChecks = 0;
for (const entry of manifest.entries) {
  const object = models[0].scene.getObjectByName(entry.node);
  const hero = [1, 26, 52].includes(entry.id), angle = entry.id * 2.399963;
  const item = { angle, radius: hero ? 1.1 : 1 + (entry.id % 7) * .18, y: Math.sin(angle) * (hero ? 1.25 : 1.75), z: hero ? .9 : Math.cos(entry.id * .93) * .35, scale: hero ? 1.65 : .63 + (entry.id % 5) * .10, boundsRadius: new Box3().setFromObject(object).getSize(new Vector3()).length() / 2 };
  for (let sample = 0; sample <= 500; sample++) {
    const p = sample / 500, blend = getBlendFrame(p), pose = getBotanicalPose(p, item);
    if (!pose.visible || blend.scale <= .001) continue;
    const actualScale = Math.max(.001, pose.scale * smoothRange(p, .04, .20));
    assert.ok(pose.y - item.boundsRadius * actualScale >= blend.surface - 1e-9, `${entry.name} clears the vessel at ${p}`);
    clearanceChecks++;
  }
}
assert.ok(clearanceChecks > 5_000);

// The bottle stays complete, with its cap under the same root, and all of it
// fits the orthographic art frame in representative portrait/landscape sizes.
const centeredProduct = models[1].scene.clone(true).getObjectByName('KeshyaBottle');
const center = new Box3().setFromObject(centeredProduct).getCenter(new Vector3());
centeredProduct.position.sub(center);
assert.equal(centeredProduct.getObjectByName('BottleCap').parent, centeredProduct);
const bodyBounds = new Box3().setFromObject(centeredProduct.getObjectByName('BottleBody'));
const capBounds = new Box3().setFromObject(centeredProduct.getObjectByName('BottleCap'));
assert.ok(capBounds.min.y - bodyBounds.max.y < .03, 'Cap remains seated on the bottle neck');
assert.ok(capBounds.min.y > bodyBounds.getCenter(new Vector3()).y, 'Cap stays above the bottle body');
const world = new Group(), bottle = new Group(); world.add(bottle); bottle.add(centeredProduct);
const frameSizes = [[320, 568], [390, 844], [430, 932], [768, 1024], [1440, 900], [844, 390], [667, 375], [568, 320]];
let framingChecks = 0;
for (const [width, viewport] of frameSizes) {
  const mobile = width <= 700, header = mobile ? 70 : 78;
  const compactLandscape = mobile && viewport <= 450;
  const copy = mobile && !compactLandscape ? viewport <= 700 ? 230 : 276 : 0;
  const rail = compactLandscape ? 38 : mobile ? viewport <= 700 ? 42 : 46 : viewport <= 550 ? 42 : 66;
  const artWidth = compactLandscape ? width * .54 : mobile ? width : width * .56;
  const artHeight = viewport - header - copy - rail;
  assert.ok(artHeight > 0);
  const halfHeight = Math.max(mobile ? 2.45 : 3, 2.65 * artHeight / artWidth);
  const camera = new OrthographicCamera(-halfHeight * artWidth / artHeight, halfHeight * artWidth / artHeight, halfHeight, -halfHeight, .1, 50);
  for (const p of [0, .02, .1, .62, .7, .75, 1]) for (const x of [-.5, 0, .5]) for (const y of [-.5, 0, .5]) {
    const finalReveal = smoothRange(p, .62, .78), intro = 1 - smoothRange(p, .04, .20);
    const reveal = p >= .62 ? .82 + .18 * finalReveal : intro;
    bottle.scale.setScalar(Math.max(.001, reveal * (1 + finalReveal * .08)));
    bottle.position.set(0, mix(-.5, .03, reveal), 0);
    bottle.rotation.set(.02 + y * .05, mix(-.75, -.04, reveal) + x * .11, -.025);
    world.rotation.set(y * .025, x * .045, 0);
    camera.position.set(0, mix(3.6, .7, reveal), 11); camera.lookAt(0, 0, 0); camera.updateMatrixWorld();
    world.updateMatrixWorld(true);
    const bounds = new Box3().setFromObject(bottle);
    for (const cx of [bounds.min.x, bounds.max.x]) for (const cy of [bounds.min.y, bounds.max.y]) for (const cz of [bounds.min.z, bounds.max.z]) {
      const screen = new Vector3(cx, cy, cz).project(camera);
      assert.ok(Math.abs(screen.x) < .98 && Math.abs(screen.y) < .98, `Complete bottle fits ${width}×${viewport}, p=${p}`);
    }
    framingChecks++;
  }
  // Hero measures actual stage height plus the sticky header, including when
  // browser chrome changes dynamic viewport height while svh stays fixed.
  const top = header, height = viewport * (mobile ? 3 : 3.4);
  for (const expanded of [0, 56]) {
    const stageHeight = viewport + expanded - header, measuredViewport = stageHeight + header;
    assert.equal(getJourneyProgress(-100, top, height, measuredViewport), 0);
    assert.equal(getJourneyProgress(top + height - measuredViewport, top, height, measuredViewport), 1);
    assert.equal(getJourneyProgress(height * 2, top, height, measuredViewport), 1);
    for (let chapter = 0; chapter < 5; chapter++) {
      const scroll = top + (height - measuredViewport) * chapter / 4;
      assert.equal(getJourneyChapter(getJourneyProgress(scroll, top, height, measuredViewport)), chapter);
    }
  }
}
console.log(`Journey checks passed: 52 ingredient mappings, ${totalVertices.toLocaleString()} full vertices, ${totalTriangles.toLocaleString()} winding-preserved triangles, byte-identical native textures, ${clearanceChecks.toLocaleString()} vessel-clearance samples, ${framingChecks} complete-bottle frames, ${total.toLocaleString()} bytes, and stage/header scroll boundaries.`);
