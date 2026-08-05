import React, { useEffect } from 'react';
import ReviewCard from './ReviewCard';
import { ChevronLeft, ChevronRight, Inbox } from 'lucide-react';
import { useReviews } from '../hooks/useApi';

export default function ReviewFeed({ filters, onThemeClick, onTotalChange }) {
  const [page, setPage] = React.useState(1);
  const pageSize = 12;
  useEffect(() => { setPage(1); }, [JSON.stringify(filters)]);

  const { reviews, total, loading } = useReviews({ ...filters, page, pageSize });
  const totalPages = Math.ceil(total / pageSize);
  useEffect(() => { onTotalChange?.(total); }, [total]);

  const Pager = () => totalPages > 1 && (
    <div className="flex items-center gap-1.5">
      <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}
        className="btn-quiet px-2.5" style={{ padding: '0.4rem 0.6rem' }}><ChevronLeft size={14} /></button>
      <span className="num text-[12px] min-w-[52px] text-center" style={{ color: 'var(--text-dim)' }}>{page} / {totalPages}</span>
      <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages}
        className="btn-quiet px-2.5" style={{ padding: '0.4rem 0.6rem' }}><ChevronRight size={14} /></button>
    </div>
  );

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <p className="text-[13px]" style={{ color: 'var(--text-dim)' }}>
          {!loading && <><span className="num font-semibold" style={{ color: 'var(--text)' }}>{total.toLocaleString()}</span> conversations · newest first</>}
        </p>
        <Pager />
      </div>

      {loading && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {[...Array(6)].map((_, i) => <div key={i} className="tile shimmer h-32" />)}
        </div>
      )}

      {!loading && reviews.length === 0 && (
        <div className="panel-quiet py-16 text-center" style={{ borderStyle: 'dashed' }}>
          <Inbox size={28} className="mx-auto mb-3" style={{ color: 'var(--text-faint)' }} />
          <p className="text-sm font-medium" style={{ color: 'var(--text-dim)' }}>No reviews match these filters.</p>
          <p className="eyebrow mt-1">Try clearing filters or running a sweep</p>
        </div>
      )}

      {!loading && reviews.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 stagger">
          {reviews.map((r, i) => <ReviewCard key={r.id} review={r} onThemeClick={onThemeClick} index={i} />)}
        </div>
      )}

      {!loading && totalPages > 1 && (
        <div className="flex justify-center mt-6"><Pager /></div>
      )}
    </div>
  );
}
