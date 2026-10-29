import PackingLinePicker from './PackingLinePicker.jsx';
import React,{useMemo,useRef,useState} from 'react';
import {createPortal} from 'react-dom';
import {defaultPackingPrint,packingPrintHtml,packingPrintLabels} from '../shared/packing-print.js';
import './packing-print.css';

export default function PackingPrint({order,products,people,type,api,onSaved,onClose}){
 const [draft,setDraft]=useState(()=>order.printForms?.[type]||defaultPackingPrint(order,products,people,type));
 const [busy,setBusy]=useState(false),[error,setError]=useState(''),[message,setMessage]=useState('');
 const frame=useRef(null),html=useMemo(()=>packingPrintHtml(draft,type),[draft,type]);
 const canEditLines=(type==='pickup'?['pending','prepared']:['pending','prepared','warehouse_issued','packing_received']).includes(order.status);
 const update=(key,value)=>{setDraft(d=>({...d,[key]:value}));setMessage('')};
 async function save(print){if(busy)return;setBusy(true);setError('');try{
  const result=await api(`packing-orders/${order.id}/print-forms/${type}`,draft);
  const ready=packingPrintHtml(result.form,type)===html&&frame.current.contentDocument?.readyState==='complete'?Promise.resolve():new Promise(resolve=>frame.current.addEventListener('load',resolve,{once:true}));
  setDraft(result.form);setMessage('Đã lưu phiếu. Nhân viên kho và người lập đơn có thể xem lại.');await onSaved();
  if(print){await ready;await frame.current.contentDocument.fonts.ready;frame.current.contentWindow.focus();frame.current.contentWindow.print();}
 }catch(e){setError(e.message)}finally{setBusy(false)}}
 return createPortal(<div className="packing-print-backdrop"><section className="packing-print-dialog" role="dialog" aria-modal="true" aria-label={packingPrintLabels[type]}><div className="packing-print-toolbar"><h2>{packingPrintLabels[type]} · DGGC-{String(order.id).padStart(6,'0')}</h2><button className="secondary" disabled={busy} onClick={onClose}>Đóng mẫu phiếu</button></div>
 <p>{type==='pickup'?'Chọn nguyên vật liệu đề nghị kho xuất. Lưu phiếu chưa trừ tồn; kho sẽ xuất đúng danh sách này.':'Chọn sản phẩm cần gia công độc lập với phiếu lấy hàng. Lưu phiếu gia công không trừ tồn kho.'} {!canEditLines&&'Danh sách hàng đã khóa vì phiếu đã được chuyển xử lý.'}</p>
 <form onSubmit={e=>{e.preventDefault();save(false)}}><div className="packing-print-fields">
 {Object.entries({date:'Ngày trên phiếu',warehouse:'Kho',requester:'Người đề nghị',receiver:type==='production'?'Người nhận':'Nhân viên kho',...(type==='production'?{senderDepartment:'Phòng ban đề nghị',receiverDepartment:'Phòng ban nhận'}:{})}).map(([key,label])=><label key={key}>{label}<input aria-label={label} type={key==='date'?'date':'text'} required={key==='date'} maxLength={200} value={draft[key]} onChange={e=>update(key,e.target.value)}/></label>)}
 </div><PackingLinePicker products={products} value={draft.lines} onChange={lines=>update('lines',lines)} title={type==='pickup'?'Nguyên vật liệu lấy từ kho':'Sản phẩm cần làm'} raw={type==='pickup'} disabled={!canEditLines}/><details><summary>Ghi chú trên phiếu</summary>{draft.lines.map((line,index)=><label key={line.productId}>{line.name}<input aria-label={'Ghi chú mặt hàng '+(index+1)} maxLength={500} value={line.note} onChange={e=>update('lines',draft.lines.map((l,i)=>i===index?{...l,note:e.target.value}:l))}/></label>)}{type==='production'&&<label>Ghi chú chung<textarea maxLength={2000} value={draft.note} onChange={e=>update('note',e.target.value)}/></label>}</details>
 {error&&<p role="alert" className="ops-alert">{error}</p>}{message&&<p role="status">{message}</p>}
 <div className="packing-print-toolbar"><button className="secondary" disabled={busy}>Lưu phiếu</button><button className="primary" type="button" disabled={busy} onClick={()=>save(true)}>Lưu và in phiếu</button></div></form>
 <p>Trong cửa sổ in, tắt “Đầu trang và chân trang”, để tỷ lệ 100%. Có thể chọn “Lưu dưới dạng PDF”. Khổ giấy theo file gốc: {type==='production'?'A4':'Letter'}.</p>
 <div className="packing-print-preview"><iframe ref={frame} title={'Bản in '+packingPrintLabels[type]} srcDoc={html}/></div>
 </section></div>,document.body);
}
