import { useCallback, useEffect, useState } from 'react';
import { cloudlabsApi, type CatalogResponse } from '../api/cloudlabs';

export function useCloudLabsCatalog() {
  const [data, setData] = useState<CatalogResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const reload = useCallback(async () => {
    setLoading(true);
    try { setData(await cloudlabsApi.catalog()); setError(null); }
    catch (error) { setError(error instanceof Error ? error.message : 'Unable to load the catalog.'); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => {
    void reload();
    const timer = window.setInterval(() => void reload(), 60000);
    return () => window.clearInterval(timer);
  }, [reload]);
  const refresh = async () => {
    if (refreshing) return;
    setRefreshing(true);
    setError(null);
    try {
      const result = await cloudlabsApi.refreshCatalog();
      setData(previous => ({ ...result, canRefresh: previous?.canRefresh ?? true, catalogInFlight: false, auditInFlight: false }));
    } catch (error) { setError(error instanceof Error ? error.message : 'Catalog refresh failed.'); }
    finally { setRefreshing(false); }
  };
  return { data, loading, refreshing, error, reload, refresh };
}