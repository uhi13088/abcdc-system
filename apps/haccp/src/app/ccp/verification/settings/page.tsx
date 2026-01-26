'use client';

import { useState, useEffect } from 'react';
import {
  ArrowLeft, Plus, Save, Trash2, Settings, HelpCircle,
  ChevronDown, ChevronUp, Edit2, GripVertical, CheckCircle2
} from 'lucide-react';
import { Label } from '@/components/ui/label';
import Link from 'next/link';

interface ProcessType {
  id: string;
  code: string;
  name: string;
  description?: string;
  parameters: { key: string; label: string; unit: string }[];
  sort_order: number;
  is_active: boolean;
}

interface VerificationQuestion {
  id: string;
  process_type_id?: string;
  question_code: string;
  question_text: string;
  question_category: string;
  help_text?: string;
  sort_order: number;
  is_required: boolean;
  is_active: boolean;
}

interface CommonQuestion {
  id: string;
  question_code: string;
  question_text: string;
  question_category: string;
  equipment_type?: string;
  calibration_frequency?: string;
  help_text?: string;
  sort_order: number;
  is_required: boolean;
  is_active: boolean;
}

const QUESTION_CATEGORIES = {
  STANDARD: '표준 검증 질문',
  CALIBRATION: '장비 검교정',
  CUSTOM: '사용자 정의',
};

const EQUIPMENT_TYPES = {
  THERMOMETER: '온도계',
  SCALE: '저울',
  TIMER: '타이머',
  WASH_TANK: '세척조',
  METAL_DETECTOR: '금속검출기',
};

const CALIBRATION_FREQUENCIES = {
  YEARLY: '연 1회',
  QUARTERLY: '분기 1회',
  MONTHLY: '월 1회',
  WEEKLY: '주 1회',
};

export default function CCPVerificationSettingsPage() {
  const [processTypes, setProcessTypes] = useState<ProcessType[]>([]);
  const [questions, setQuestions] = useState<VerificationQuestion[]>([]);
  const [commonQuestions, setCommonQuestions] = useState<CommonQuestion[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'process' | 'questions' | 'common'>('process');
  const [expandedProcess, setExpandedProcess] = useState<string | null>(null);
  const [showProcessModal, setShowProcessModal] = useState(false);
  const [showQuestionModal, setShowQuestionModal] = useState(false);
  const [editingProcess, setEditingProcess] = useState<ProcessType | null>(null);
  const [editingQuestion, setEditingQuestion] = useState<VerificationQuestion | CommonQuestion | null>(null);
  const [selectedProcessTypeId, setSelectedProcessTypeId] = useState<string>('');

  const [processForm, setProcessForm] = useState({
    code: '',
    name: '',
    description: '',
    parameters: [{ key: '', label: '', unit: '' }],
  });

  const [questionForm, setQuestionForm] = useState({
    process_type_id: '',
    question_code: '',
    question_text: '',
    question_category: 'STANDARD',
    help_text: '',
    is_required: true,
    is_common: false,
    equipment_type: '',
    calibration_frequency: 'YEARLY',
  });

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [processRes, questionsRes] = await Promise.all([
        fetch('/api/haccp/ccp/process-types'),
        fetch('/api/haccp/ccp/verification-questions?include_common=true'),
      ]);

      if (processRes.ok) {
        const data = await processRes.json();
        setProcessTypes(data);
      }

      if (questionsRes.ok) {
        const data = await questionsRes.json();
        setQuestions(data.questions || []);
        setCommonQuestions(data.commonQuestions || []);
      }
    } catch (error) {
      console.error('Failed to fetch data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSaveProcess = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const url = '/api/haccp/ccp/process-types';
      const method = editingProcess ? 'PUT' : 'POST';
      const body = editingProcess
        ? { id: editingProcess.id, ...processForm }
        : processForm;

      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      if (response.ok) {
        setShowProcessModal(false);
        setEditingProcess(null);
        resetProcessForm();
        fetchData();
      }
    } catch (error) {
      console.error('Failed to save process type:', error);
    }
  };

  const handleDeleteProcess = async (id: string) => {
    if (!confirm('이 공정 유형을 삭제하시겠습니까? 관련 검증 질문도 함께 삭제됩니다.')) return;

    try {
      const response = await fetch(`/api/haccp/ccp/process-types?id=${id}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        fetchData();
      }
    } catch (error) {
      console.error('Failed to delete process type:', error);
    }
  };

  const handleSaveQuestion = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const url = '/api/haccp/ccp/verification-questions';
      const method = editingQuestion ? 'PUT' : 'POST';
      const body = editingQuestion
        ? { ...questionForm, id: editingQuestion.id }
        : questionForm;

      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      if (response.ok) {
        setShowQuestionModal(false);
        setEditingQuestion(null);
        resetQuestionForm();
        fetchData();
      }
    } catch (error) {
      console.error('Failed to save question:', error);
    }
  };

  const handleDeleteQuestion = async (id: string, isCommon: boolean) => {
    if (!confirm('이 검증 질문을 삭제하시겠습니까?')) return;

    try {
      const response = await fetch(`/api/haccp/ccp/verification-questions?id=${id}&is_common=${isCommon}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        fetchData();
      }
    } catch (error) {
      console.error('Failed to delete question:', error);
    }
  };

  const resetProcessForm = () => {
    setProcessForm({
      code: '',
      name: '',
      description: '',
      parameters: [{ key: '', label: '', unit: '' }],
    });
  };

  const resetQuestionForm = () => {
    setQuestionForm({
      process_type_id: selectedProcessTypeId,
      question_code: '',
      question_text: '',
      question_category: 'STANDARD',
      help_text: '',
      is_required: true,
      is_common: false,
      equipment_type: '',
      calibration_frequency: 'YEARLY',
    });
  };

  const openEditProcess = (process: ProcessType) => {
    setEditingProcess(process);
    setProcessForm({
      code: process.code,
      name: process.name,
      description: process.description || '',
      parameters: process.parameters.length > 0 ? process.parameters : [{ key: '', label: '', unit: '' }],
    });
    setShowProcessModal(true);
  };

  const openEditQuestion = (question: VerificationQuestion | CommonQuestion, isCommon: boolean) => {
    setEditingQuestion(question);
    setQuestionForm({
      process_type_id: (question as VerificationQuestion).process_type_id || '',
      question_code: question.question_code,
      question_text: question.question_text,
      question_category: question.question_category,
      help_text: question.help_text || '',
      is_required: question.is_required,
      is_common: isCommon,
      equipment_type: (question as CommonQuestion).equipment_type || '',
      calibration_frequency: (question as CommonQuestion).calibration_frequency || 'YEARLY',
    });
    setShowQuestionModal(true);
  };

  const addParameter = () => {
    setProcessForm({
      ...processForm,
      parameters: [...processForm.parameters, { key: '', label: '', unit: '' }],
    });
  };

  const removeParameter = (index: number) => {
    setProcessForm({
      ...processForm,
      parameters: processForm.parameters.filter((_, i) => i !== index),
    });
  };

  const updateParameter = (index: number, field: string, value: string) => {
    const newParams = [...processForm.parameters];
    newParams[index] = { ...newParams[index], [field]: value };
    setProcessForm({ ...processForm, parameters: newParams });
  };

  const getQuestionsForProcess = (processTypeId: string) => {
    return questions.filter(q => q.process_type_id === processTypeId);
  };

  return (
    <div className="p-6">
      <div className="mb-6 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link href="/ccp/verification" className="p-2 hover:bg-gray-100 rounded-lg">
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">CCP 검증 설정</h1>
            <p className="mt-1 text-sm text-gray-500">
              공정 유형 및 월간 검증 질문을 관리합니다
            </p>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="mb-6 border-b">
        <div className="flex gap-4">
          <button
            onClick={() => setActiveTab('process')}
            className={`px-4 py-2 border-b-2 font-medium ${
              activeTab === 'process'
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            공정 유형
          </button>
          <button
            onClick={() => setActiveTab('questions')}
            className={`px-4 py-2 border-b-2 font-medium ${
              activeTab === 'questions'
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            공정별 검증 질문
          </button>
          <button
            onClick={() => setActiveTab('common')}
            className={`px-4 py-2 border-b-2 font-medium ${
              activeTab === 'common'
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            공통 검증 질문 (장비 검교정)
          </button>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        </div>
      ) : (
        <>
          {/* Process Types Tab */}
          {activeTab === 'process' && (
            <div>
              <div className="mb-4 flex justify-end">
                <button
                  onClick={() => {
                    resetProcessForm();
                    setEditingProcess(null);
                    setShowProcessModal(true);
                  }}
                  className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                >
                  <Plus className="w-4 h-4" />
                  공정 유형 추가
                </button>
              </div>

              <div className="space-y-4">
                {processTypes.map((process) => (
                  <div key={process.id} className="bg-white rounded-xl shadow-sm border overflow-hidden">
                    <div
                      className="p-4 flex items-center justify-between cursor-pointer hover:bg-gray-50"
                      onClick={() => setExpandedProcess(expandedProcess === process.id ? null : process.id)}
                    >
                      <div className="flex items-center gap-3">
                        <GripVertical className="w-4 h-4 text-gray-400" />
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-mono text-sm text-gray-500">{process.code}</span>
                            <span className="font-medium">{process.name}</span>
                            {!process.is_active && (
                              <span className="px-2 py-0.5 text-xs bg-gray-100 text-gray-600 rounded">비활성</span>
                            )}
                          </div>
                          <p className="text-sm text-gray-500">{process.description}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm text-gray-500">
                          질문 {getQuestionsForProcess(process.id).length}개
                        </span>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            openEditProcess(process);
                          }}
                          className="p-2 hover:bg-gray-200 rounded-lg"
                        >
                          <Edit2 className="w-4 h-4 text-gray-600" />
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDeleteProcess(process.id);
                          }}
                          className="p-2 text-red-600 hover:bg-red-50 rounded-lg"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                        {expandedProcess === process.id ? (
                          <ChevronUp className="w-5 h-5 text-gray-400" />
                        ) : (
                          <ChevronDown className="w-5 h-5 text-gray-400" />
                        )}
                      </div>
                    </div>

                    {expandedProcess === process.id && (
                      <div className="p-4 border-t bg-gray-50">
                        <h4 className="text-sm font-medium text-gray-700 mb-2">모니터링 파라미터</h4>
                        <div className="flex flex-wrap gap-2 mb-4">
                          {process.parameters.map((param, idx) => (
                            <span key={idx} className="px-3 py-1 bg-blue-100 text-blue-700 rounded-full text-sm">
                              {param.label} ({param.unit})
                            </span>
                          ))}
                        </div>

                        <h4 className="text-sm font-medium text-gray-700 mb-2">검증 질문</h4>
                        <div className="space-y-2">
                          {getQuestionsForProcess(process.id).map((q) => (
                            <div key={q.id} className="flex items-start gap-3 p-3 bg-white rounded-lg">
                              <CheckCircle2 className="w-4 h-4 text-green-500 mt-0.5 flex-shrink-0" />
                              <div className="flex-1">
                                <p className="text-sm">{q.question_text}</p>
                                {q.help_text && (
                                  <p className="text-xs text-gray-500 mt-1 flex items-center gap-1">
                                    <HelpCircle className="w-3 h-3" />
                                    {q.help_text}
                                  </p>
                                )}
                              </div>
                              <div className="flex items-center gap-1">
                                <span className={`px-2 py-0.5 text-xs rounded ${
                                  q.question_category === 'STANDARD' ? 'bg-blue-100 text-blue-700' :
                                  q.question_category === 'CALIBRATION' ? 'bg-orange-100 text-orange-700' :
                                  'bg-gray-100 text-gray-700'
                                }`}>
                                  {QUESTION_CATEGORIES[q.question_category as keyof typeof QUESTION_CATEGORIES]}
                                </span>
                                <button
                                  onClick={() => openEditQuestion(q, false)}
                                  className="p-1 hover:bg-gray-200 rounded"
                                >
                                  <Edit2 className="w-3 h-3 text-gray-600" />
                                </button>
                                <button
                                  onClick={() => handleDeleteQuestion(q.id, false)}
                                  className="p-1 text-red-600 hover:bg-red-50 rounded"
                                >
                                  <Trash2 className="w-3 h-3" />
                                </button>
                              </div>
                            </div>
                          ))}
                          <button
                            onClick={() => {
                              setSelectedProcessTypeId(process.id);
                              setQuestionForm({ ...questionForm, process_type_id: process.id, is_common: false });
                              setEditingQuestion(null);
                              setShowQuestionModal(true);
                            }}
                            className="w-full p-2 border-2 border-dashed border-gray-300 rounded-lg text-gray-500 hover:border-blue-400 hover:text-blue-600"
                          >
                            + 질문 추가
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Questions Tab */}
          {activeTab === 'questions' && (
            <div>
              <div className="mb-4 flex items-center justify-between">
                <select
                  value={selectedProcessTypeId}
                  onChange={(e) => setSelectedProcessTypeId(e.target.value)}
                  className="px-3 py-2 border rounded-lg"
                >
                  <option value="">전체 공정</option>
                  {processTypes.map(p => (
                    <option key={p.id} value={p.id}>{p.name}</option>
                  ))}
                </select>
                <button
                  onClick={() => {
                    resetQuestionForm();
                    setEditingQuestion(null);
                    setShowQuestionModal(true);
                  }}
                  className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                >
                  <Plus className="w-4 h-4" />
                  질문 추가
                </button>
              </div>

              <div className="bg-white rounded-xl shadow-sm border overflow-hidden">
                <div className="divide-y">
                  {(selectedProcessTypeId
                    ? questions.filter(q => q.process_type_id === selectedProcessTypeId)
                    : questions
                  ).map((q) => {
                    const process = processTypes.find(p => p.id === q.process_type_id);
                    return (
                      <div key={q.id} className="p-4 flex items-start gap-3 hover:bg-gray-50">
                        <CheckCircle2 className="w-5 h-5 text-green-500 mt-0.5 flex-shrink-0" />
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="px-2 py-0.5 text-xs bg-gray-100 text-gray-700 rounded">
                              {process?.name || '알 수 없음'}
                            </span>
                            <span className={`px-2 py-0.5 text-xs rounded ${
                              q.question_category === 'STANDARD' ? 'bg-blue-100 text-blue-700' :
                              q.question_category === 'CALIBRATION' ? 'bg-orange-100 text-orange-700' :
                              'bg-gray-100 text-gray-700'
                            }`}>
                              {QUESTION_CATEGORIES[q.question_category as keyof typeof QUESTION_CATEGORIES]}
                            </span>
                          </div>
                          <p className="text-sm">{q.question_text}</p>
                          {q.help_text && (
                            <p className="text-xs text-gray-500 mt-1 flex items-center gap-1">
                              <HelpCircle className="w-3 h-3" />
                              {q.help_text}
                            </p>
                          )}
                        </div>
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => openEditQuestion(q, false)}
                            className="p-2 hover:bg-gray-200 rounded-lg"
                          >
                            <Edit2 className="w-4 h-4 text-gray-600" />
                          </button>
                          <button
                            onClick={() => handleDeleteQuestion(q.id, false)}
                            className="p-2 text-red-600 hover:bg-red-50 rounded-lg"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {/* Common Questions Tab */}
          {activeTab === 'common' && (
            <div>
              <div className="mb-4 p-4 bg-blue-50 border border-blue-200 rounded-lg">
                <div className="flex items-start gap-3">
                  <Settings className="w-5 h-5 text-blue-600 mt-0.5" />
                  <div>
                    <p className="font-medium text-blue-900">공통 검증 질문 안내</p>
                    <p className="text-sm text-blue-700 mt-1">
                      모든 CCP 월간 검증에 공통으로 적용되는 질문입니다. 주로 장비 검교정 확인 질문이 포함됩니다.
                    </p>
                  </div>
                </div>
              </div>

              <div className="mb-4 flex justify-end">
                <button
                  onClick={() => {
                    setQuestionForm({
                      ...questionForm,
                      is_common: true,
                      question_category: 'CALIBRATION',
                    });
                    setEditingQuestion(null);
                    setShowQuestionModal(true);
                  }}
                  className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                >
                  <Plus className="w-4 h-4" />
                  공통 질문 추가
                </button>
              </div>

              <div className="bg-white rounded-xl shadow-sm border overflow-hidden">
                <div className="divide-y">
                  {commonQuestions.map((q) => (
                    <div key={q.id} className="p-4 flex items-start gap-3 hover:bg-gray-50">
                      <CheckCircle2 className="w-5 h-5 text-orange-500 mt-0.5 flex-shrink-0" />
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          {q.equipment_type && (
                            <span className="px-2 py-0.5 text-xs bg-orange-100 text-orange-700 rounded">
                              {EQUIPMENT_TYPES[q.equipment_type as keyof typeof EQUIPMENT_TYPES]}
                            </span>
                          )}
                          {q.calibration_frequency && (
                            <span className="px-2 py-0.5 text-xs bg-gray-100 text-gray-700 rounded">
                              {CALIBRATION_FREQUENCIES[q.calibration_frequency as keyof typeof CALIBRATION_FREQUENCIES]}
                            </span>
                          )}
                        </div>
                        <p className="text-sm">{q.question_text}</p>
                        {q.help_text && (
                          <p className="text-xs text-gray-500 mt-1 flex items-center gap-1">
                            <HelpCircle className="w-3 h-3" />
                            {q.help_text}
                          </p>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => openEditQuestion(q, true)}
                          className="p-2 hover:bg-gray-200 rounded-lg"
                        >
                          <Edit2 className="w-4 h-4 text-gray-600" />
                        </button>
                        <button
                          onClick={() => handleDeleteQuestion(q.id, true)}
                          className="p-2 text-red-600 hover:bg-red-50 rounded-lg"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </>
      )}

      {/* Process Type Modal */}
      {showProcessModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl w-full max-w-lg mx-4 p-6 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-bold">
                {editingProcess ? '공정 유형 수정' : '공정 유형 추가'}
              </h2>
              <button onClick={() => setShowProcessModal(false)} className="text-gray-500 hover:text-gray-700">
                닫기
              </button>
            </div>

            <form onSubmit={handleSaveProcess} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label required>코드</Label>
                  <input
                    type="text"
                    value={processForm.code}
                    onChange={(e) => setProcessForm({ ...processForm, code: e.target.value.toUpperCase() })}
                    className="w-full px-3 py-2 border rounded-lg"
                    placeholder="HEATING_OVEN"
                    required
                    disabled={!!editingProcess}
                  />
                </div>
                <div>
                  <Label required>공정명</Label>
                  <input
                    type="text"
                    value={processForm.name}
                    onChange={(e) => setProcessForm({ ...processForm, name: e.target.value })}
                    className="w-full px-3 py-2 border rounded-lg"
                    placeholder="가열(오븐) 공정"
                    required
                  />
                </div>
              </div>

              <div>
                <Label>설명</Label>
                <textarea
                  value={processForm.description}
                  onChange={(e) => setProcessForm({ ...processForm, description: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg"
                  rows={2}
                  placeholder="공정에 대한 설명"
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-2">
                  <Label>모니터링 파라미터</Label>
                  <button type="button" onClick={addParameter} className="text-sm text-blue-600 hover:text-blue-700">
                    + 파라미터 추가
                  </button>
                </div>
                <div className="space-y-2">
                  {processForm.parameters.map((param, idx) => (
                    <div key={idx} className="grid grid-cols-4 gap-2">
                      <input
                        type="text"
                        value={param.key}
                        onChange={(e) => updateParameter(idx, 'key', e.target.value)}
                        className="px-2 py-1 border rounded text-sm"
                        placeholder="키"
                      />
                      <input
                        type="text"
                        value={param.label}
                        onChange={(e) => updateParameter(idx, 'label', e.target.value)}
                        className="px-2 py-1 border rounded text-sm"
                        placeholder="라벨"
                      />
                      <input
                        type="text"
                        value={param.unit}
                        onChange={(e) => updateParameter(idx, 'unit', e.target.value)}
                        className="px-2 py-1 border rounded text-sm"
                        placeholder="단위"
                      />
                      <button
                        type="button"
                        onClick={() => removeParameter(idx)}
                        className="px-2 py-1 text-red-500 hover:bg-red-50 rounded text-sm"
                        disabled={processForm.parameters.length === 1}
                      >
                        삭제
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => setShowProcessModal(false)}
                  className="flex-1 px-4 py-2 border rounded-lg hover:bg-gray-50"
                >
                  취소
                </button>
                <button
                  type="submit"
                  className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center justify-center gap-2"
                >
                  <Save className="w-4 h-4" />
                  저장
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Question Modal */}
      {showQuestionModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl w-full max-w-lg mx-4 p-6 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-bold">
                {editingQuestion ? '검증 질문 수정' : '검증 질문 추가'}
              </h2>
              <button onClick={() => setShowQuestionModal(false)} className="text-gray-500 hover:text-gray-700">
                닫기
              </button>
            </div>

            <form onSubmit={handleSaveQuestion} className="space-y-4">
              {!questionForm.is_common && (
                <div>
                  <Label required>공정 유형</Label>
                  <select
                    value={questionForm.process_type_id}
                    onChange={(e) => setQuestionForm({ ...questionForm, process_type_id: e.target.value })}
                    className="w-full px-3 py-2 border rounded-lg"
                    required
                  >
                    <option value="">선택하세요</option>
                    {processTypes.map(p => (
                      <option key={p.id} value={p.id}>{p.name}</option>
                    ))}
                  </select>
                </div>
              )}

              <div>
                <Label required>질문 내용</Label>
                <textarea
                  value={questionForm.question_text}
                  onChange={(e) => setQuestionForm({ ...questionForm, question_text: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg"
                  rows={3}
                  placeholder="종사자가 주기적으로 가열온도 및 가열시간을 확인하고 기록하고 있습니까?"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>질문 카테고리</Label>
                  <select
                    value={questionForm.question_category}
                    onChange={(e) => setQuestionForm({ ...questionForm, question_category: e.target.value })}
                    className="w-full px-3 py-2 border rounded-lg"
                  >
                    {Object.entries(QUESTION_CATEGORIES).map(([key, label]) => (
                      <option key={key} value={key}>{label}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <Label>질문 코드</Label>
                  <input
                    type="text"
                    value={questionForm.question_code}
                    onChange={(e) => setQuestionForm({ ...questionForm, question_code: e.target.value.toUpperCase() })}
                    className="w-full px-3 py-2 border rounded-lg"
                    placeholder="HEATING_Q1"
                  />
                </div>
              </div>

              {questionForm.is_common && (
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>장비 유형</Label>
                    <select
                      value={questionForm.equipment_type}
                      onChange={(e) => setQuestionForm({ ...questionForm, equipment_type: e.target.value })}
                      className="w-full px-3 py-2 border rounded-lg"
                    >
                      <option value="">선택하세요</option>
                      {Object.entries(EQUIPMENT_TYPES).map(([key, label]) => (
                        <option key={key} value={key}>{label}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <Label>검교정 주기</Label>
                    <select
                      value={questionForm.calibration_frequency}
                      onChange={(e) => setQuestionForm({ ...questionForm, calibration_frequency: e.target.value })}
                      className="w-full px-3 py-2 border rounded-lg"
                    >
                      {Object.entries(CALIBRATION_FREQUENCIES).map(([key, label]) => (
                        <option key={key} value={key}>{label}</option>
                      ))}
                    </select>
                  </div>
                </div>
              )}

              <div>
                <Label>도움말</Label>
                <input
                  type="text"
                  value={questionForm.help_text}
                  onChange={(e) => setQuestionForm({ ...questionForm, help_text: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg"
                  placeholder="CCP 모니터링 기록을 확인하여 주기적인 기록 여부를 점검합니다."
                />
              </div>

              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={questionForm.is_required}
                  onChange={(e) => setQuestionForm({ ...questionForm, is_required: e.target.checked })}
                  className="w-4 h-4 rounded"
                />
                <span>필수 질문</span>
              </label>

              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => setShowQuestionModal(false)}
                  className="flex-1 px-4 py-2 border rounded-lg hover:bg-gray-50"
                >
                  취소
                </button>
                <button
                  type="submit"
                  className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center justify-center gap-2"
                >
                  <Save className="w-4 h-4" />
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
