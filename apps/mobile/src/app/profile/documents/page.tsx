'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Camera, Check, Upload, FileText, CreditCard, Shield, GraduationCap, Contact2, AlertCircle } from 'lucide-react';

interface DocumentType {
  id: string;
  label: string;
  icon: React.ElementType;
  hasExpiry?: boolean;
  hasBankInfo?: boolean;
}

interface UploadedDocument {
  type: string;
  url: string;
  uploaded_at: string;
  // 보건증 추가 필드
  expiry_date?: string;
  // 통장사본 추가 필드
  bank_name?: string;
  account_number?: string;
  account_holder?: string;
}

const DOCUMENT_TYPES: Record<string, DocumentType> = {
  health_certificate: { id: 'health_certificate', label: '보건증 사본', icon: Shield, hasExpiry: true },
  bank_copy: { id: 'bank_copy', label: '통장 사본', icon: CreditCard, hasBankInfo: true },
  career_certificate: { id: 'career_certificate', label: '경력 증명서', icon: FileText },
  education_certificate: { id: 'education_certificate', label: '학력 증명서', icon: GraduationCap },
  id_copy: { id: 'id_copy', label: '신분증 사본', icon: Contact2 },
};

const BANK_OPTIONS = [
  'KB국민은행', '신한은행', '하나은행', '우리은행', 'NH농협은행',
  'IBK기업은행', 'SC제일은행', '케이뱅크', '카카오뱅크', '토스뱅크',
  '새마을금고', '신협', '우체국', '수협', '부산은행', '대구은행',
];

export default function DocumentsPage() {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [requiredDocuments, setRequiredDocuments] = useState<string[]>([]);
  const [uploadedDocuments, setUploadedDocuments] = useState<Record<string, UploadedDocument>>({});
  const [selectedDoc, setSelectedDoc] = useState<string | null>(null);
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  // 추가 정보 입력 상태
  const [expiryDate, setExpiryDate] = useState('');
  const [bankName, setBankName] = useState('');
  const [accountNumber, setAccountNumber] = useState('');
  const [accountHolder, setAccountHolder] = useState('');

  // 이미지 압축 함수 (최대 1024px, 품질 70%)
  const compressImage = (file: File, maxWidth = 1024, quality = 0.7): Promise<File> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const img = new Image();
        img.onload = () => {
          const canvas = document.createElement('canvas');
          let { width, height } = img;

          // 가로가 maxWidth보다 크면 리사이즈
          if (width > maxWidth) {
            height = (height * maxWidth) / width;
            width = maxWidth;
          }

          canvas.width = width;
          canvas.height = height;

          const ctx = canvas.getContext('2d');
          if (!ctx) {
            resolve(file);
            return;
          }

          ctx.drawImage(img, 0, 0, width, height);

          canvas.toBlob(
            (blob) => {
              if (!blob) {
                resolve(file);
                return;
              }
              const compressedFile = new File([blob], file.name, {
                type: 'image/jpeg',
                lastModified: Date.now(),
              });
              console.log(`Image compressed: ${(file.size / 1024).toFixed(0)}KB → ${(compressedFile.size / 1024).toFixed(0)}KB`);
              resolve(compressedFile);
            },
            'image/jpeg',
            quality
          );
        };
        img.onerror = () => reject(new Error('Failed to load image'));
        img.src = e.target?.result as string;
      };
      reader.onerror = () => reject(new Error('Failed to read file'));
      reader.readAsDataURL(file);
    });
  };

  useEffect(() => {
    fetchDocuments();
  }, []);

  const fetchDocuments = async () => {
    try {
      const response = await fetch('/api/profile/documents');
      if (response.ok) {
        const data = await response.json();
        setRequiredDocuments(data.required_documents || []);
        setUploadedDocuments(data.uploaded_documents || {});
      }
    } catch (error) {
      console.error('Failed to fetch documents:', error);
    } finally {
      setLoading(false);
    }
  };

  const openUploadModal = (docType: string) => {
    setSelectedDoc(docType);
    setShowUploadModal(true);
    setPreviewUrl(null);
    setSelectedFile(null);
    setExpiryDate('');
    setBankName('');
    setAccountNumber('');
    setAccountHolder('');

    // 기존 데이터가 있으면 불러오기
    const existing = uploadedDocuments[docType];
    if (existing) {
      setPreviewUrl(existing.url);
      if (existing.expiry_date) setExpiryDate(existing.expiry_date);
      if (existing.bank_name) setBankName(existing.bank_name);
      if (existing.account_number) setAccountNumber(existing.account_number);
      if (existing.account_holder) setAccountHolder(existing.account_holder);
    }
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      try {
        // 이미지 압축 적용
        const compressedFile = await compressImage(file);
        setSelectedFile(compressedFile);

        const reader = new FileReader();
        reader.onload = (e) => {
          setPreviewUrl(e.target?.result as string);
        };
        reader.readAsDataURL(compressedFile);
      } catch (error) {
        console.error('Image compression failed:', error);
        // 압축 실패 시 원본 사용
        setSelectedFile(file);
        const reader = new FileReader();
        reader.onload = (e) => {
          setPreviewUrl(e.target?.result as string);
        };
        reader.readAsDataURL(file);
      }
    }
  };

  const handleSubmit = async () => {
    if (!selectedDoc) return;

    const docType = DOCUMENT_TYPES[selectedDoc];

    // 필수 필드 검증
    if (docType.hasExpiry && !expiryDate) {
      alert('유효기간을 입력해주세요.');
      return;
    }
    if (docType.hasBankInfo && (!bankName || !accountNumber || !accountHolder)) {
      alert('은행 정보를 모두 입력해주세요.');
      return;
    }

    setSaving(true);

    try {
      let fileUrl = previewUrl;

      // 새 파일이 선택된 경우 업로드
      if (selectedFile) {
        const formData = new FormData();
        formData.append('file', selectedFile);
        formData.append('type', selectedDoc);

        const uploadResponse = await fetch('/api/profile/documents/upload', {
          method: 'POST',
          body: formData,
        });

        if (!uploadResponse.ok) {
          throw new Error('파일 업로드에 실패했습니다.');
        }

        const uploadResult = await uploadResponse.json();
        fileUrl = uploadResult.url;
      }

      // 문서 메타데이터 저장
      const documentData: UploadedDocument = {
        type: selectedDoc,
        url: fileUrl || '',
        uploaded_at: new Date().toISOString(),
      };

      if (docType.hasExpiry) {
        documentData.expiry_date = expiryDate;
      }

      if (docType.hasBankInfo) {
        documentData.bank_name = bankName;
        documentData.account_number = accountNumber;
        documentData.account_holder = accountHolder;
      }

      const saveResponse = await fetch('/api/profile/documents', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(documentData),
      });

      if (!saveResponse.ok) {
        throw new Error('저장에 실패했습니다.');
      }

      // 상태 업데이트
      setUploadedDocuments((prev) => ({
        ...prev,
        [selectedDoc]: documentData,
      }));

      setShowUploadModal(false);
      alert('저장되었습니다.');
    } catch (error) {
      console.error('Submit error:', error);
      alert(error instanceof Error ? error.message : '저장에 실패했습니다.');
    } finally {
      setSaving(false);
    }
  };

  const getDocumentStatus = (docType: string) => {
    const uploaded = uploadedDocuments[docType];
    if (!uploaded?.url) return 'pending';

    // 보건증 유효기간 체크
    if (docType === 'health_certificate' && uploaded.expiry_date) {
      const expiry = new Date(uploaded.expiry_date);
      const now = new Date();
      if (expiry < now) return 'expired';
      // 30일 이내 만료 예정
      const thirtyDaysLater = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
      if (expiry < thirtyDaysLater) return 'expiring';
    }

    return 'completed';
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 p-4 safe-top">
        <div className="flex items-center">
          <button onClick={() => router.back()} className="mr-4">
            <ArrowLeft className="w-6 h-6" />
          </button>
          <h1 className="text-xl font-bold text-gray-900">서류 제출</h1>
        </div>
      </div>

      {/* Info */}
      <div className="p-4">
        <div className="bg-blue-50 rounded-xl p-4 flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-sm text-blue-800">
              회사에서 요청한 서류를 제출해주세요.
              <br />
              사진은 글씨가 잘 보이도록 촬영해주세요.
            </p>
          </div>
        </div>
      </div>

      {/* Document List */}
      <div className="p-4 space-y-3">
        {requiredDocuments.length === 0 ? (
          <div className="bg-white rounded-xl p-8 text-center">
            <FileText className="w-12 h-12 text-gray-300 mx-auto mb-4" />
            <p className="text-gray-500">요청된 서류가 없습니다.</p>
          </div>
        ) : (
          requiredDocuments.map((docType) => {
            const doc = DOCUMENT_TYPES[docType];
            if (!doc) return null;

            const status = getDocumentStatus(docType);
            const uploaded = uploadedDocuments[docType];
            const Icon = doc.icon;

            return (
              <button
                key={docType}
                onClick={() => openUploadModal(docType)}
                className="w-full bg-white rounded-xl p-4 flex items-center gap-4 shadow-sm"
              >
                <div className={`w-12 h-12 rounded-full flex items-center justify-center ${
                  status === 'completed' ? 'bg-green-100' :
                  status === 'expired' ? 'bg-red-100' :
                  status === 'expiring' ? 'bg-yellow-100' :
                  'bg-gray-100'
                }`}>
                  <Icon className={`w-6 h-6 ${
                    status === 'completed' ? 'text-green-600' :
                    status === 'expired' ? 'text-red-600' :
                    status === 'expiring' ? 'text-yellow-600' :
                    'text-gray-400'
                  }`} />
                </div>
                <div className="flex-1 text-left">
                  <p className="font-medium text-gray-900">{doc.label}</p>
                  {status === 'completed' && (
                    <p className="text-sm text-green-600">제출 완료</p>
                  )}
                  {status === 'expired' && (
                    <p className="text-sm text-red-600">유효기간 만료</p>
                  )}
                  {status === 'expiring' && (
                    <p className="text-sm text-yellow-600">곧 만료 예정</p>
                  )}
                  {status === 'pending' && (
                    <p className="text-sm text-gray-400">미제출</p>
                  )}
                </div>
                {status === 'completed' ? (
                  <Check className="w-5 h-5 text-green-600" />
                ) : (
                  <Upload className="w-5 h-5 text-gray-400" />
                )}
              </button>
            );
          })
        )}
      </div>

      {/* Upload Modal */}
      {showUploadModal && selectedDoc && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-end">
          <div className="bg-white w-full rounded-t-3xl max-h-[90vh] overflow-y-auto safe-bottom">
            <div className="p-4 border-b border-gray-200 flex items-center justify-between">
              <h2 className="text-lg font-bold">{DOCUMENT_TYPES[selectedDoc]?.label}</h2>
              <button onClick={() => setShowUploadModal(false)} className="text-gray-400">
                닫기
              </button>
            </div>

            <div className="p-4 space-y-6">
              {/* 사진 업로드 */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  사진 <span className="text-red-500">*</span>
                </label>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  capture="environment"
                  onChange={handleFileSelect}
                  className="hidden"
                />
                {previewUrl ? (
                  <div className="relative">
                    <img
                      src={previewUrl}
                      alt="Preview"
                      className="w-full h-48 object-cover rounded-xl"
                    />
                    <button
                      onClick={() => fileInputRef.current?.click()}
                      className="absolute bottom-2 right-2 bg-white px-3 py-1 rounded-lg shadow text-sm"
                    >
                      다시 촬영
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    className="w-full h-48 border-2 border-dashed border-gray-300 rounded-xl flex flex-col items-center justify-center text-gray-400"
                  >
                    <Camera className="w-12 h-12 mb-2" />
                    <p>터치하여 사진 촬영</p>
                  </button>
                )}
              </div>

              {/* 보건증 추가 정보 */}
              {DOCUMENT_TYPES[selectedDoc]?.hasExpiry && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    유효기간 <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="date"
                    value={expiryDate}
                    onChange={(e) => setExpiryDate(e.target.value)}
                    className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-primary focus:border-primary"
                  />
                </div>
              )}

              {/* 통장사본 추가 정보 */}
              {DOCUMENT_TYPES[selectedDoc]?.hasBankInfo && (
                <>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      은행 <span className="text-red-500">*</span>
                    </label>
                    <select
                      value={bankName}
                      onChange={(e) => setBankName(e.target.value)}
                      className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-primary focus:border-primary"
                    >
                      <option value="">선택하세요</option>
                      {BANK_OPTIONS.map((bank) => (
                        <option key={bank} value={bank}>{bank}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      계좌번호 <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={accountNumber}
                      onChange={(e) => setAccountNumber(e.target.value.replace(/[^0-9-]/g, ''))}
                      placeholder="- 없이 숫자만 입력"
                      className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-primary focus:border-primary"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      예금주 <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={accountHolder}
                      onChange={(e) => setAccountHolder(e.target.value)}
                      placeholder="예금주명 입력"
                      className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-primary focus:border-primary"
                    />
                  </div>
                </>
              )}

              {/* 저장 버튼 */}
              <button
                onClick={handleSubmit}
                disabled={saving || !previewUrl}
                className="w-full py-4 bg-primary text-white rounded-xl font-medium disabled:bg-gray-300"
              >
                {saving ? '저장 중...' : '저장'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
