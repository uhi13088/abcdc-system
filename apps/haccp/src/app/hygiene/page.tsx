'use client';

import { useState, useEffect } from 'react';
import {
  Plus,
  Calendar,
  CheckCircle,
  XCircle,
  User,
  Thermometer,
  ChevronDown,
  ChevronUp,
  AlertTriangle,
} from 'lucide-react';
import toast from 'react-hot-toast';

// 점검 항목 정의
const CHECK_ITEMS = {
  pre_work: {
    title: '일일(작업전)',
    items: [
      { key: 'work_clothes_clean', label: '작업복, 작업화 이상', type: 'boolean' },
      { key: 'hand_wash_sanitize', label: '손세척 및 소독상태', type: 'boolean' },
      { key: 'entrance_sanitize', label: '출입구 소독실 정상', type: 'boolean' },
      { key: 'equipment_hygiene', label: '주변 설비 위생상태', type: 'boolean' },
      { key: 'floor_drain_clean', label: '바닥 및 배수구 청소', type: 'boolean' },
      { key: 'cross_contamination', label: '교차오염 방지', type: 'boolean' },
      { key: 'ingredients_check', label: '사용재료 유통기한 확인', type: 'boolean' },
    ],
    temperatures: [
      { key: 'freezer_temp', label: '냉동창고', target: -18 },
      { key: 'mixing_room_fridge', label: '배합실 냉장고', target: 5 },
      { key: 'packaging_room_fridge', label: '내포장실 냉장고/냉동고', target: 5 },
    ],
  },
  during_work: {
    title: '일일(작업중)',
    items: [
      { key: 'thaw_water_temp', label: '해동수조 온도 확인', type: 'temperature', target: 10 },
      { key: 'foreign_matter_sort', label: '이물선별 여부', type: 'boolean' },
      { key: 'environment_temp_humidity', label: '환경온습도 확인', type: 'boolean' },
    ],
    temperatures: [],
  },
  post_work: {
    title: '일일(작업후)',
    items: [
      { key: 'facility_equipment_clean', label: '시설 설비 청소상태 (물청소)', type: 'boolean' },
      { key: 'cooking_tools_sanitize', label: '조리기구 세척 살균', type: 'boolean' },
      { key: 'floor_drain_disinfect', label: '바닥 및 배수구 소독', type: 'boolean' },
      { key: 'waste_disposal', label: '폐기물 처리 상태', type: 'boolean' },
      { key: 'window_close', label: '창문 닫힘 상태', type: 'boolean' },
    ],
    temperatures: [
      { key: 'freezer_temp_post', label: '냉동창고', target: -18 },
      { key: 'mixing_room_fridge_post', label: '배합실 냉장고', target: 5 },
      { key: 'packaging_room_fridge_post', label: '내포장실 냉장고/냉동고', target: 5 },
    ],
  },
};

type CheckPeriod = '작업전' | '작업중' | '작업후';

interface HygieneCheck {
  id: string;
  check_date: string;
  check_period: CheckPeriod;
  checked_by_name?: string;
  pre_work_checks: Record<string, boolean>;
  during_work_checks: Record<string, boolean>;
  post_work_checks: Record<string, boolean>;
  temperature_records: Record<string, number>;
  remarks?: string;
  improvement_result?: string;
  overall_status: 'PASS' | 'FAIL';
  corrective_action?: string;
  verified_by_name?: string;
  verified_at?: string;
}

interface FormData {
  check_period: CheckPeriod;
  pre_work_checks: Record<string, boolean>;
  during_work_checks: Record<string, boolean>;
  post_work_checks: Record<string, boolean>;
  temperature_records: Record<string, number | ''>;
  remarks: string;
}

const getInitialFormData = (period: CheckPeriod): FormData => ({
  check_period: period,
  // 모든 점검항목을 기본적으로 체크된 상태로 (정상 상태 기본값)
  pre_work_checks: Object.fromEntries(
    CHECK_ITEMS.pre_work.items.map((item) => [item.key, true])
  ),
  during_work_checks: Object.fromEntries(
    CHECK_ITEMS.during_work.items.map((item) => [item.key, true])
  ),
  post_work_checks: Object.fromEntries(
    CHECK_ITEMS.post_work.items.map((item) => [item.key, true])
  ),
  temperature_records: {},
  remarks: '',
});

export default function HygienePage() {
  const [checks, setChecks] = useState<HygieneCheck[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [selectedPeriod, setSelectedPeriod] = useState<CheckPeriod>('작업전');
  const [formData, setFormData] = useState<FormData>(getInitialFormData('작업전'));
  const [expandedCards, setExpandedCards] = useState<Record<string, boolean>>({});
  const [deleteTarget, setDeleteTarget] = useState<HygieneCheck | null>(null);

  useEffect(() => {
    fetchChecks();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedDate]);

  const fetchChecks = async () => {
    try {
      setLoading(true);
      const response = await fetch(`/api/haccp/hygiene?date=${selectedDate}`);
      if (response.ok) {
        const data = await response.json();
        setChecks(data);
      }
    } catch (error) {
      console.error('Failed to fetch hygiene checks:', error);
      toast.error('위생점검 기록을 불러오는데 실패했습니다');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const periodKey =
      selectedPeriod === '작업전'
        ? 'pre_work'
        : selectedPeriod === '작업중'
          ? 'during_work'
          : 'post_work';
    const checkItems = CHECK_ITEMS[periodKey];
    const checksData =
      selectedPeriod === '작업전'
        ? formData.pre_work_checks
        : selectedPeriod === '작업중'
          ? formData.during_work_checks
          : formData.post_work_checks;

    // 모든 항목이 체크되었는지 확인
    const allChecked = checkItems.items.every((item) => checksData[item.key]);

    // 온도가 기준 범위 내인지 확인
    let tempOk = true;
    checkItems.temperatures.forEach((temp) => {
      const value = formData.temperature_records[temp.key];
      if (value !== undefined && value !== '') {
        if (temp.target < 0) {
          // 냉동: 기준 +3도까지 허용
          tempOk = tempOk && Number(value) <= temp.target + 3;
        } else {
          // 냉장: 기준 +5도까지 허용
          tempOk = tempOk && Number(value) <= temp.target + 5 && Number(value) >= 0;
        }
      }
    });

    const overall_status = allChecked && tempOk ? 'PASS' : 'FAIL';

    // 빈 문자열을 제거한 온도 기록
    const cleanedTempRecords: Record<string, number> = {};
    Object.entries(formData.temperature_records).forEach(([key, value]) => {
      if (value !== '' && value !== undefined) {
        cleanedTempRecords[key] = Number(value);
      }
    });

    try {
      const response = await fetch('/api/haccp/hygiene', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          check_date: selectedDate,
          check_period: selectedPeriod,
          pre_work_checks: formData.pre_work_checks,
          during_work_checks: formData.during_work_checks,
          post_work_checks: formData.post_work_checks,
          temperature_records: cleanedTempRecords,
          remarks: formData.remarks,
          overall_status,
        }),
      });

      if (response.ok) {
        setShowModal(false);
        setFormData(getInitialFormData(selectedPeriod));
        fetchChecks();
        toast.success('위생점검 기록이 저장되었습니다');
      }
    } catch (error) {
      console.error('Failed to create hygiene check:', error);
      toast.error('위생점검 기록 저장에 실패했습니다');
    }
  };

  const handleVerify = async (id: string) => {
    try {
      const response = await fetch('/api/haccp/hygiene', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, action: 'verify' }),
      });

      if (response.ok) {
        fetchChecks();
        toast.success('검증이 완료되었습니다');
      }
    } catch (error) {
      console.error('Failed to verify:', error);
      toast.error('검증 처리에 실패했습니다');
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      const response = await fetch(`/api/haccp/hygiene?id=${deleteTarget.id}`, {
        method: 'DELETE',
      });
      if (response.ok) {
        toast.success('위생점검 기록이 삭제되었습니다.');
        setDeleteTarget(null);
        fetchChecks();
      } else {
        const errorData = await response.json();
        toast.error(errorData.error || '위생점검 기록 삭제에 실패했습니다.');
      }
    } catch (error) {
      console.error('Failed to delete hygiene check:', error);
      toast.error('위생점검 기록 삭제에 실패했습니다.');
    }
  };

  const toggleCard = (id: string) => {
    setExpandedCards((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const openModal = (period: CheckPeriod) => {
    setSelectedPeriod(period);
    setFormData(getInitialFormData(period));
    setShowModal(true);
  };

  // 자동 입력 기능
  const handleAutoFill = () => {
    const periodKey =
      selectedPeriod === '작업전'
        ? 'pre_work'
        : selectedPeriod === '작업중'
          ? 'during_work'
          : 'post_work';
    const checkItems = CHECK_ITEMS[periodKey];

    // 모든 체크박스를 체크 상태로
    const autoChecks = Object.fromEntries(
      checkItems.items.map((item) => [item.key, true])
    );

    // 온도를 적정 범위 내 값으로 설정 (기준값에서 약간의 편차)
    const autoTemps: Record<string, number> = {};
    checkItems.temperatures.forEach((temp) => {
      if (temp.target < 0) {
        // 냉동: -18도 기준 → -19 ~ -17 사이 랜덤
        autoTemps[temp.key] = temp.target + (Math.random() * 2 - 1);
      } else {
        // 냉장: 5도 기준 → 3 ~ 6 사이 랜덤
        autoTemps[temp.key] = temp.target + (Math.random() * 3 - 1);
      }
      autoTemps[temp.key] = Math.round(autoTemps[temp.key] * 10) / 10;
    });

    if (selectedPeriod === '작업전') {
      setFormData((prev) => ({
        ...prev,
        pre_work_checks: autoChecks,
        temperature_records: { ...prev.temperature_records, ...autoTemps },
      }));
    } else if (selectedPeriod === '작업중') {
      setFormData((prev) => ({
        ...prev,
        during_work_checks: autoChecks,
        temperature_records: { ...prev.temperature_records, ...autoTemps },
      }));
    } else {
      setFormData((prev) => ({
        ...prev,
        post_work_checks: autoChecks,
        temperature_records: { ...prev.temperature_records, ...autoTemps },
      }));
    }
  };

  const periodColors: Record<CheckPeriod, string> = {
    작업전: 'bg-amber-100 text-amber-700 border-amber-200',
    작업중: 'bg-blue-100 text-blue-700 border-blue-200',
    작업후: 'bg-purple-100 text-purple-700 border-purple-200',
  };

  const periodBgColors: Record<CheckPeriod, string> = {
    작업전: 'bg-amber-50',
    작업중: 'bg-blue-50',
    작업후: 'bg-purple-50',
  };

  const getChecksByPeriod = (period: CheckPeriod) => {
    return checks.filter((c) => c.check_period === period);
  };

  const getCurrentPeriodItems = () => {
    const periodKey =
      selectedPeriod === '작업전'
        ? 'pre_work'
        : selectedPeriod === '작업중'
          ? 'during_work'
          : 'post_work';
    return CHECK_ITEMS[periodKey];
  };

  const getChecksForPeriod = () => {
    if (selectedPeriod === '작업전') return formData.pre_work_checks;
    if (selectedPeriod === '작업중') return formData.during_work_checks;
    return formData.post_work_checks;
  };

  const setChecksForPeriod = (key: string, value: boolean) => {
    if (selectedPeriod === '작업전') {
      setFormData((prev) => ({
        ...prev,
        pre_work_checks: { ...prev.pre_work_checks, [key]: value },
      }));
    } else if (selectedPeriod === '작업중') {
      setFormData((prev) => ({
        ...prev,
        during_work_checks: { ...prev.during_work_checks, [key]: value },
      }));
    } else {
      setFormData((prev) => ({
        ...prev,
        post_work_checks: { ...prev.post_work_checks, [key]: value },
      }));
    }
  };

  return (
    <div className="p-6">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">일반위생 공정관리 점검표</h1>
          <p className="mt-1 text-sm text-gray-500">일일점검 (작업전/작업중/작업후)</p>
        </div>
      </div>

      {/* Date Selector */}
      <div className="mb-6 flex items-center gap-4">
        <div className="flex items-center gap-2">
          <Calendar className="w-5 h-5 text-gray-400" />
          <input
            type="date"
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
            className="px-3 py-2 border rounded-lg"
          />
        </div>
      </div>

      {/* Period Cards */}
      {loading ? (
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        </div>
      ) : (
        <div className="space-y-6">
          {(['작업전', '작업중', '작업후'] as CheckPeriod[]).map((period) => {
            const periodChecks = getChecksByPeriod(period);
            const hasCheck = periodChecks.length > 0;
            const latestCheck = hasCheck ? periodChecks[periodChecks.length - 1] : null;

            return (
              <div
                key={period}
                className={`bg-white rounded-xl shadow-sm border overflow-hidden ${
                  latestCheck
                    ? latestCheck.overall_status === 'PASS'
                      ? 'border-green-200'
                      : 'border-red-200'
                    : 'border-gray-200'
                }`}
              >
                {/* Header */}
                <div
                  className={`px-4 py-3 flex items-center justify-between ${periodBgColors[period]}`}
                >
                  <div className="flex items-center gap-3">
                    <span
                      className={`px-3 py-1 text-sm font-medium rounded-full border ${periodColors[period]}`}
                    >
                      {period}
                    </span>
                    {latestCheck ? (
                      <div className="flex items-center gap-2">
                        {latestCheck.overall_status === 'PASS' ? (
                          <CheckCircle className="w-5 h-5 text-green-600" />
                        ) : (
                          <XCircle className="w-5 h-5 text-red-600" />
                        )}
                        <span
                          className={`text-sm font-medium ${
                            latestCheck.overall_status === 'PASS'
                              ? 'text-green-700'
                              : 'text-red-700'
                          }`}
                        >
                          {latestCheck.overall_status === 'PASS' ? '적합' : '부적합'}
                        </span>
                      </div>
                    ) : (
                      <span className="text-sm text-gray-500">미점검</span>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    {!hasCheck && (
                      <button
                        onClick={() => openModal(period)}
                        className="inline-flex items-center gap-1 px-3 py-1.5 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700"
                      >
                        <Plus className="w-4 h-4" />
                        점검 기록
                      </button>
                    )}
                    {hasCheck && (
                      <button
                        onClick={() => toggleCard(period)}
                        className="p-1 hover:bg-gray-100 rounded"
                      >
                        {expandedCards[period] ? (
                          <ChevronUp className="w-5 h-5 text-gray-500" />
                        ) : (
                          <ChevronDown className="w-5 h-5 text-gray-500" />
                        )}
                      </button>
                    )}
                  </div>
                </div>

                {/* Content */}
                {latestCheck && expandedCards[period] && (
                  <div className="p-4 space-y-4">
                    {/* 점검자 정보 */}
                    <div className="flex items-center gap-4 text-sm text-gray-600">
                      <div className="flex items-center gap-1">
                        <User className="w-4 h-4" />
                        <span>점검자: {latestCheck.checked_by_name || '-'}</span>
                      </div>
                      {latestCheck.verified_by_name && (
                        <div className="flex items-center gap-1">
                          <CheckCircle className="w-4 h-4 text-green-600" />
                          <span>
                            검증: {latestCheck.verified_by_name} (
                            {latestCheck.verified_at
                              ? new Date(latestCheck.verified_at).toLocaleString('ko-KR')
                              : ''}
                            )
                          </span>
                        </div>
                      )}
                    </div>

                    {/* 점검 항목 */}
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                      {CHECK_ITEMS[
                        period === '작업전'
                          ? 'pre_work'
                          : period === '작업중'
                            ? 'during_work'
                            : 'post_work'
                      ].items.map((item) => {
                        const checksData =
                          period === '작업전'
                            ? latestCheck.pre_work_checks
                            : period === '작업중'
                              ? latestCheck.during_work_checks
                              : latestCheck.post_work_checks;
                        const isChecked = checksData?.[item.key];
                        return (
                          <div
                            key={item.key}
                            className={`flex items-center gap-2 text-sm px-2 py-1 rounded ${
                              isChecked ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'
                            }`}
                          >
                            {isChecked ? (
                              <CheckCircle className="w-4 h-4" />
                            ) : (
                              <XCircle className="w-4 h-4" />
                            )}
                            <span>{item.label}</span>
                          </div>
                        );
                      })}
                    </div>

                    {/* 온도 기록 */}
                    {CHECK_ITEMS[
                      period === '작업전'
                        ? 'pre_work'
                        : period === '작업중'
                          ? 'during_work'
                          : 'post_work'
                    ].temperatures.length > 0 && (
                      <div className="bg-gray-50 rounded-lg p-3">
                        <div className="flex items-center gap-2 mb-2">
                          <Thermometer className="w-4 h-4 text-blue-600" />
                          <span className="font-medium text-sm">온도 기록</span>
                        </div>
                        <div className="grid grid-cols-3 gap-4">
                          {CHECK_ITEMS[
                            period === '작업전'
                              ? 'pre_work'
                              : period === '작업중'
                                ? 'during_work'
                                : 'post_work'
                          ].temperatures.map((temp) => {
                            const value = latestCheck.temperature_records?.[temp.key];
                            const isOk =
                              value !== undefined &&
                              (temp.target < 0
                                ? value <= temp.target + 3
                                : value <= temp.target + 5 && value >= 0);
                            return (
                              <div key={temp.key} className="text-sm">
                                <div className="text-gray-500">{temp.label}</div>
                                <div
                                  className={`font-medium ${
                                    value !== undefined
                                      ? isOk
                                        ? 'text-green-600'
                                        : 'text-red-600'
                                      : 'text-gray-400'
                                  }`}
                                >
                                  {value !== undefined ? `${value}°C` : '-'}
                                  {value !== undefined && !isOk && (
                                    <AlertTriangle className="w-4 h-4 inline ml-1" />
                                  )}
                                </div>
                                <div className="text-xs text-gray-400">기준: {temp.target}°C</div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    {/* 특이사항 / 개선조치 */}
                    {(latestCheck.remarks || latestCheck.corrective_action) && (
                      <div className="space-y-2">
                        {latestCheck.remarks && (
                          <div className="bg-yellow-50 rounded p-2">
                            <p className="text-xs font-medium text-yellow-800">특이사항</p>
                            <p className="text-sm text-yellow-700">{latestCheck.remarks}</p>
                          </div>
                        )}
                        {latestCheck.corrective_action && (
                          <div className="bg-orange-50 rounded p-2">
                            <p className="text-xs font-medium text-orange-800">개선조치</p>
                            <p className="text-sm text-orange-700">{latestCheck.corrective_action}</p>
                          </div>
                        )}
                      </div>
                    )}

                    {/* 검증 버튼 및 삭제 버튼 */}
                    <div className="flex justify-end gap-2 pt-2 border-t">
                      <button
                        onClick={() => setDeleteTarget(latestCheck)}
                        className="px-4 py-2 text-red-600 border border-red-300 text-sm rounded-lg hover:bg-red-50"
                      >
                        삭제
                      </button>
                      {!latestCheck.verified_by_name && (
                        <button
                          onClick={() => handleVerify(latestCheck.id)}
                          className="px-4 py-2 bg-green-600 text-white text-sm rounded-lg hover:bg-green-700"
                        >
                          검증 완료
                        </button>
                      )}
                    </div>
                  </div>
                )}

                {/* 간략 정보 (접힌 상태) */}
                {latestCheck && !expandedCards[period] && (
                  <div className="px-4 py-2 border-t border-gray-100 text-sm text-gray-500 flex items-center gap-4">
                    <span>점검자: {latestCheck.checked_by_name || '-'}</span>
                    {latestCheck.verified_by_name && (
                      <span className="text-green-600">검증 완료</span>
                    )}
                    <button
                      onClick={() => toggleCard(period)}
                      className="text-blue-600 hover:underline ml-auto"
                    >
                      상세보기
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deleteTarget && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={() => setDeleteTarget(null)}>
          <div className="bg-white rounded-xl w-full max-w-md mx-4 p-6" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-lg font-bold text-gray-900 mb-2">위생점검 기록 삭제</h3>
            <p className="text-gray-600 mb-4">
              정말로 이 기록을 삭제하시겠습니까?<br/>
              <span className="text-sm text-gray-500">
                {deleteTarget.check_date} - {deleteTarget.check_period}
              </span>
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setDeleteTarget(null)}
                className="flex-1 px-4 py-2 border rounded-lg hover:bg-gray-50"
              >
                취소
              </button>
              <button
                onClick={handleDelete}
                className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
              >
                삭제
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={() => setShowModal(false)}>
          <div className="bg-white rounded-xl w-full max-w-2xl mx-4 p-6 max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-6">
              <div>
                <h2 className="text-xl font-bold">위생점검 기록</h2>
                <p className="text-sm text-gray-500 mt-1">
                  {selectedDate} - {getCurrentPeriodItems().title}
                </p>
              </div>
              <button
                onClick={() => setShowModal(false)}
                className="text-gray-500 hover:text-gray-700"
              >
                닫기
              </button>
            </div>

            {/* 자동 입력 버튼 */}
            <div className="mb-4">
              <button
                type="button"
                onClick={handleAutoFill}
                className="w-full px-4 py-3 bg-gradient-to-r from-green-500 to-emerald-600 text-white font-medium rounded-lg hover:from-green-600 hover:to-emerald-700 transition-all shadow-md"
              >
                ✨ 자동 입력 (모든 항목 정상 처리)
              </button>
            </div>

            {/* Period Selector */}
            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-700 mb-2">점검 시점</label>
              <div className="flex gap-2">
                {(['작업전', '작업중', '작업후'] as CheckPeriod[]).map((period) => (
                  <button
                    key={period}
                    type="button"
                    onClick={() => {
                      setSelectedPeriod(period);
                      setFormData(getInitialFormData(period));
                    }}
                    className={`px-4 py-2 rounded-lg border ${
                      selectedPeriod === period
                        ? periodColors[period] + ' border-current'
                        : 'bg-gray-100 text-gray-700 border-gray-200 hover:bg-gray-200'
                    }`}
                  >
                    {period}
                  </button>
                ))}
              </div>
            </div>

            <form onSubmit={handleSubmit} className="space-y-6">
              {/* 점검 항목 */}
              <div className="bg-gray-50 rounded-lg p-4">
                <h3 className="font-medium text-gray-900 mb-3">점검 항목</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {getCurrentPeriodItems().items.map((item) => (
                    <label
                      key={item.key}
                      className="flex items-center gap-3 bg-white p-3 rounded-lg border cursor-pointer hover:border-blue-300"
                    >
                      <input
                        type="checkbox"
                        checked={getChecksForPeriod()[item.key] || false}
                        onChange={(e) => setChecksForPeriod(item.key, e.target.checked)}
                        className="w-5 h-5 rounded text-blue-600"
                      />
                      <span className="text-sm">{item.label}</span>
                    </label>
                  ))}
                </div>
              </div>

              {/* 온도 기록 */}
              {getCurrentPeriodItems().temperatures.length > 0 && (
                <div className="bg-blue-50 rounded-lg p-4">
                  <div className="flex items-center gap-2 mb-3">
                    <Thermometer className="w-5 h-5 text-blue-600" />
                    <h3 className="font-medium text-gray-900">온도 기록</h3>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {getCurrentPeriodItems().temperatures.map((temp) => (
                      <div key={temp.key} className="bg-white p-3 rounded-lg border">
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          {temp.label}
                        </label>
                        <div className="flex items-center gap-2">
                          <input
                            type="number"
                            step="0.1"
                            value={formData.temperature_records[temp.key] ?? ''}
                            onChange={(e) =>
                              setFormData((prev) => ({
                                ...prev,
                                temperature_records: {
                                  ...prev.temperature_records,
                                  [temp.key]: e.target.value === '' ? '' : parseFloat(e.target.value),
                                },
                              }))
                            }
                            className="w-full px-3 py-2 border rounded-lg"
                            placeholder={`기준: ${temp.target}°C`}
                          />
                          <span className="text-gray-500">°C</span>
                        </div>
                        <p className="text-xs text-gray-400 mt-1">기준: {temp.target}°C</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* 특이사항 */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  특이사항 및 개선조치
                </label>
                <textarea
                  value={formData.remarks}
                  onChange={(e) => setFormData((prev) => ({ ...prev, remarks: e.target.value }))}
                  rows={3}
                  className="w-full px-3 py-2 border rounded-lg"
                  placeholder="특이사항이나 개선이 필요한 사항을 기록하세요"
                />
              </div>

              {/* Buttons */}
              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="flex-1 px-4 py-2 border rounded-lg hover:bg-gray-50"
                >
                  취소
                </button>
                <button
                  type="submit"
                  className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                >
                  저장
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
