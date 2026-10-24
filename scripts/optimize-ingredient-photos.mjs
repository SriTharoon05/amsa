import sharp from 'sharp';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {ingredientImagePath} from '../lib/ingredient-images.ts';
const brief=JSON.parse(await readFile('design-source/ingredient-photos/briefs.json','utf8'));
await mkdir('public/images/ingredients',{recursive:true});
const entries=[];
for(const item of brief.items){
 const source=item.reuse||`design-source/ingredient-photos/${item.slug}-native.png`;
 let quality=48,buffer;
 do{
  buffer=await sharp(source).resize(240,180,{fit:'contain',background:'#eeefde'}).webp({quality,effort:6,smartSubsample:true}).toBuffer();
  if(buffer.length<=5000)break;
  quality-=4;
 }while(quality>=28);
 if(buffer.length>6000)throw new Error(`Thumbnail exceeds 6 KB: ${item.name}`);
 const path='public'+ingredientImagePath(item.id,item.name);
 await writeFile(path,buffer);
 entries.push({id:item.id,name:item.name,path:ingredientImagePath(item.id,item.name),width:240,height:180,bytes:buffer.length,quality,source,sha256:createHash('sha256').update(buffer).digest('hex')});
}
const result={format:'webp',dimensions:[240,180],note:'Representative AI-generated ingredient photos, not specimen identification or extraction specifications.',count:entries.length,totalBytes:entries.reduce((sum,item)=>sum+item.bytes,0),maxBytes:Math.max(...entries.map(item=>item.bytes)),entries};
if(result.totalBytes>250000)throw new Error('All ingredient thumbnails must stay under 250 KB');
await writeFile('design-source/ingredient-photos/optimized-manifest.json',JSON.stringify(result,null,2));
console.log(JSON.stringify({count:result.count,totalBytes:result.totalBytes,maxBytes:result.maxBytes},null,2));
