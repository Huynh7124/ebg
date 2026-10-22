export const unitTypeNames={'':'Chưa phân loại',single:'Đơn',double:'Đôi'};
export const emptyProductFilters={search:'',vehicle:'',color:'',unitType:''};
const normalize=text=>String(text||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/đ/g,'d').replace(/Đ/g,'D').toLocaleLowerCase('vi').trim();
export function matchesProduct(product,filters){
 if(!product)return false;
 return (!filters.search||normalize([product.name,product.code].join(' ')).includes(normalize(filters.search)))&&(!filters.vehicle||product.vehicle===filters.vehicle)&&(!filters.color||product.color===filters.color)&&(!filters.unitType||(filters.unitType==='unclassified'?!product.unitType:product.unitType===filters.unitType));
}
export function matchesReceipt(receipt,products,filters){
 if(!Object.values(filters).some(Boolean))return true;
 const byId=products instanceof Map?products:new Map(products.map(p=>[p.id,p]));
 // All selected attributes must match the same line, not different products.
 return receipt.items.some(item=>matchesProduct(byId.get(item.productId),filters));
}
