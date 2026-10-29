import React,{useMemo,useRef,useState} from 'react';
import {createPortal} from 'react-dom';
import {defaultPackingPrint,packingPrintHtml,packingPrintLabels} from '../shared/packing-print.js';
import './packing-print.css';

export default function PackingPrint({order,products,people,type,api,onSaved,onClose}){
 const [draft,setDraft]=useState(()=>order.printForms?.[type]||defaultPackingPrint(order,products,people,type));
 const [busy,setBusy]=useState(false),[error,setError]=useState(''),[message,setMessage]=useState('');
 const frame=useRef(null),html=useMemo(()=>packingPrintHtml(draft,type),[draft,type]);
 const update=(key,value)=>{setDraft(d=>({...d,[key]:value}));setMessage('')};
 async function save(print){if(busy)return;setBusy(true);setError('');try{
  const result=await api(`packing-orders/${order.id}/print-forms/${type}`,draft);
  const ready=packingPrintHtml(result.form,type)===html&&frame.current.contentDocument?.readyState==='complete'?Promise.resolve():new Promise(resolve=>frame.current.addEventListener('load',resolve,{once:true}));
  setDraft(result.form);setMessage('Đã lưu phiếu. Nhân viên kho và người lập đơn có thể xem lại.');await onSaved();
  if(print){await ready;await frame.current.contentDocument.fonts.ready;frame.current.contentWindow.focus();frame.current.contentWindow.print();}
 }catch(e){setError(e.message)}finally{setBusy(false)}}
 return createPortal(<div className="packing-print-backdrop"><section className="packing-print-dialog" role="dialog" aria-modal="true" aria-label={packingPrintLabels[type]}><div className="packing-print-toolbar"><h2>{packingPrintLabels[type]} · DGGC-{String(order.id).padStart(6,'0')}</h2><button className="secondary" disabled={busy} onClick={onClose}>Đóng mẫu phiếu</button></div>
 <p>Danh sách và số lượng lấy từ yêu cầu đóng gói. Tên người nhận trên bản in không phân công nhân viên hay chuyển trạng thái đơn.</p>
 <form onSubmit={e=>{e.preventDefault();save(false)}}><div className="packing-print-fields">
 {Object.entries({date:'Ngày trên phiếu',warehouse:'Kho',requester:'Người đề nghị',receiver:type==='production'?'Người nhận':'Nhân viên kho',...(type==='production'?{senderDepartment:'Phòng ban đề nghị',receiverDepartment:'Phòng ban nhận'}:{})}).map(([key,label])=><label key={key}>{label}<input aria-label={label} type={key==='date'?'date':'text'} required={key==='date'} maxLength={200} value={draft[key]} onChange={e=>update(key,e.target.value)}/></label>)}
 </div><details><summary>Ghi chú trên phiếu</summary>{draft.lines.map((line,index)=><label key={line.productId}>{line.name}<input aria-label={'Ghi chú mặt hàng '+(index+1)} maxLength={500} value={line.note} onChange={e=>update('lines',draft.lines.map((l,i)=>i===index?{...l,note:e.target.value}:l))}/></label>)}{type==='production'&&<label>Ghi chú chung<textarea maxLength={2000} value={draft.note} onChange={e=>update('note',e.target.value)}/></label>}</details>
 {error&&<p role="alert" className="ops-alert">{error}</p>}{message&&<p role="status">{message}</p>}
 <div className="packing-print-toolbar"><button className="secondary" disabled={busy}>Lưu phiếu</button><button className="primary" type="button" disabled={busy} onClick={()=>save(true)}>Lưu và in phiếu</button></div></form>
 <p>Trong cửa sổ in, tắt “Đầu trang và chân trang”, để tỷ lệ 100%. Có thể chọn “Lưu dưới dạng PDF”. Khổ giấy theo file gốc: {type==='production'?'A4':'Letter'}.</p>
 <div className="packing-print-preview"><iframe ref={frame} title={'Bản in '+packingPrintLabels[type]} srcDoc={html}/></div>
 </section></div>,document.body);
}
