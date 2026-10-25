import React,{useEffect,useRef,useState} from 'react';
import {Camera,Square} from 'lucide-react';

export default function QrScanner({onDetected}){
 const [query,setQuery]=useState(''),[state,setState]=useState('idle'),[error,setError]=useState('');
 const video=useRef(),lifecycle=useRef({generation:0,stream:null,timer:null}),detected=useRef(onDetected);
 detected.current=onDetected;
 function release(){const current=lifecycle.current;current.generation++;clearTimeout(current.timer);current.stream?.getTracks().forEach(track=>track.stop());current.stream=null;if(video.current)video.current.srcObject=null}
 function stop(){release();setState('idle')}
 function accept(raw){
  if(typeof raw!=='string'||!raw.trim())return false;
  setQuery(raw);const found=detected.current(raw);
  if(found){stop();setError('');return true}
  setError('Không tìm thấy mã này trong kho. Kiểm tra mã trên nhãn hoặc thử quét lại.');return false;
 }
 async function start(){
  release();const generation=lifecycle.current.generation;setState('opening');setError('');
  try{
   if(!window.BarcodeDetector||!navigator.mediaDevices?.getUserMedia)throw Error('Thiết bị chưa hỗ trợ quét camera trong trình duyệt này. Dùng máy quét cầm tay hoặc nhập mã bên dưới.');
   const supported=window.BarcodeDetector.getSupportedFormats?await window.BarcodeDetector.getSupportedFormats():['qr_code'];
   if(generation!==lifecycle.current.generation)return;
   const formats=['qr_code','code_128','ean_13'].filter(format=>supported.includes(format));
   if(!formats.includes('qr_code'))throw Error('Trình duyệt chưa hỗ trợ mã QR. Dùng máy quét cầm tay hoặc nhập mã bên dưới.');
   const detector=new window.BarcodeDetector({formats});
   const stream=await navigator.mediaDevices.getUserMedia({video:{facingMode:{ideal:'environment'}},audio:false});
   if(generation!==lifecycle.current.generation){stream.getTracks().forEach(track=>track.stop());return}
   lifecycle.current.stream=stream;video.current.srcObject=stream;await video.current.play();
   if(generation!==lifecycle.current.generation)return;
   setState('scanning');let previous='';
   async function tick(){
    if(generation!==lifecycle.current.generation)return;
    try{
     if(video.current?.readyState>=2){const codes=await detector.detect(video.current);if(generation!==lifecycle.current.generation)return;for(const code of codes){if(code.rawValue&&code.rawValue!==previous){previous=code.rawValue;if(accept(code.rawValue))return}}}
    }catch{if(generation!==lifecycle.current.generation)return;stop();setError('Không đọc được hình ảnh camera. Thử bật lại camera hoặc nhập mã bên dưới.');return}
    lifecycle.current.timer=setTimeout(tick,250);
   }
   tick();
  }catch(error){
   if(generation!==lifecycle.current.generation)return;
   stop();setError(error.name==='NotAllowedError'?'Camera chưa được cấp quyền. Cho phép camera trong trình duyệt hoặc nhập mã bên dưới.':error.name==='NotFoundError'?'Không tìm thấy camera trên thiết bị. Dùng máy quét cầm tay hoặc nhập mã bên dưới.':error.message?.startsWith('Thiết bị')||error.message?.startsWith('Trình duyệt')?error.message:'Không mở được camera. Kiểm tra quyền camera và dùng HTTPS hoặc localhost.');
  }
 }
 useEffect(()=>{start();return release},[]);
 return <section className="qr-scanner" aria-label="Máy quét mã hàng"><p>Đưa mã QR trên nhãn hàng vào trước camera. Quét mã để xem thông tin sản phẩm.</p><div className="qr-camera-actions"><button type="button" className="secondary" disabled={state==='opening'} onClick={state==='scanning'?stop:start}>{state==='scanning'?<Square size={17}/>:<Camera size={17}/>} {state==='opening'?'Đang mở camera...':state==='scanning'?'Dừng camera':'Bật camera'}</button><span role="status">{state==='scanning'?'Camera đang quét...':''}</span></div><video ref={video} className="ops-camera qr-camera" aria-label="Hình ảnh camera quét QR" hidden={state==='idle'} playsInline muted/>{error&&<p className="ops-alert" role="alert">{error}</p>}<form className="qr-manual-form" onSubmit={event=>{event.preventDefault();accept(query)}}><label>Mã QR / mã hàng<input autoFocus required value={query} onChange={event=>setQuery(event.target.value)} placeholder="Ví dụ: EBG:1 hoặc mã sản phẩm" autoComplete="off" autoCapitalize="none" spellCheck={false}/></label><button className="primary">Tra cứu mã</button></form></section>;
}
