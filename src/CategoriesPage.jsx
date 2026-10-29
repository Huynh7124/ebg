import React, {useState} from 'react';
import {BrandsCatalog} from './BrandModelFields.jsx';

export default function CategoriesPage({brands, categories, products, action, onEdit}) {
  const [search, setSearch] = useState('');
  const [type, setType] = useState('');
  const [brand, setBrand] = useState('');
  const [status, setStatus] = useState('');
  const normalize = value => String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/đ/g, 'd').toLocaleLowerCase('vi');
  const query = normalize(search.trim());
  const filtered = categories.filter(category =>
    (!type || category.type === type) &&
    (!brand || String(category.brandId) === brand) &&
    (!status || Boolean(category.locked) === (status === 'locked')) &&
    (!query || normalize(category.name).includes(query) || normalize(brands.find(b => b.id === category.brandId)?.name).includes(query))
  ).sort((a, b) => b.id - a.id);
  const visibleBrands = brands.filter(b => (!brand || String(b.id) === brand) &&
    (!query || normalize(b.name).includes(query) || filtered.some(c => c.brandId === b.id)) &&
    (!status || filtered.some(c => c.brandId === b.id))).sort((a, b) => b.id - a.id);
  const reset = () => {setSearch(''); setType(''); setBrand(''); setStatus('');};
  return <>
    <section className="card category-filters" aria-label="Bộ lọc danh mục">
      <label>Tìm danh mục<input type="search" placeholder="Tên danh mục hoặc thương hiệu" value={search} onChange={e => setSearch(e.target.value)}/></label>
      <label>Loại danh mục<select aria-label="Loại danh mục" value={type} onChange={e => {setType(e.target.value); if (e.target.value !== 'vehicle') setBrand('');}}><option value="">Tất cả loại</option><option value="accessory">Dòng phụ kiện</option><option value="vehicle">Dòng sản phẩm</option></select></label>
      <label>Thương hiệu<select aria-label="Thương hiệu" value={brand} disabled={type === 'accessory'} onChange={e => {setBrand(e.target.value); if (e.target.value) setType('vehicle');}}><option value="">Tất cả thương hiệu</option>{brands.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}</select></label>
      <label>Trạng thái<select aria-label="Trạng thái" value={status} onChange={e => setStatus(e.target.value)}><option value="">Tất cả trạng thái</option><option value="active">Hoạt động</option><option value="locked">Đã khóa</option></select></label>
      <button className="text-button" disabled={!search && !type && !brand && !status} onClick={reset}>Xóa lọc</button>
    </section>
    {type !== 'accessory' && <BrandsCatalog brands={visibleBrands} categories={filtered} action={action} onEditModel={onEdit}/>}
    {!filtered.length && <section className="card category-empty">Không có danh mục phù hợp với bộ lọc.</section>}
    <div className="category-sections">{['accessory', 'vehicle'].filter(kind => !type || kind === type).map(kind => {
      const rows = filtered.filter(c => c.type === kind);
      return <section key={kind} className="card"><div className="section-heading"><h2>{kind === 'accessory' ? 'Dòng phụ kiện' : 'Dòng sản phẩm'}</h2><span className="count">{rows.length}</span></div>
        <div className="category-items-grid">{rows.map(c => <div className="category-row" key={c.id}>
          <b>{c.name}{kind === 'vehicle' && <span className="category-brand-name">{brands.find(b => b.id === c.brandId)?.name || 'Chưa có thương hiệu'}</span>}</b>
          <span>{products.filter(p => p[kind === 'accessory' ? 'category' : 'vehicle'] === c.name).length} sản phẩm</span>
          <span className={'status ' + (c.locked ? 'locked' : 'available')}><i/>{c.locked ? 'Đã khóa' : 'Hoạt động'}</span>
          <div className="management-actions"><button className="secondary" aria-label={'Sửa danh mục ' + c.name} onClick={() => onEdit(c)}>Sửa</button><button className="secondary" aria-label={(c.locked ? 'Mở khóa' : 'Khóa') + ' danh mục ' + c.name} onClick={() => action('categories/' + c.id + '/lock', {})}>{c.locked ? 'Mở khóa' : 'Khóa'}</button></div>
        </div>)}</div>
      </section>;
    })}</div>
  </>;
}
