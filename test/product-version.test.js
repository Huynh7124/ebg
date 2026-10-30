import {test} from 'node:test';
import assert from 'node:assert/strict';
import {matchesProduct,matchesReceipt} from '../shared/product-filters.js';
test('version filters match exact version, missing values and the same receipt line',()=>{
 const products=[{id:1,version:'V1',color:'Đen'},{id:2,version:'V2',color:'Đỏ'},{id:3}];
 assert.equal(matchesProduct(products[0],{version:'V1'}),true);
 assert.equal(matchesProduct(products[0],{version:'V2'}),false);
 assert.equal(matchesProduct(products[2],{version:'__none__'}),true);
 assert.equal(matchesProduct(products[0],{version:'__none__'}),false);
 const receipt={items:[{productId:1},{productId:2}]};
 assert.equal(matchesReceipt(receipt,products,{version:'V1',color:'Đỏ'}),false);
 assert.equal(matchesReceipt(receipt,products,{version:'V2',color:'Đỏ'}),true);
});
