'use client';

import { useEffect, useState, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import type { RealtimeChannel, RealtimePostgresChangesPayload } from '@supabase/supabase-js';

type PostgresChangeEvent = 'INSERT' | 'UPDATE' | 'DELETE' | '*';

interface UseRealtimeOptions<T> {
  table: string;
  schema?: string;
  event?: PostgresChangeEvent;
  filter?: string;
  onInsert?: (payload: T) => void;
  onUpdate?: (payload: T) => void;
  onDelete?: (payload: { id: string }) => void;
}

/**
 * Supabase Realtime 구독 훅
 * 테이블의 변경사항을 실시간으로 감지합니다.
 */
export function useRealtime<T extends { id: string }>({
  table,
  schema = 'public',
  event = '*',
  filter,
  onInsert,
  onUpdate,
  onDelete,
}: UseRealtimeOptions<T>) {
  const [isConnected, setIsConnected] = useState(false);

  useEffect(() => {
    const supabase = createClient();
    let channel: RealtimeChannel;

    const setupSubscription = () => {
      const channelConfig: any = {
        event,
        schema,
        table,
      };

      if (filter) {
        channelConfig.filter = filter;
      }

      channel = supabase
        .channel(`${table}-changes`)
        .on(
          'postgres_changes',
          channelConfig,
          (payload: RealtimePostgresChangesPayload<T>) => {
            const eventType = payload.eventType;

            if (eventType === 'INSERT' && onInsert) {
              onInsert(payload.new as T);
            } else if (eventType === 'UPDATE' && onUpdate) {
              onUpdate(payload.new as T);
            } else if (eventType === 'DELETE' && onDelete) {
              onDelete({ id: (payload.old as any).id });
            }
          }
        )
        .subscribe((status) => {
          setIsConnected(status === 'SUBSCRIBED');
        });
    };

    setupSubscription();

    return () => {
      if (channel) {
        supabase.removeChannel(channel);
      }
    };
  }, [table, schema, event, filter, onInsert, onUpdate, onDelete]);

  return { isConnected };
}

/**
 * 테이블 데이터를 실시간으로 가져오고 구독하는 훅
 */
export function useRealtimeData<T extends { id: string }>(
  table: string,
  options?: {
    select?: string;
    filter?: Record<string, any>;
    orderBy?: { column: string; ascending?: boolean };
    limit?: number;
  }
) {
  const [data, setData] = useState<T[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchData = useCallback(async () => {
    const supabase = createClient();
    setLoading(true);
    setError(null);

    try {
      let query = supabase.from(table).select(options?.select || '*');

      // Apply filters
      if (options?.filter) {
        Object.entries(options.filter).forEach(([key, value]) => {
          query = query.eq(key, value);
        });
      }

      // Apply ordering
      if (options?.orderBy) {
        query = query.order(options.orderBy.column, {
          ascending: options.orderBy.ascending ?? false,
        });
      }

      // Apply limit
      if (options?.limit) {
        query = query.limit(options.limit);
      }

      const { data: result, error: fetchError } = await query;

      if (fetchError) throw fetchError;
      setData((result || []) as unknown as T[]);
    } catch (err) {
      setError(err as Error);
      console.error(`Error fetching ${table}:`, err);
    } finally {
      setLoading(false);
    }
  }, [table, options?.select, options?.filter, options?.orderBy, options?.limit]);

  // Initial fetch
  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Realtime subscription
  useRealtime<T>({
    table,
    onInsert: (newRecord) => {
      setData((prev) => [newRecord, ...prev]);
    },
    onUpdate: (updatedRecord) => {
      setData((prev) =>
        prev.map((item) => (item.id === updatedRecord.id ? updatedRecord : item))
      );
    },
    onDelete: ({ id }) => {
      setData((prev) => prev.filter((item) => item.id !== id));
    },
  });

  return { data, loading, error, refetch: fetchData };
}

/**
 * 단일 레코드를 실시간으로 가져오고 구독하는 훅
 */
export function useRealtimeRecord<T extends { id: string }>(
  table: string,
  id: string | null,
  options?: {
    select?: string;
  }
) {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchData = useCallback(async () => {
    if (!id) {
      setData(null);
      setLoading(false);
      return;
    }

    const supabase = createClient();
    setLoading(true);
    setError(null);

    try {
      const { data: result, error: fetchError } = await supabase
        .from(table)
        .select(options?.select || '*')
        .eq('id', id)
        .single();

      if (fetchError) throw fetchError;
      setData(result as unknown as T);
    } catch (err) {
      setError(err as Error);
      console.error(`Error fetching ${table}/${id}:`, err);
    } finally {
      setLoading(false);
    }
  }, [table, id, options?.select]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Realtime subscription for this specific record
  useRealtime<T>({
    table,
    filter: id ? `id=eq.${id}` : undefined,
    onUpdate: (updatedRecord) => {
      setData(updatedRecord);
    },
    onDelete: () => {
      setData(null);
    },
  });

  return { data, loading, error, refetch: fetchData };
}
