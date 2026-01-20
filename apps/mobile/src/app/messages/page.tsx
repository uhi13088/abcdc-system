'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Send, Inbox, Mail, Plus, X, Check, CheckCheck } from 'lucide-react';
import { createBrowserClient } from '@supabase/ssr';

function formatShortDate(dateStr: string): string {
  const date = new Date(dateStr);
  return `${date.getMonth() + 1}/${date.getDate()}`;
}

function formatFullDate(dateStr: string): string {
  const date = new Date(dateStr);
  return `${date.getFullYear()}년 ${date.getMonth() + 1}월 ${date.getDate()}일 ${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
}

function formatReadTime(dateStr: string): string {
  const date = new Date(dateStr);
  return `${date.getMonth() + 1}월 ${date.getDate()}일 ${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
}

interface Message {
  id: string;
  sender_id: string;
  sender_name: string;
  sender_role: string;
  recipient_id: string;
  recipient_name: string;
  recipient_role: string;
  subject: string;
  body: string;
  status: 'SENT' | 'READ' | 'REPLIED';
  read_at: string | null;
  created_at: string;
}

interface Recipient {
  id: string;
  name: string;
  role: string;
  role_label: string;
  position: string | null;
}

const roleLabels: Record<string, string> = {
  company_admin: '관리자',
  manager: '매니저',
  store_manager: '점장',
  staff: '직원',
  part_time: '파트타임',
};

export default function MessagesPage() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<'inbox' | 'sent'>('inbox');
  const [messages, setMessages] = useState<Message[]>([]);
  const [recipients, setRecipients] = useState<Recipient[]>([]);
  const [loading, setLoading] = useState(true);
  const [unreadCount, setUnreadCount] = useState(0);
  const [showComposeModal, setShowComposeModal] = useState(false);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [selectedMessage, setSelectedMessage] = useState<Message | null>(null);
  const [sending, setSending] = useState(false);
  const [formData, setFormData] = useState({
    recipient_id: '',
    subject: '',
    body: '',
  });

  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  const getAuthHeaders = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    return {
      'Authorization': `Bearer ${session?.access_token}`,
      'Content-Type': 'application/json',
    };
  };

  const fetchMessages = async () => {
    try {
      setLoading(true);
      const headers = await getAuthHeaders();
      const endpoint = activeTab === 'inbox' ? '/api/messages/inbox' : '/api/messages/sent';
      const response = await fetch(endpoint, { headers });

      if (response.ok) {
        const data = await response.json();
        setMessages(data.messages || []);
        if (activeTab === 'inbox') {
          setUnreadCount(data.unreadCount || 0);
        }
      }
    } catch (error) {
      console.error('Failed to fetch messages:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchRecipients = async () => {
    try {
      const headers = await getAuthHeaders();
      const response = await fetch('/api/messages/recipients', { headers });
      if (response.ok) {
        const data = await response.json();
        setRecipients(data);
      }
    } catch (error) {
      console.error('Failed to fetch recipients:', error);
    }
  };

  useEffect(() => {
    fetchMessages();
  }, [activeTab]);

  useEffect(() => {
    fetchRecipients();
  }, []);

  const handleOpenMessage = async (message: Message) => {
    setSelectedMessage(message);
    setShowDetailModal(true);

    // 받은 메시지 읽음 처리
    if (activeTab === 'inbox' && message.status === 'SENT') {
      try {
        const headers = await getAuthHeaders();
        await fetch(`/api/messages/${message.id}`, { headers });
        // 목록 갱신
        setMessages(prev => prev.map(m =>
          m.id === message.id ? { ...m, status: 'READ' as const, read_at: new Date().toISOString() } : m
        ));
        setUnreadCount(prev => Math.max(0, prev - 1));
      } catch (error) {
        console.error('Failed to mark as read:', error);
      }
    }
  };

  const handleSend = async () => {
    if (!formData.recipient_id || !formData.body.trim()) {
      alert('수신자와 내용을 입력해주세요.');
      return;
    }

    setSending(true);
    try {
      const headers = await getAuthHeaders();
      const response = await fetch('/api/messages', {
        method: 'POST',
        headers,
        body: JSON.stringify(formData),
      });

      if (response.ok) {
        setShowComposeModal(false);
        setFormData({ recipient_id: '', subject: '', body: '' });
        if (activeTab === 'sent') {
          fetchMessages();
        }
        alert('메시지를 전송했습니다.');
      } else {
        const error = await response.json();
        alert(error.error || '메시지 전송에 실패했습니다.');
      }
    } catch (error) {
      console.error('Failed to send message:', error);
      alert('메시지 전송에 실패했습니다.');
    } finally {
      setSending(false);
    }
  };

  const handleReply = () => {
    if (!selectedMessage) return;
    setFormData({
      recipient_id: selectedMessage.sender_id,
      subject: `RE: ${selectedMessage.subject || '(제목 없음)'}`,
      body: '',
    });
    setShowDetailModal(false);
    setShowComposeModal(true);
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'READ':
      case 'REPLIED':
        return <CheckCheck className="w-4 h-4 text-blue-500" />;
      default:
        return <Check className="w-4 h-4 text-gray-400" />;
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b sticky top-0 z-10">
        <div className="flex items-center justify-between px-4 py-3">
          <button onClick={() => router.back()} className="p-2 -ml-2">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <h1 className="text-lg font-semibold">메시지</h1>
          <button
            onClick={() => setShowComposeModal(true)}
            className="p-2 -mr-2 text-blue-600"
          >
            <Plus className="w-5 h-5" />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-t">
          <button
            onClick={() => setActiveTab('inbox')}
            className={`flex-1 py-3 text-sm font-medium flex items-center justify-center gap-2 ${
              activeTab === 'inbox'
                ? 'text-blue-600 border-b-2 border-blue-600'
                : 'text-gray-500'
            }`}
          >
            <Inbox className="w-4 h-4" />
            받은 메시지
            {unreadCount > 0 && (
              <span className="bg-red-500 text-white text-xs px-1.5 py-0.5 rounded-full">
                {unreadCount}
              </span>
            )}
          </button>
          <button
            onClick={() => setActiveTab('sent')}
            className={`flex-1 py-3 text-sm font-medium flex items-center justify-center gap-2 ${
              activeTab === 'sent'
                ? 'text-blue-600 border-b-2 border-blue-600'
                : 'text-gray-500'
            }`}
          >
            <Send className="w-4 h-4" />
            보낸 메시지
          </button>
        </div>
      </div>

      {/* Messages List */}
      <div className="p-4">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          </div>
        ) : messages.length === 0 ? (
          <div className="text-center py-12">
            <Mail className="w-12 h-12 text-gray-300 mx-auto mb-3" />
            <p className="text-gray-500">
              {activeTab === 'inbox' ? '받은 메시지가 없습니다' : '보낸 메시지가 없습니다'}
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {messages.map((message) => (
              <div
                key={message.id}
                onClick={() => handleOpenMessage(message)}
                className={`bg-white rounded-xl p-4 shadow-sm border cursor-pointer ${
                  activeTab === 'inbox' && message.status === 'SENT' ? 'border-blue-200 bg-blue-50/50' : ''
                }`}
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-medium text-gray-900 truncate">
                        {activeTab === 'inbox' ? message.sender_name : message.recipient_name}
                      </span>
                      <span className="text-xs text-gray-500 px-1.5 py-0.5 bg-gray-100 rounded">
                        {roleLabels[activeTab === 'inbox' ? message.sender_role : message.recipient_role] || ''}
                      </span>
                    </div>
                    <p className={`text-sm truncate ${
                      activeTab === 'inbox' && message.status === 'SENT' ? 'font-medium text-gray-900' : 'text-gray-600'
                    }`}>
                      {message.subject || '(제목 없음)'}
                    </p>
                    <p className="text-xs text-gray-500 truncate mt-1">
                      {message.body}
                    </p>
                  </div>
                  <div className="flex flex-col items-end ml-3">
                    <span className="text-xs text-gray-400">
                      {formatShortDate(message.created_at)}
                    </span>
                    {activeTab === 'sent' && (
                      <div className="mt-1">
                        {getStatusIcon(message.status)}
                      </div>
                    )}
                    {activeTab === 'inbox' && message.status === 'SENT' && (
                      <div className="w-2 h-2 bg-blue-500 rounded-full mt-2"></div>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Compose Modal */}
      {showComposeModal && (
        <div className="fixed inset-0 bg-black/50 flex items-end z-50">
          <div className="bg-white w-full rounded-t-2xl max-h-[90vh] overflow-y-auto animate-slide-up">
            <div className="sticky top-0 bg-white border-b px-4 py-3 flex items-center justify-between">
              <button onClick={() => setShowComposeModal(false)} className="p-2 -ml-2">
                <X className="w-5 h-5" />
              </button>
              <h2 className="font-semibold">새 메시지</h2>
              <button
                onClick={handleSend}
                disabled={sending || !formData.recipient_id || !formData.body.trim()}
                className="px-4 py-1.5 bg-blue-600 text-white text-sm rounded-full disabled:opacity-50"
              >
                {sending ? '전송 중...' : '보내기'}
              </button>
            </div>
            <div className="p-4 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">받는 사람</label>
                <select
                  value={formData.recipient_id}
                  onChange={(e) => setFormData({ ...formData, recipient_id: e.target.value })}
                  className="w-full px-3 py-2.5 border rounded-lg text-base"
                >
                  <option value="">선택하세요</option>
                  {recipients.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.name} ({r.role_label})
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">제목 (선택)</label>
                <input
                  type="text"
                  value={formData.subject}
                  onChange={(e) => setFormData({ ...formData, subject: e.target.value })}
                  className="w-full px-3 py-2.5 border rounded-lg text-base"
                  placeholder="제목을 입력하세요"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">내용</label>
                <textarea
                  value={formData.body}
                  onChange={(e) => setFormData({ ...formData, body: e.target.value })}
                  className="w-full px-3 py-2.5 border rounded-lg text-base h-40 resize-none"
                  placeholder="내용을 입력하세요"
                />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Detail Modal */}
      {showDetailModal && selectedMessage && (
        <div className="fixed inset-0 bg-black/50 flex items-end z-50">
          <div className="bg-white w-full rounded-t-2xl max-h-[90vh] overflow-y-auto animate-slide-up">
            <div className="sticky top-0 bg-white border-b px-4 py-3 flex items-center justify-between">
              <button onClick={() => setShowDetailModal(false)} className="p-2 -ml-2">
                <X className="w-5 h-5" />
              </button>
              <h2 className="font-semibold">메시지 상세</h2>
              {activeTab === 'inbox' && (
                <button
                  onClick={handleReply}
                  className="px-4 py-1.5 bg-blue-600 text-white text-sm rounded-full"
                >
                  답장
                </button>
              )}
              {activeTab === 'sent' && <div className="w-16"></div>}
            </div>
            <div className="p-4">
              <div className="mb-4">
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-sm text-gray-500">
                    {activeTab === 'inbox' ? '보낸 사람' : '받는 사람'}
                  </span>
                  <span className="font-medium">
                    {activeTab === 'inbox' ? selectedMessage.sender_name : selectedMessage.recipient_name}
                  </span>
                  <span className="text-xs text-gray-500 px-1.5 py-0.5 bg-gray-100 rounded">
                    {roleLabels[activeTab === 'inbox' ? selectedMessage.sender_role : selectedMessage.recipient_role] || ''}
                  </span>
                </div>
                <p className="text-xs text-gray-500">
                  {formatFullDate(selectedMessage.created_at)}
                </p>
              </div>
              <h3 className="text-lg font-semibold mb-3">
                {selectedMessage.subject || '(제목 없음)'}
              </h3>
              <div className="bg-gray-50 rounded-lg p-4">
                <p className="text-gray-700 whitespace-pre-wrap">{selectedMessage.body}</p>
              </div>
              {activeTab === 'sent' && selectedMessage.read_at && (
                <p className="text-xs text-gray-500 mt-3 flex items-center gap-1">
                  <CheckCheck className="w-4 h-4 text-blue-500" />
                  {formatReadTime(selectedMessage.read_at)}에 읽음
                </p>
              )}
            </div>
          </div>
        </div>
      )}

      <style jsx>{`
        @keyframes slide-up {
          from {
            transform: translateY(100%);
          }
          to {
            transform: translateY(0);
          }
        }
        .animate-slide-up {
          animation: slide-up 0.3s ease-out;
        }
      `}</style>
    </div>
  );
}
