export const unitTypeNames={'':'Chưa phân loại',single:'Đơn',double:'Đôi'};
export const emptyProductFilters={version:'',search:'',brand:'',vehicle:'',color:'',unitType:''};
const normalize=text=>String(text||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/đ/g,'d').replace(/Đ/g,'D').toLocaleLowerCase('vi').trim();
export function matchesProduct(product,filters){
 if(!product)return false;
 if(filters.materialKind&&product.materialKind!==filters.materialKind)return false;
 if(filters.version&&(filters.version==='__none__'?!!product.version:(product.version||'')!==filters.version))return false;
 if(filters.brand&&product.brand!==filters.brand)return false;
 if(filters.size&&(filters.size==='none'?!!product.size:product.size!==filters.size))return false;
 const rawHaystack=[product.name,product.code,product.color,product.brand,product.vehicle,product.version,product.size].filter(Boolean).join(' ').toLocaleLowerCase('vi');
 const haystack=normalize(rawHaystack);
 const rawTerms=String(filters.search||'').normalize('NFC').trim().toLocaleLowerCase('vi').split(/\s+/).filter(Boolean);
 const colorAliases={do:'đỏ',tim:'tím',bac:'bạc',den:'đen',trang:'trắng',vang:'vàng',nau:'nâu',xam:'xám'};
 const colorTerms=rawTerms.filter(term=>colorAliases[normalize(term)]),colorWords=new Set(normalize(product.name).split(/[^a-z0-9đ]+/).filter(Boolean)),colorText=normalize(product.color||'');
 const terms=rawTerms.filter(term=>!colorAliases[normalize(term)]).map(term=>({term,normalized:normalize(term),accented:/[\u0300-\u036f]/.test(term.normalize('NFD'))||/[ăâđêôơưáàảãạấầẩẫậắằẳẵặéèẻẽẹếềểệíìỉĩịóòỏõọốồổỗộớờởỡợúùủũụứừửữựýỳỷỹỵ]/i.test(term)}));
 return ((!colorTerms.length||colorTerms.every(term=>colorText===normalize(colorAliases[normalize(term)])||colorWords.has(normalize(colorAliases[normalize(term)]))))&&(!terms.length||terms.every(({term,normalized,accented})=>accented?rawHaystack.includes(term):haystack.includes(normalized)))&&(!filters.vehicle||product.vehicle===filters.vehicle)&&(!filters.color||product.color===filters.color)&&(!filters.unitType||(filters.unitType==='unclassified'?!product.unitType:product.unitType===filters.unitType)));
}
export function matchesReceipt(receipt,products,filters){
 if(!Object.values(filters).some(Boolean))return true;
 const byId=products instanceof Map?products:new Map(products.map(p=>[p.id,p]));
 // All selected attributes must match the same line, not different products.
 return receipt.items.some(item=>matchesProduct(byId.get(item.productId),filters));
}
