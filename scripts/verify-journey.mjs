import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { Box3, Vector3 } from 'three';
import { ingredientNames } from '../lib/ingredients.ts';
import { getJourneyProgress, getJourneyChapter } from '../lib/journey.ts';

const root = new URL('../', import.meta.url);
const manifest = JSON.parse(await readFile(new URL('public/models/ingredients-manifest.json', root), 'utf8'));
assert.deepEqual(manifest.entries.map(entry => entry.name), [...ingredientNames]);
assert.equal(new Set(ingredientNames).size, 52);
assert.equal(ingredientNames.filter(name => name === 'Hibiscus rosa-sinensis').length, 1);
const loader = new GLTFLoader();
let total = 0;
const models = await Promise.all(['botanicals', 'keshya'].map(async name => {
  const url = new URL(`public/models/${name}.glb`, root);
  const buffer = await readFile(url); total += buffer.byteLength;
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
assert.ok(total < 1_000_000, 'Combined 3D asset budget stays below 1 MB');
for (const viewport of [568, 844, 900, 1180]) {
  const height = Math.max(650, viewport) * 5;
  assert.equal(getJourneyProgress(-100, 0, height, viewport), 0);
  assert.equal(getJourneyProgress(height - viewport, 0, height, viewport), 1);
  assert.equal(getJourneyProgress(height * 2, 0, height, viewport), 1);
  for (let chapter = 0; chapter < 5; chapter++) assert.equal(getJourneyChapter(chapter / 4), chapter);
}
console.log(`Journey checks passed: 52 exact ingredient/model mappings, centered meshes, bottle parts, ${total.toLocaleString()} bytes, and scroll boundaries.`);
