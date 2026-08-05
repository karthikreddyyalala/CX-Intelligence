import { useState, useEffect, useCallback } from 'react';

function buildQuery(params) {
  const qs = Object.entries(params)
    .filter(([, v]) => v !== undefined && v !== null && v !== '')
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`)
    .join('&');
  return qs ? `?${qs}` : '';
}

export function useReviews(filters = {}) {
  const [reviews, setReviews] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const fetchReviews = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/reviews${buildQuery(filters)}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setReviews(data.data || []);
      setTotal(data.total || 0);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [JSON.stringify(filters)]);

  useEffect(() => { fetchReviews(); }, [fetchReviews]);
  return { reviews, total, loading, error, refetch: fetchReviews };
}

export function useStats(filters = {}) {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(false);

  const fetchStats = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/reviews/stats${buildQuery(filters)}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setStats(await res.json());
    } catch (e) {
      console.error('Stats fetch error:', e.message);
    } finally {
      setLoading(false);
    }
  }, [JSON.stringify(filters)]);

  useEffect(() => { fetchStats(); }, [fetchStats]);
  return { stats, loading, refetch: fetchStats };
}

export function usePainPoints() {
  const [painPoints, setPainPoints] = useState([]);
  const [loading, setLoading] = useState(false);

  const fetchPainPoints = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/pain-points');
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setPainPoints(await res.json());
    } catch (e) {
      console.error('Pain points fetch error:', e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchPainPoints(); }, [fetchPainPoints]);
  return { painPoints, loading, refetch: fetchPainPoints };
}

export function useInsightSummary() {
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(false);

  const fetchSummary = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/insight-summary');
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setSummary(await res.json());
    } catch (e) {
      console.error('Summary fetch error:', e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchSummary(); }, [fetchSummary]);
  return { summary, loading, refetch: fetchSummary };
}

export function useSourceRatings() {
  const [sourceRatings, setSourceRatings] = useState([]);
  const [loading, setLoading] = useState(false);

  const fetchSourceRatings = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/source-ratings');
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setSourceRatings(await res.json());
    } catch (e) {
      console.error('Source ratings fetch error:', e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchSourceRatings(); }, [fetchSourceRatings]);
  return { sourceRatings, loading, refetch: fetchSourceRatings };
}

export function usePipelineStatus() {
  const [status, setStatus] = useState(null);

  const fetchStatus = useCallback(async () => {
    try {
      const res = await fetch('/api/pipeline/status');
      if (!res.ok) return;
      setStatus(await res.json());
    } catch (_) {}
  }, []);

  useEffect(() => { fetchStatus(); }, [fetchStatus]);
  return { status, refetch: fetchStatus };
}
