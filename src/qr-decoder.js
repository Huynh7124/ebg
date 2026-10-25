let loading;
export function loadQrDecoder(){
 if(window.jsQR)return Promise.resolve(window.jsQR);
 if(!loading)loading=new Promise((resolve,reject)=>{const script=document.createElement('script');script.src='/vendor/jsqr/jsQR-1.4.0.js';script.async=true;script.onload=()=>window.jsQR?resolve(window.jsQR):reject(Error('Không tải được bộ đọc QR'));script.onerror=()=>{script.remove();loading=null;reject(Error('Không tải được bộ đọc QR. Tải lại trang rồi thử lại.'))};document.head.append(script)});
 return loading;
}
async function javascriptDetector(){
 const decode=await loadQrDecoder(),canvas=document.createElement('canvas'),context=canvas.getContext('2d',{willReadFrequently:true});
 return {async detect(video){if(!video.videoWidth||!video.videoHeight)return [];const scale=Math.min(1,960/video.videoWidth);canvas.width=Math.round(video.videoWidth*scale);canvas.height=Math.round(video.videoHeight*scale);context.drawImage(video,0,0,canvas.width,canvas.height);const pixels=context.getImageData(0,0,canvas.width,canvas.height),result=decode(pixels.data,pixels.width,pixels.height,{inversionAttempts:'attemptBoth'});return result?[{rawValue:result.data}]:[]}};
}
export async function createQrDetector(){
 if(window.BarcodeDetector){try{
  const supported=window.BarcodeDetector.getSupportedFormats?await window.BarcodeDetector.getSupportedFormats():['qr_code'];
  if(supported.includes('qr_code')){
   let native=new window.BarcodeDetector({formats:['qr_code','code_128','ean_13'].filter(format=>supported.includes(format))}),fallback;
   return {async detect(video){if(native)try{return await native.detect(video)}catch{native=null}fallback??=await javascriptDetector();return fallback.detect(video)}};
  }
 }catch{}}
 return javascriptDetector();
}
