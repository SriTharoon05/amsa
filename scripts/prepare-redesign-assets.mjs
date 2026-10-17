import sharp from 'sharp';
import {writeFile} from 'node:fs/promises';
import path from 'node:path';
const base='design-source/redesign';
const inputs=Object.fromEntries(['bottle','ritual','coconut','hibiscus','neem'].map(name=>[name,name+'-native.png']));
const assets=[];
for(const [name,file] of Object.entries(inputs)){
 const src=path.join(base,file);
 for(const size of name==='bottle'?[600,1200]:name==='ritual'?[640,1200]:[400,700]){
  let pipeline=sharp(src);
  if(name==='bottle')pipeline=pipeline.trim({threshold:10}).resize({height:size,withoutEnlargement:true});
  else pipeline=pipeline.resize({width:size,withoutEnlargement:true});
  const out=`public/images/${name}-${size}.webp`;
  const info=await pipeline.webp({quality:name==='bottle'?84:76,effort:6,alphaQuality:95}).toFile(out);
  assets.push({path:out,bytes:info.size,width:info.width,height:info.height});
 }
}
await writeFile('design-source/redesign/provenance.json',JSON.stringify({created:'2026-10-17',tool:'Built-in ImageGen',type:'AI-generated concept photography; no real customer or endorsement implied',reference:'Brand-supplied Amber Keshya Hair Oil Bottle.png; packaging text updated to 52 Ingredients',processing:'Only transparent bounds trimming, responsive resizing and WebP compression after generation',assets},null,2));
console.log(assets);

