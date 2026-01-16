'use client';

import { useState, useEffect } from 'react';
import { format } from 'date-fns';
import { ko } from 'date-fns/locale';
import { Send, Inbox, Mail, MailOpen, Reply, X, Search, User } from 'lucide-react';

interface Message {
  id: string;
  sender_id: string;
  sender_name: string | null;
  sender_role: string | null;
  recipient_id: string;
  recipient_name: string | null;
  recipient_role: string | null;
  subject: string | null;
  body: string;
  status: 'SENT' | 'READ' | 'REPLIED';
  read_at: string | null;
  reply_to: string | null;
  has_replies: boolean;
  reply_count: number;
  created_at: string;
}

interface CompanyMember {
  id: string;
  name: string;
  role: string;
  position: string | null;
  stores?: { name: string } | null;
}

export default function MessagesPage() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'inbox' | 'sent'>('inbox');
  const [showComposeModal, setShowComposeModal] = useState(false);
  const [selectedMessage, setSelectedMessage] = useState<Message | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [companyMembers, setCompanyMembers] = useState<CompanyMember[]>([]);
  const [loadingMembers, setLoadingMembers] = useState(false);
  const [formData, setFormData] = useState({
    recipient_id: '',
    subject: '',
    body: '',
  });

  useEffect(() => {
    fetchMessages();
    fetchCompanyMembers();
  }, [activeTab]);

  const fetchCompanyMembers = async () => {
    try {
      setLoadingMembers(true);
      const response = await fetch('/api/users?limit=1000&status=ACTIVE');
      if (response.ok) {
        const result = await response.json();
        setCompanyMembers(result.data || []);
      }
    } catch (error) {
      console.error('Failed to fetch company members:', error);
    } finally {
      setLoadingMembers(false);
    }
  };

  const fetchMessages = async () => {
    try {
      setLoading(true);
      const endpoint = activeTab === 'inbox' ? '/api/messages/inbox' : '/api/messages/sent';
      const response = await fetch(endpoint);
      if (response.ok) {
        const data = await response.json();
        setMessages(data);
      }
    } catch (error) {
      console.error('Failed to fetch messages:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const response = await fetch('/api/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });

      if (response.ok) {
        setShowComposeModal(false);
        setFormData({ recipient_id: '', subject: '', body: '' });
        if (activeTab === 'sent') fetchMessages();
      }
    } catch (error) {
      console.error('Failed to send message:', error);
    }
  };

  const handleReply = (message: Message) => {
    setFormData({
      recipient_id: message.sender_id,
      subject: `Re: ${message.subject || '(제목 없음)'}`,
      body: '',
    });
    setSelectedMessage(null);
    setShowComposeModal(true);
  };

  const unreadCount = messages.filter(m => m.status === 'SENT' && activeTab === 'inbox').length;

  const filteredMessages = messages.filter(m => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return (
      m.subject?.toLowerCase().includes(query) ||
      m.body.toLowerCase().includes(query) ||
      m.sender_name?.toLowerCase().includes(query) ||
      m.recipient_name?.toLowerCase().includes(query)
    );
  });

  return (
    <div className="p-6">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">메시지</h1>
          <p className="mt-1 text-sm text-gray-500">직원들과 메시지를 주고받습니다</p>
        </div>
        <button
          onClick={() => setShowComposeModal(true)}
          className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
        >
          <Send className="w-4 h-4" />
          메시지 작성
        </button>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-4 mb-6">
        <button
          onClick={() => setActiveTab('inbox')}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg ${
            activeTab === 'inbox' ? 'bg-blue-100 text-blue-700' : 'text-gray-600 hover:bg-gray-100'
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
          className={`flex items-center gap-2 px-4 py-2 rounded-lg ${
            activeTab === 'sent' ? 'bg-blue-100 text-blue-700' : 'text-gray-600 hover:bg-gray-100'
          }`}
        >
          <Send className="w-4 h-4" />
          보낸 메시지
        </button>
      </div>

      {/* Search */}
      <div className="mb-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder="메시지 검색..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border rounded-lg"
          />
        </div>
      </div>

      {/* Messages List */}
      {loading ? (
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        </div>
      ) : (
        <div className="bg-white rounded-xl shadow-sm border overflow-hidden">
          {filteredMessages.length === 0 ? (
            <div className="p-12 text-center">
              <Mail className="w-12 h-12 text-gray-300 mx-auto mb-4" />
              <p className="text-gray-500">메시지가 없습니다</p>
            </div>
          ) : (
            <div className="divide-y">
              {filteredMessages.map((message) => {
                const isUnread = message.status === 'SENT' && activeTab === 'inbox';
                const Icon = isUnread ? Mail : MailOpen;

                return (
                  <div
                    key={message.id}
                    className={`p-4 hover:bg-gray-50 cursor-pointer ${isUnread ? 'bg-blue-50' : ''}`}
                    onClick={() => setSelectedMessage(message)}
                  >
                    <div className="flex items-start gap-3">
                      <Icon className={`w-5 h-5 mt-0.5 ${isUnread ? 'text-blue-600' : 'text-gray-400'}`} />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between mb-1">
                          <span className={`font-medium ${isUnread ? 'text-gray-900' : 'text-gray-700'}`}>
                            {activeTab === 'inbox' ? message.sender_name : message.recipient_name}
                          </span>
                          <span className="text-xs text-gray-500">
                            {format(new Date(message.created_at), 'M/d HH:mm', { locale: ko })}
                          </span>
                        </div>
                        <p className={`text-sm truncate ${isUnread ? 'font-medium' : 'text-gray-600'}`}>
                          {message.subject || '(제목 없음)'}
                        </p>
                        <p className="text-sm text-gray-500 truncate mt-0.5">{message.body}</p>
                        {message.has_replies && (
                          <span className="text-xs text-blue-600 mt-1 inline-block">
                            답장 {message.reply_count}개
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Compose Modal */}
      {showComposeModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl w-full max-w-2xl mx-4 p-6">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-bold">새 메시지</h2>
              <button onClick={() => setShowComposeModal(false)} className="p-2 hover:bg-gray-100 rounded-lg">
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleSend} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">받는 사람</label>
                <select
                  value={formData.recipient_id}
                  onChange={(e) => setFormData({ ...formData, recipient_id: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg bg-white"
                  required
                >
                  <option value="">받는 사람 선택</option>
                  {loadingMembers ? (
                    <option disabled>불러오는 중...</option>
                  ) : (
                    companyMembers.map((member) => (
                      <option key={member.id} value={member.id}>
                        {member.name} ({member.position || member.role}){member.stores?.name ? ` - ${member.stores.name}` : ''}
                      </option>
                    ))
                  )}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">제목</label>
                <input
                  type="text"
                  value={formData.subject}
                  onChange={(e) => setFormData({ ...formData, subject: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg"
                  placeholder="메시지 제목"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">내용</label>
                <textarea
                  value={formData.body}
                  onChange={(e) => setFormData({ ...formData, body: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg h-48 resize-none"
                  placeholder="메시지 내용을 입력하세요"
                  required
                />
              </div>
              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => setShowComposeModal(false)}
                  className="flex-1 px-4 py-2 border rounded-lg hover:bg-gray-50"
                >
                  취소
                </button>
                <button
                  type="submit"
                  className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center justify-center gap-2"
                >
                  <Send className="w-4 h-4" />
                  보내기
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Message Detail Modal */}
      {selectedMessage && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl w-full max-w-2xl mx-4 p-6 max-h-[80vh] overflow-y-auto">
            <div className="flex items-start justify-between mb-4">
              <div>
                <h2 className="text-xl font-bold">{selectedMessage.subject || '(제목 없음)'}</h2>
                <div className="flex items-center gap-2 mt-2 text-sm text-gray-500">
                  <User className="w-4 h-4" />
                  <span>
                    {activeTab === 'inbox' ? (
                      <>
                        <strong>{selectedMessage.sender_name}</strong>님이 보냄
                      </>
                    ) : (
                      <>
                        <strong>{selectedMessage.recipient_name}</strong>님에게 보냄
                      </>
                    )}
                  </span>
                  <span>·</span>
                  <span>{format(new Date(selectedMessage.created_at), 'yyyy년 M월 d일 HH:mm', { locale: ko })}</span>
                </div>
              </div>
              <button onClick={() => setSelectedMessage(null)} className="p-2 hover:bg-gray-100 rounded-lg">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="py-4 border-t border-b">
              <p className="whitespace-pre-wrap text-gray-700">{selectedMessage.body}</p>
            </div>
            {activeTab === 'inbox' && (
              <div className="flex justify-end mt-4">
                <button
                  onClick={() => handleReply(selectedMessage)}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center gap-2"
                >
                  <Reply className="w-4 h-4" />
                  답장
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
