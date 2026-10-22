import {test} from 'node:test';
import assert from 'node:assert/strict';
import {defaultOutboundPrint,validateOutboundPrint} from '../shared/outbound-print.js';
const receipt={code:'PX-000001',date:'2026-10-22T03:00:00Z',user:'Nhân viên',operation:'send_anode',items:[{id:10,productId:1,quantity:2},{id:11,productId:2,quantity:3}]};
const products=[{id:1,name:'Phanh đĩa',category:'Hệ thống phanh'},{id:2,name:'Nhông',category:'Truyền động'}];
test('outbound print defaults follow worksheet and permit editing display information only',()=>{
 const data=defaultOutboundPrint(receipt,products);assert.equal(data.companyName,'CÔNG TY TNHH EBIKE GARAGE VIỆT NAM');assert.equal(data.taxId,'0319279878');assert.equal(data.warehouse,'Cao Lỗ');assert.equal(data.preparedBy,'Nhân viên');assert.equal(data.lines.length,2);data.warehouse='Kho mới';data.lines[0].note='Bề mặt đen';const clean=validateOutboundPrint(data,receipt.items);assert.equal(clean.warehouse,'Kho mới');assert.equal(clean.lines[0].note,'Bề mặt đen');assert.equal(receipt.items[0].quantity,2);
});
test('print metadata rejects quantity changes, foreign lines, duplicate rows and invalid dates',()=>{
 for(const mutate of [d=>d.lines[0].quantity=99,d=>d.lines[0].lineId=999,d=>d.lines[1].lineId=d.lines[0].lineId,d=>d.lines.pop(),d=>d.date='2026-02-30',d=>d.companyName='',d=>d.reason='x'.repeat(1001),d=>d.stock=50]){const data=defaultOutboundPrint(receipt,products);mutate(data);assert.throws(()=>validateOutboundPrint(data,receipt.items))}
});
