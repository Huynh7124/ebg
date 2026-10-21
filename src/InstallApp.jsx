import React,{useEffect,useState} from 'react';
import {Download,X,WifiOff} from 'lucide-react';
export default function InstallApp(){
 const [prompt,setPrompt]=useState(null),[installed,setInstalled]=useState(()=>window.matchMedia('(display-mode: standalone)').matches||navigator.standalone===true),[help,setHelp]=useState(false),[offline,setOffline]=useState(!navigator.onLine);
 useEffect(()=>{
  const offer=e=>{e.preventDefault();setPrompt(e)};
  const done=()=>{setInstalled(true);setPrompt(null);setHelp(false)};
  const network=()=>setOffline(!navigator.onLine);
  window.addEventListener('beforeinstallprompt',offer);window.addEventListener('appinstalled',done);window.addEventListener('online',network);window.addEventListener('offline',network);
  return()=>{window.removeEventListener('beforeinstallprompt',offer);window.removeEventListener('appinstalled',done);window.removeEventListener('online',network);window.removeEventListener('offline',network)};
 },[]);
 async function install(){if(!prompt){setHelp(true);return}try{await prompt.prompt();const result=await prompt.userChoice;setPrompt(null);if(result.outcome==='accepted')setInstalled(true)}catch{setPrompt(null);setHelp(true)}}
 return <>{offline&&<div className="offline-banner" role="status"><WifiOff size={16}/>Bạn đang ngoại tuyến. Kết nối Internet để xem dữ liệu và nhập / xuất kho.</div>}{!installed&&<button type="button" className="install-app-button" onClick={install}><Download size={16}/>Cài ứng dụng EBG</button>}{help&&<div className="modal-backdrop" onClick={()=>setHelp(false)}><section className="modal install-help" role="dialog" aria-modal="true" aria-labelledby="install-title" onClick={e=>e.stopPropagation()}><div className="modal-header"><h2 id="install-title">Cài EBG lên thiết bị</h2><button aria-label="Đóng hướng dẫn cài đặt" onClick={()=>setHelp(false)}><X size={20}/></button></div><p><b>Android / máy tính:</b> mở bằng Chrome hoặc Edge, chọn menu trình duyệt → Cài đặt ứng dụng.</p><p><b>iPhone / iPad:</b> mở bằng Safari, chọn Chia sẻ → Thêm vào Màn hình chính.</p><p className="form-hint">Cần đường dẫn HTTPS và bản production đã triển khai. Nếu chưa có tùy chọn cài đặt, thử tải lại trang. Đây là ứng dụng một kho dùng chung; mỗi nhân viên cần tài khoản được cấp. Nhập / xuất kho cần kết nối mạng.</p><button className="primary" onClick={()=>setHelp(false)}>Đã hiểu</button></section></div>}</>;
}
