'use client';

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';

interface HaccpStore {
  id: string;
  name: string;
  address: string | null;
  haccp_enabled: boolean;
}

interface HaccpStoreContextType {
  // 현재 선택된 매장
  currentStore: HaccpStore | null;
  // 사용 가능한 HACCP 매장 목록
  haccpStores: HaccpStore[];
  // 매장 수 제한 정보
  storeLimit: number;
  // 로딩 상태
  isLoading: boolean;
  // 매장 스위칭 가능 여부 (2개 이상 매장 + 매니저 이상)
  canSwitchStore: boolean;
  // 사용자 역할
  userRole: string | null;
  // 매장 변경 함수
  switchStore: (storeId: string) => Promise<void>;
  // 데이터 새로고침
  refreshStores: () => Promise<void>;
}

const HaccpStoreContext = createContext<HaccpStoreContextType>({
  currentStore: null,
  haccpStores: [],
  storeLimit: 1,
  isLoading: true,
  canSwitchStore: false,
  userRole: null,
  switchStore: async () => {},
  refreshStores: async () => {},
});

export const useHaccpStore = () => useContext(HaccpStoreContext);

// 매니저 이상 권한 체크
const isManagerOrAbove = (role: string | null): boolean => {
  if (!role) return false;
  return ['super_admin', 'company_admin', 'manager'].includes(role);
};

export function HaccpStoreProvider({ children }: { children: React.ReactNode }) {
  const [currentStore, setCurrentStore] = useState<HaccpStore | null>(null);
  const [haccpStores, setHaccpStores] = useState<HaccpStore[]>([]);
  const [storeLimit, setStoreLimit] = useState<number>(1);
  const [isLoading, setIsLoading] = useState(true);
  const [userRole, setUserRole] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);

  // 매장 목록 및 현재 매장 로드
  const loadStores = useCallback(async () => {
    try {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();

      if (!user) {
        setIsLoading(false);
        return;
      }

      // 사용자 정보 조회
      const { data: userProfile } = await supabase
        .from('users')
        .select('id, role, company_id, store_id, current_haccp_store_id')
        .eq('auth_id', user.id)
        .single();

      if (!userProfile?.company_id) {
        setIsLoading(false);
        return;
      }

      setUserId(userProfile.id);
      setUserRole(userProfile.role);

      // HACCP 활성화된 매장 목록 조회
      const { data: stores } = await supabase
        .from('stores')
        .select('id, name, address, haccp_enabled')
        .eq('company_id', userProfile.company_id)
        .eq('haccp_enabled', true)
        .order('name');

      const haccpStoreList = stores || [];
      setHaccpStores(haccpStoreList);

      // 구독 정보에서 매장 제한 조회
      const { data: subscription } = await supabase
        .from('company_subscriptions')
        .select('haccp_store_limit')
        .eq('company_id', userProfile.company_id)
        .single();

      setStoreLimit(subscription?.haccp_store_limit || 1);

      // 현재 매장 결정 로직
      let selectedStore: HaccpStore | null = null;

      // 1. 저장된 current_haccp_store_id 확인
      if (userProfile.current_haccp_store_id) {
        selectedStore = haccpStoreList.find(s => s.id === userProfile.current_haccp_store_id) || null;
      }

      // 2. 저장된 것이 없거나 유효하지 않으면, 매장이 1개면 자동 선택
      if (!selectedStore && haccpStoreList.length === 1) {
        selectedStore = haccpStoreList[0];
        // DB에 저장
        await supabase
          .from('users')
          .update({ current_haccp_store_id: selectedStore.id })
          .eq('id', userProfile.id);
      }

      // 3. 여전히 선택 안됐으면, 사용자의 기본 store_id가 HACCP 매장인지 확인
      if (!selectedStore && userProfile.store_id) {
        selectedStore = haccpStoreList.find(s => s.id === userProfile.store_id) || null;
        if (selectedStore) {
          await supabase
            .from('users')
            .update({ current_haccp_store_id: selectedStore.id })
            .eq('id', userProfile.id);
        }
      }

      // 4. 매니저 이상이고 아직 선택 안됐으면 첫 번째 매장 선택
      if (!selectedStore && haccpStoreList.length > 0 && isManagerOrAbove(userProfile.role)) {
        selectedStore = haccpStoreList[0];
        await supabase
          .from('users')
          .update({ current_haccp_store_id: selectedStore.id })
          .eq('id', userProfile.id);
      }

      setCurrentStore(selectedStore);
    } catch (error) {
      console.error('Failed to load HACCP stores:', error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // 매장 스위칭
  const switchStore = useCallback(async (storeId: string) => {
    if (!userId) return;

    const store = haccpStores.find(s => s.id === storeId);
    if (!store) return;

    try {
      const supabase = createClient();
      await supabase
        .from('users')
        .update({ current_haccp_store_id: storeId })
        .eq('id', userId);

      setCurrentStore(store);
    } catch (error) {
      console.error('Failed to switch store:', error);
      throw error;
    }
  }, [userId, haccpStores]);

  // 매장 목록 새로고침
  const refreshStores = useCallback(async () => {
    setIsLoading(true);
    await loadStores();
  }, [loadStores]);

  useEffect(() => {
    loadStores();
  }, [loadStores]);

  // 스위칭 가능 여부: 2개 이상 매장 + 매니저 이상 권한
  const canSwitchStore = haccpStores.length >= 2 && isManagerOrAbove(userRole);

  return (
    <HaccpStoreContext.Provider
      value={{
        currentStore,
        haccpStores,
        storeLimit,
        isLoading,
        canSwitchStore,
        userRole,
        switchStore,
        refreshStores,
      }}
    >
      {children}
    </HaccpStoreContext.Provider>
  );
}
