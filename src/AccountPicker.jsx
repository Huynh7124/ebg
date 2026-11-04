import React,{useEffect,useState} from 'react';
import {ArrowRight,RefreshCw,Search} from 'lucide-react';
import {roleNames} from '../shared/roles.js';

const searchable=value=>value.normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/đ/g,'d').replace(/Đ/g,'D').toLowerCase();

export default function AccountPicker({api,onLogin}){
 const [accounts,setAccounts]=useState([]),[loading,setLoading]=useState(true),[busy,setBusy]=useState(''),[error,setError]=useState(''),[query,setQuery]=useState('');
 async function refresh(){setLoading(true);setError('');try{setAccounts(await api('login-users'))}catch(e){setError(e.message)}finally{setLoading(false)}}
 useEffect(()=>{refresh()},[]);
 const visible=accounts.filter(account=>searchable(account.name+' '+account.username).includes(searchable(query.trim())));
 return <div className="account-picker"><h1 id="login-title">Đăng nhập</h1><p>Chọn tài khoản để vào phần mềm.</p><label className="login-account-search"><Search size={18} aria-hidden="true"/><input type="search" aria-label="Tìm tài khoản đăng nhập" placeholder="Tìm tên nhân viên..." value={query} onChange={e=>setQuery(e.target.value)}/></label>{error&&<div className="form-error" role="alert">{error}</div>}{loading?<p role="status">Đang tải tài khoản...</p>:<div className="login-accounts">{visible.map(account=><button type="button" className="login-account" key={account.username} aria-label={'Đăng nhập bằng '+account.username} disabled={!!busy} onClick={async()=>{if(busy)return;setBusy(account.username);setError('');try{await onLogin(account.username)}catch(e){setError(e.message)}finally{setBusy('')}}}><span className="login-account-avatar" aria-hidden="true">{account.name.trim().split(/\s+/).slice(-2).map(part=>part[0]).join('')}</span><span className="login-account-info"><b>{account.name}</b><span>{account.username}</span></span>{busy===account.username?<span>Đang vào...</span>:<ArrowRight size={18} aria-hidden="true"/>}</button>)}{!visible.length&&<p>{accounts.length?'Không tìm thấy tài khoản phù hợp.':'Chưa có tài khoản đang hoạt động.'}</p>}</div>}<button className="login-refresh" type="button" disabled={loading||!!busy} onClick={refresh}><RefreshCw size={15}/>Tải lại danh sách</button></div>;
}
