// Package the original company logo into platform-required square icon sizes.
// The source WebP is read-only; contain-fit on black preserves the whole design.
import {chromium} from 'playwright-core';
import {readFile,writeFile} from 'node:fs/promises';
const source=await readFile('public/brand/Asset-4.png.webp');
const browser=await chromium.launch({...(process.env.CHROMIUM_PATH?{executablePath:process.env.CHROMIUM_PATH}:{}),args:['--no-sandbox']});
try{
 const page=await browser.newPage();
 const files=await page.evaluate(async base64=>{
  const logo=new Image();logo.src='data:image/webp;base64,'+base64;await logo.decode();
  const output={};
  for(const[size,name,scale]of[[32,'ebg-favicon-32.png',1],[192,'ebg-192.png',1],[512,'ebg-512.png',1],[180,'ebg-apple-touch.png',1],[512,'ebg-maskable-512.png',.8]]){
   const canvas=document.createElement('canvas');canvas.width=canvas.height=size;const ctx=canvas.getContext('2d');
   ctx.fillStyle='#000';ctx.fillRect(0,0,size,size);const width=size*scale,height=width*logo.height/logo.width;
   ctx.drawImage(logo,(size-width)/2,(size-height)/2,width,height);output[name]=canvas.toDataURL('image/png').split(',')[1];
  }
  return output;
 },source.toString('base64'));
 for(const[name,data]of Object.entries(files))await writeFile('public/icons/'+name,Buffer.from(data,'base64'));
 console.log('Packaged 5 icons from the original WebP. Source file unchanged.');
}finally{await browser.close()}
