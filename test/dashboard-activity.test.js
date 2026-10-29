import {test} from 'node:test';
import assert from 'node:assert/strict';
import {dashboardActivity} from '../server/dashboard-activity.js';
import {createDemoInventory,createDemoActivity} from '../shared/dashboard-demo.js';

const finish='Gia công hoàn thành, chuyển đóng gói';
const fixtures={orders:[{status:'completed',events:[{action:finish,date:'2026-01-31T17:10:00Z',actor:'Gia công A'},{action:finish,date:'2026-01-31T17:20:00Z',actor:'Gia công A'},{action:'Đóng gói kiểm nhận',date:'2026-02-01T02:00:00Z',actor:'Đóng gói A'},{action:'Đóng gói hoàn thành',date:'2026-02-01T03:00:00Z',actor:'Đóng gói A'}]},{status:'pending',events:[]}],stockOrders:[{status:'planned',processorId:9,completedAt:'2026-02-01T04:00:00Z'},{status:'planned',returnAt:'2026-01-31T00:00:00Z'},{status:'open'}],receipts:[{kind:'out',date:'2026-01-31T16:59:00Z',user:'Kho'},{kind:'out',date:'2026-01-31T17:00:00Z',user:'Kho'},{kind:'in',date:'2026-02-01T02:00:00Z',user:'Kho'}],users:[{id:9,name:'Gia công stock'}],now:Date.parse('2026-02-01T12:00:00Z')};
test('dashboard uses Vietnam event dates, counts distinct order completions and includes stock',()=>{
 const result=dashboardActivity({...fixtures,period:'day',date:'2026-02-01'});
 assert.deepEqual(result.totals,{processing:2,packing:1,outbound:1});assert.equal(result.buckets.length,24);assert.equal(result.buckets[0].processing,1);assert.equal(result.buckets[0].outbound,1);
 assert.equal(result.backlog.warehouse,1);assert.equal(result.backlog.processing,1);assert.equal(result.backlog.stockOpen,1);assert.equal(result.backlog.stockOverdue,1);
 assert.equal(result.staff.find(s=>s.name==='Gia công A').processing,1);assert.equal(result.staff.find(s=>s.name==='Đóng gói A').packing,1);
});
test('weeks run Monday to Sunday across year boundaries in Vietnam time',()=>{
 const receipts=[{kind:'out',date:'2025-12-28T16:59:59Z'},{kind:'out',date:'2025-12-28T17:00:00Z'},{kind:'out',date:'2026-01-04T16:59:59Z'},{kind:'out',date:'2026-01-04T17:00:00Z'}];
 const result=dashboardActivity({orders:[],stockOrders:[],receipts,period:'week',date:'2026-01-01'});
 assert.equal(result.weekStart,'2025-12-29');assert.equal(result.weekEnd,'2026-01-04');assert.equal(result.buckets.length,7);assert.equal(result.totals.outbound,2);assert.equal(result.buckets[0].outbound,1);assert.equal(result.buckets[6].outbound,1);
});
test('Excel demo is deterministic, keeps catalog identities and has consistent stock stages',()=>{
 const first=createDemoInventory(),second=createDemoInventory();assert.deepEqual(first,second);assert.equal(first.products.length,723);
 assert.equal(first.products.filter(p=>p.materialKind==='finished').length,292);assert.equal(first.products.filter(p=>p.materialKind==='raw').length,431);
 assert.ok(first.products.some(p=>p.name==='Đĩa phanh V3.0 220-45'&&p.size==='220'));
 for(const p of first.products)assert.equal(p.stock,Object.values(p.stages).reduce((a,b)=>a+b,0));
 const week=dashboardActivity({...createDemoActivity('2026-01-01'),period:'week',date:'2026-01-01'});
 assert.equal(week.buckets.length,7);assert.ok(week.buckets.every(b=>b.outbound>0));assert.ok(week.totals.processing>0);assert.ok(week.totals.packing>0);
});
test('month/year boundaries and leap years produce correct chart buckets',()=>{
 assert.equal(dashboardActivity({...fixtures,period:'month',date:'2024-02-01'}).buckets.length,29);
 const month=dashboardActivity({...fixtures,period:'month',date:'2026-02-01'});assert.equal(month.buckets.length,28);assert.deepEqual(month.totals,{processing:2,packing:1,outbound:1});
 const year=dashboardActivity({...fixtures,period:'year',date:'2026-01-01'});assert.equal(year.buckets.length,12);assert.equal(year.buckets[0].outbound,1);assert.equal(year.buckets[1].outbound,1);
 assert.throws(()=>dashboardActivity({...fixtures,date:'2026-02-30'}));assert.throws(()=>dashboardActivity({...fixtures,period:'other',date:'2026-01-01'}));
});
