import React, { useState, useEffect } from 'react';
import { Search, X, Download, SlidersHorizontal } from 'lucide-react';
import { SOURCE_LIST } from './SourceIcon';

function useDebounce(v, d) {
  const [dv, setDv] = useState(v);
  useEffect(() => { const t = setTimeout(() => setDv(v), d); return () => clearTimeout(t); }, [v, d]);
  return dv;
}

export default function FilterBar({ filters, onFilterChange, totalCount, onExportCsv }) {
  const [kw, setKw] = useState(filters.keyword || '');
  const [srcOpen, setSrcOpen] = useState(false);
  const debounced = useDebounce(kw, 300);
  useEffect(() => { onFilterChange({ ...filters, keyword: debounced }); }, [debounced]);
  useEffect(() => { setKw(filters.keyword || ''); }, [filters.keyword]);

  const selected = filters.source ? filters.source.split(',').filter(Boolean) : [];
  const toggleSrc = s => {
    const cur = new Set(selected);
    cur.has(s) ? cur.delete(s) : cur.add(s);
    onFilterChange({ ...filters, source: [...cur].join(',') });
  };
  const hasFilters = !!(filters.sentiment || filters.source || filters.keyword || filters.dateFrom || filters.dateTo);

  return (
    <div className="panel p-4 mb-4">
      <div className="flex flex-wrap gap-2.5 items-center">
        <div className="relative flex-1 min-w-[200px]">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: 'var(--text-faint)' }} />
          <input value={kw} onChange={e => setKw(e.target.value)} placeholder="Search reviews and topics…" className="field pl-8 w-full" />
          {kw && <button onClick={() => setKw('')} className="absolute right-2.5 top-1/2 -translate-y-1/2" style={{ color: 'var(--text-faint)' }}><X size={13} /></button>}
        </div>

        <select value={filters.sentiment || ''} onChange={e => onFilterChange({ ...filters, sentiment: e.target.value })} className="field min-w-[140px]">
          <option value="">All sentiment</option>
          <option value="positive">Positive</option>
          <option value="neutral">Neutral</option>
          <option value="negative">Negative</option>
        </select>

        <div className="relative">
          <button onClick={() => setSrcOpen(o => !o)} className="field flex items-center gap-2 min-w-[150px]"
            style={selected.length ? { borderColor: 'var(--accent)', color: 'var(--accent)' } : undefined}>
            <SlidersHorizontal size={13} />
            {selected.length ? `${selected.length} platform${selected.length > 1 ? 's' : ''}` : 'All platforms'}
            <span className="ml-auto opacity-60">▾</span>
          </button>
          {srcOpen && (
            <>
              <div className="fixed inset-0 z-40" onClick={() => setSrcOpen(false)} />
              <div className="absolute top-full left-0 mt-1.5 panel z-50 w-52 py-2 animate-scale-in">
                {SOURCE_LIST.map(src => (
                  <label key={src} className="flex items-center gap-2.5 px-3.5 py-2 cursor-pointer text-[13px]" style={{ color: 'var(--text-dim)' }}>
                    <input type="checkbox" checked={selected.includes(src)} onChange={() => toggleSrc(src)} className="w-3.5 h-3.5" style={{ accentColor: 'var(--accent)' }} />
                    {src}
                  </label>
                ))}
                {selected.length > 0 && (
                  <div className="px-3.5 pt-1 mt-1" style={{ borderTop: '1px solid var(--border)' }}>
                    <button onClick={() => onFilterChange({ ...filters, source: '' })} className="text-[12px] py-1" style={{ color: 'var(--neg)' }}>Clear platforms</button>
                  </div>
                )}
              </div>
            </>
          )}
        </div>

        <input type="date" value={filters.dateFrom || ''} onChange={e => onFilterChange({ ...filters, dateFrom: e.target.value })} className="field" title="From" />
        <input type="date" value={filters.dateTo || ''} onChange={e => onFilterChange({ ...filters, dateTo: e.target.value })} className="field" title="To" />

        {hasFilters && (
          <button onClick={() => { setKw(''); onFilterChange({ sentiment: '', source: '', keyword: '', dateFrom: '', dateTo: '' }); }} className="btn-quiet" style={{ color: 'var(--neg)' }}>
            <X size={13} /> Clear
          </button>
        )}
        <button onClick={onExportCsv} className="btn-quiet ml-auto"><Download size={13} /> Export CSV</button>
      </div>

      <div className="flex items-center justify-between mt-3 pt-3" style={{ borderTop: '1px solid var(--border)' }}>
        <p className="text-[12px]" style={{ color: 'var(--text-dim)' }}>
          <span className="num font-semibold" style={{ color: 'var(--text)' }}>{(totalCount || 0).toLocaleString()}</span> reviews
          {hasFilters && <span style={{ color: 'var(--accent)' }} className="ml-1">· filtered</span>}
        </p>
        {hasFilters && (
          <div className="flex flex-wrap gap-1.5">
            {filters.sentiment && <Chip label={filters.sentiment} onRemove={() => onFilterChange({ ...filters, sentiment: '' })} />}
            {selected.map(s => <Chip key={s} label={s} onRemove={() => toggleSrc(s)} />)}
            {filters.keyword && <Chip label={`"${filters.keyword}"`} onRemove={() => setKw('')} />}
          </div>
        )}
      </div>
    </div>
  );
}

function Chip({ label, onRemove }) {
  return (
    <span className="inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-full"
      style={{ background: 'var(--accent-soft)', color: 'var(--accent)', border: '1px solid color-mix(in srgb, var(--accent) 30%, transparent)' }}>
      {label}<button onClick={onRemove}><X size={10} /></button>
    </span>
  );
}
