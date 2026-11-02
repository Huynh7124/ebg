export function withCompositionSummary(db,products){
 if(!db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='ops_boms'").get())return products;
 const latest=db.prepare(`SELECT b.* FROM ops_boms b JOIN (SELECT productId,MAX(version) version FROM ops_boms GROUP BY productId) v ON v.productId=b.productId AND v.version=b.version`).all(),composition=new Map(latest.map(row=>[row.productId,JSON.parse(row.lines)])),memo=new Map();
 const expand=(id,path=new Set())=>{
  if(memo.has(id))return memo.get(id);if(path.has(id))return new Map();const next=new Set(path).add(id),result=new Map();
  for(const line of composition.get(id)||[]){result.set(line.productId,(result.get(line.productId)||0)+line.quantity);for(const [child,quantity] of expand(line.productId,next))result.set(child,(result.get(child)||0)+quantity*line.quantity)}
  memo.set(id,result);return result;
 };
 const containers=new Map(products.map(product=>[product.id,[]]));
 const totals=new Map(products.map(product=>[product.id,{inSemi:0,inFinished:0}]));
 for(const assembly of products){if(!assembly.stock||!['semi','finished'].includes(assembly.materialKind))continue;const field=assembly.materialKind==='semi'?'inSemi':'inFinished';for(const [component,quantity] of expand(assembly.id)){const total=totals.get(component);if(total){total[field]+=quantity*assembly.stock;containers.get(component).push({productId:assembly.id,name:assembly.name,kind:assembly.materialKind,stock:assembly.stock,perAssembly:quantity,quantity:quantity*assembly.stock,unit:assembly.unit})}}}
 return products.map(product=>{const embedded=totals.get(product.id),lines=composition.get(product.id)||[];return {...product,composition:lines,containedIn:containers.get(product.id),embedded:{loose:product.stock,inSemi:embedded.inSemi,inFinished:embedded.inFinished,total:product.stock+embedded.inSemi+embedded.inFinished}}});
}
