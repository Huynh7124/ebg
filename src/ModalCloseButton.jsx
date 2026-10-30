import React from 'react';
import {X} from 'lucide-react';
import './modal-close.css';

export default function ModalCloseButton({label='Đóng',onClick,disabled=false}){
 return <button type="button" className="modal-close-button" aria-label={label} title={label} onClick={onClick} disabled={disabled}><X size={24} aria-hidden="true"/></button>;
}
