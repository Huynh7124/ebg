import {test} from 'node:test';
import assert from 'node:assert/strict';
import {matchesProduct,matchesReceipt,emptyProductFilters} from '../shared/product-filters.js';
const products=[{id:1,name:'Phanh đĩa',code:'BRK-01',vehicle:'Sur-Ron',color:'Đen',unitType:'single'},{id:2,name:'Tay phanh',code:'BRK-02',vehicle:'Talaria',color:'Đỏ',unitType:'double'},{id:3,name:'Lốp xe',code:'WHL-03',vehicle:'Sur-Ron',color:'Đen',unitType:''}];
test('product search supports combined attributes, accent-insensitive name/code and unclassified products',()=>{
 assert.equal(matchesProduct(products[0],{...emptyProductFilters,search:'phanh dia',vehicle:'Sur-Ron',color:'Đen',unitType:'single'}),true);
 assert.equal(matchesProduct(products[1],{...emptyProductFilters,search:'brk-02',color:'Đen'}),false);
 assert.equal(matchesProduct(products[2],{...emptyProductFilters,unitType:'unclassified'}),true);
 assert.equal(matchesProduct(products[2],{...emptyProductFilters,unitType:'double'}),false);
});
test('receipt search matches one product satisfying every filter and keeps the full receipt',()=>{
 const receipt={items:[{productId:1,quantity:2},{productId:2,quantity:3}]};
 assert.equal(matchesReceipt(receipt,products,{...emptyProductFilters,vehicle:'Sur-Ron',color:'Đỏ'}),false);
 assert.equal(matchesReceipt(receipt,products,{...emptyProductFilters,vehicle:'Talaria',color:'Đỏ',unitType:'double'}),true);
 assert.equal(receipt.items.length,2);
 assert.equal(matchesReceipt(receipt,new Map(products.map(p=>[p.id,p])),{...emptyProductFilters,unitType:'single'}),true);
 assert.equal(matchesReceipt({items:[{productId:99}]},products,emptyProductFilters),true);
 assert.equal(matchesReceipt({items:[{productId:99}]},products,{...emptyProductFilters,color:'Đỏ'}),false);
});
