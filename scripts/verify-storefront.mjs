import assert from 'node:assert/strict';
import {readFile,readdir,stat} from 'node:fs/promises';
import {join} from 'node:path';
import {gzipSync} from 'node:zlib';
import sharp from 'sharp';
import {ingredientNames,filterIngredients,ingredientCount,ingredientRanges} from '../lib/ingredients.ts';
const walk=async dir=>(await Promise.all((await readdir(dir,{withFileTypes:true})).map(async item=>item.isDirectory()?walk(join(dir,item.name)):[join(dir,item.name)]))).flat();
assert.equal(ingredientCount,52);assert.equal(new Set(ingredientNames).size,52);
assert.equal(ingredientNames.filter(name=>name==='Hibiscus rosa-sinensis').length,1);
assert.equal(filterIngredients('  COCOS NUCIFERA  ')[0]?.name,'Cocos nucifera');
assert.equal(filterIngredients('not-an-ingredient').length,0);
assert.equal(filterIngredients('', 'All ingredients', 'alphabetical')[0].name,'Acalypha indica');
const groupNames=ingredientRanges.slice(1).flatMap(range=>filterIngredients('',range).map(item=>item.name));
assert.equal(groupNames.length,52);assert.equal(new Set(groupNames).size,52);
for(const name of ['Cocos nucifera','Hibiscus rosa-sinensis','Azadirachta indica'])assert.equal(filterIngredients(name).length,1);
const all=await walk('out');
assert.ok(!all.some(name=>/\.(glb|gltf|blend)$/.test(name)),'No model assets are deployed');
const pkg=JSON.parse(await readFile('package.json','utf8'));
for(const library of ['three','gsap','@gsap/react'])assert.ok(!pkg.dependencies[library],`${library} removed`);
let imageBytes=0;
for(const file of await walk('public/images')){imageBytes+=(await stat(file)).size;const meta=await sharp(file).metadata();assert.equal(meta.format,'webp');if(file.includes('bottle'))assert.ok(meta.hasAlpha,'Transparent product silhouette');}
assert.ok(imageBytes<500000,'Every responsive photo together is under 500 KB');
const home=await readFile('out/index.html','utf8'),directory=await readFile('out/ingredients.html','utf8').catch(()=>readFile('out/ingredients/index.html','utf8'));
assert.ok(home.includes('Good roots.'));assert.ok(home.includes('Add to bag'));assert.ok(home.includes('hero-bottle'));assert.ok(directory.includes('Nature has'));
for(const name of ingredientNames)assert.ok(directory.includes(name),`Server-rendered ingredient ${name}`);
assert.ok(!home.includes('<canvas'));assert.ok(!home.includes('.glb'));assert.ok(!home.includes('fonts.googleapis.com'));
for(const id of ['shop','ingredients','ritual','story'])assert.ok(home.includes(`id="${id}"`));
for(const page of [home,directory]){
 for(const match of page.matchAll(/(?:src|href)="(\/(?:images|fonts)\/[^"?]+)"/g))assert.ok(all.some(path=>path.replaceAll('\\','/').endsWith(match[1])),`Referenced asset exists: ${match[1]}`);
}
let jsBytes=0,gzipBytes=0;
for(const file of all.filter(file=>file.endsWith('.js'))){const bytes=await readFile(file);jsBytes+=bytes.length;gzipBytes+=gzipSync(bytes).length;const source=bytes.toString();assert.ok(!source.includes('WebGLRenderer')&&!source.includes('MeshoptDecoder')&&!source.includes('ScrollTrigger'),'No 3D/scroll engine in deployed JavaScript');}
assert.ok(gzipBytes<200*1024,'All deployed JavaScript chunks together stay under 200 KiB gzipped');
let initialJsGzip=0;
for(const match of home.matchAll(/<script[^>]*src="([^"?]+)"[^>]*>/g)){
 if(/nomodule/i.test(match[0]))continue;
 initialJsGzip+=gzipSync(await readFile('out'+match[1])).length;
}
console.log(JSON.stringify({passed:true,ingredients:52,photosBytes:imageBytes,allJavaScriptBytes:jsBytes,allJavaScriptGzipBytes:gzipBytes,homepageModernJavaScriptGzipBytes:initialJsGzip,routes:['/','/ingredients'],no3D:true},null,2));

