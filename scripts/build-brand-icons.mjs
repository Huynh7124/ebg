// Package the black lettering / red lightning identity into square app icons.
// Contain-fit on white preserves the complete logo and subtitle.
import {chromium} from 'playwright-core';
import {readFile,writeFile} from 'node:fs/promises';
const source=await readFile('public/brand/ebg-black-red.png');
const browser=await chromium.launch({...(process.env.CHROMIUM_PATH?{executablePath:process.env.CHROMIUM_PATH}:{}),args:['--no-sandbox']});
try{
 const page=await browser.newPage();
 const files=await page.evaluate(async base64=>{
  const logo=new Image();logo.src='data:image/png;base64,'+base64;await logo.decode();
  const output={};
  for(const[size,name,scale]of[[32,'ebg-favicon-32.png',1],[192,'ebg-192.png',1],[512,'ebg-512.png',1],[180,'ebg-apple-touch.png',1],[512,'ebg-maskable-512.png',.8]]){
   const canvas=document.createElement('canvas');canvas.width=canvas.height=size;const ctx=canvas.getContext('2d');
   ctx.fillStyle='#fff';ctx.fillRect(0,0,size,size);const width=size*scale,height=width*logo.height/logo.width;
   ctx.drawImage(logo,(size-width)/2,(size-height)/2,width,height);output[name]=canvas.toDataURL('image/png').split(',')[1];
  }
  return output;
 },source.toString('base64'));
 for(const[name,data]of Object.entries(files))await writeFile('public/icons/'+name,Buffer.from(data,'base64'));
 console.log('Packaged 5 icons with the white / black / red EBG identity.');
}finally{await browser.close()}
