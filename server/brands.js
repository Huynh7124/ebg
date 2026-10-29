export const defaultBrands={
 'Surron':['Light Bee','Light Bee 2','Ultra Bee'],
 'E Ride Pro':['SR','Pro SS 1.0','Pro SS 2.0','Pro SS 3.0'],
 'Talaria':['MX3','MX4','MX5','Sting','XXX'],
 'Arctic Leopard / Vetra Blazer':['Vetra Blazer','XE Pro','XE ProS'],
 'SRPNT':['X3'],
 '79bike':['Falcon GT','Falcon M','Falcon Pro'],
 'Ventus One':['Ventus One','Ventus One Plus','Ventus V1+ Evo'],
 'Rerode':['R1','R1+'],
 'Altis Sigma':['Sigma'],
 'Segway':['X260']
};
export function initializeBrands(db){
 db.exec('CREATE TABLE IF NOT EXISTS brands(id INTEGER PRIMARY KEY,name TEXT NOT NULL UNIQUE COLLATE NOCASE,locked INTEGER NOT NULL DEFAULT 0);CREATE TABLE IF NOT EXISTS app_migrations(name TEXT PRIMARY KEY)');
 for(const table of ['categories','products'])if(!db.prepare(`PRAGMA table_info(${table})`).all().some(c=>c.name==='brandId'))db.exec(`ALTER TABLE ${table} ADD COLUMN brandId INTEGER`);
 if(db.prepare("SELECT 1 FROM app_migrations WHERE name='brand-models-v1'").get())return;
 db.exec('BEGIN IMMEDIATE');
 try{
  for(const [brand,models] of Object.entries(defaultBrands)){
   db.prepare('INSERT OR IGNORE INTO brands(name) VALUES(?)').run(brand);const id=db.prepare('SELECT id FROM brands WHERE name=?').get(brand).id;
   for(const model of models){db.prepare("INSERT OR IGNORE INTO categories(name,type,locked,brandId) VALUES(?,'vehicle',0,?)").run(model,id);db.prepare("UPDATE categories SET brandId=? WHERE name=? AND type='vehicle'").run(id,model)}
  }
  for(const [name,brand] of [['Sur-Ron Light Bee','Surron'],['Sur-Ron Ultra Bee','Surron'],['Talaria Sting','Talaria'],['E Ride Pro','E Ride Pro']])db.prepare("UPDATE categories SET brandId=(SELECT id FROM brands WHERE name=?) WHERE name=? AND type='vehicle'").run(brand,name);
  db.prepare('UPDATE products SET brandId=(SELECT brandId FROM categories WHERE name=products.vehicle AND type=\'vehicle\') WHERE brandId IS NULL').run();
  // Normalize the old built-in labels; a brand-only E Ride Pro label has no known model.
  for(const [oldName,model] of [['Sur-Ron Light Bee','Light Bee'],['Sur-Ron Ultra Bee','Ultra Bee'],['Talaria Sting','Sting'],['E Ride Pro','']]){
   db.prepare('UPDATE products SET vehicle=? WHERE vehicle=?').run(model,oldName);
   db.prepare("UPDATE categories SET locked=1 WHERE type='vehicle' AND name=?").run(oldName);
  }
  db.prepare('INSERT INTO app_migrations(name) VALUES(?)').run('brand-models-v1');db.exec('COMMIT');
 }catch(e){db.exec('ROLLBACK');throw e}
}
export function registerBrands(app,db,guard,audit){
 app.post('/api/brands',guard,(req,res)=>{
  const name=typeof req.body.name==='string'?req.body.name.trim():'';
  if(!name||name.length>100)return res.status(400).json({error:'Tên thương hiệu cần từ 1 đến 100 ký tự'});
  try{db.prepare('INSERT INTO brands(name) VALUES(?)').run(name);audit(req,`Thêm thương hiệu ${name}`);res.json({ok:true})}catch{res.status(400).json({error:'Thương hiệu đã tồn tại'})}
 });
 app.post('/api/brands/:id',guard,(req,res)=>{
  const name=typeof req.body.name==='string'?req.body.name.trim():'';
  if(!name||name.length>100)return res.status(400).json({error:'Tên thương hiệu không hợp lệ'});
  if(!db.prepare('SELECT id FROM brands WHERE id=?').get(req.params.id))return res.status(404).json({error:'Không tìm thấy thương hiệu'});
  try{db.prepare('UPDATE brands SET name=? WHERE id=?').run(name,req.params.id);audit(req,`Sửa thương hiệu ${name}`);res.json({ok:true})}catch{res.status(400).json({error:'Thương hiệu đã tồn tại'})}
 });
}
