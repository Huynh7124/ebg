import React,{useEffect,useState} from 'react';
import {ArrowUp} from 'lucide-react';

export default function ScrollToTop(){
 const [visible,setVisible]=useState(false);
 useEffect(()=>{
  const update=()=>setVisible(window.scrollY>300);
  update();window.addEventListener('scroll',update,{passive:true});
  return()=>window.removeEventListener('scroll',update);
 },[]);
 if(!visible)return null;
 return <button type="button" className="scroll-to-top" aria-label="Cuộn lên đầu trang" title="Cuộn lên đầu trang" onClick={()=>window.scrollTo({top:0,behavior:window.matchMedia('(prefers-reduced-motion: reduce)').matches?'instant':'smooth'})}><ArrowUp size={22} aria-hidden="true"/></button>;
}
