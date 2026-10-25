import {test} from 'node:test';
import assert from 'node:assert/strict';
import {productFromScan} from '../shared/product-scan.js';

test('QR identifiers and numeric SKUs remain distinct and retain leading zeros',()=>{
 const products=[{id:1,code:'00000002'},{id:2,code:'00000001'},{id:3,code:'2'}];
 assert.equal(productFromScan(products,' EBG:2 '),products[1]);
 assert.equal(productFromScan(products,'00000002'),products[0]);
 assert.equal(productFromScan(products,'2'),products[2]);
 assert.equal(productFromScan(products,'1'),null);
});
test('lookup prefers the exact SKU and rejects ambiguous case-insensitive scans',()=>{
 const products=[{id:1,code:'Item-A'},{id:2,code:'ITEM-A'},{id:3,code:'BRK-001'}];
 assert.equal(productFromScan(products,'ITEM-A'),products[1]);
 assert.equal(productFromScan(products,'item-a'),null);
 assert.equal(productFromScan(products,' brk-001 '),products[2]);
});
test('unknown QR data, links and non-text payloads cannot select an unrelated item',()=>{
 const products=[{id:1,code:'BRK-001'}];
 for(const raw of ['EBG:999','https://example.com/EBG:1','javascript:alert(1)','',null,undefined,1,{}])assert.equal(productFromScan(products,raw),null);
});
