export function productFromScan(products,raw){
 if(typeof raw!=='string')return null;
 const value=raw.trim(),match=/^EBG:(\d+)$/i.exec(value);
 if(match)return products.find(product=>product.id===Number(match[1]))||null;
 const exact=products.find(product=>product.code===value);
 if(exact)return exact;
 const matches=products.filter(product=>product.code.toLowerCase()===value.toLowerCase());
 return matches.length===1?matches[0]:null;
}
