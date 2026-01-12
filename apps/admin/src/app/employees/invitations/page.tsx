'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Header } from '@/components/layout/header';
import {
  Button,
  Badge,
  Select,
  Table,
  TableHeader,
  TableBody,
  TableHead,
  TableRow,
  TableCell,
  EmptyState,
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui';
import { Plus, Send, Copy, Check, X, RefreshCw, Clock, UserPlus } from 'lucide-react';
import { format, formatDistanceToNow } from 'date-fns';
import { ko } from 'date-fns/locale';

interface Invitation {
  id: string;
  name: string;
  phone: string;
  role: string;
  position: string | null;
  status: string;
  token: string;
  expires_at: string;
  created_at: string;
  accepted_at: string | null;
  stores: { id: string; name: string } | null;
  invitation_templates: { id: string; name: string } | null;
  users: { id: string; name: string; email: string } | null;
}

interface Store {
  id: string;
  name: string;
}

const statusConfig: Record<string, { label: string; variant: 'success' | 'warning' | 'default' | 'danger' }> = {
  PENDING: { label: '대기 중', variant: 'warning' },
  ACCEPTED: { label: '가입 완료', variant: 'success' },
  EXPIRED: { label: '만료됨', variant: 'default' },
  CANCELLED: { label: '취소됨', variant: 'danger' },
};

const roleLabels: Record<string, string> = {
  staff: '직원',
  team_leader: '팀장',
  store_manager: '매장 관리자',
  manager: '본사 관리자',
  company_admin: '회사 관리자',
};

export default function InvitationsPage() {
  const [invitations, setInvitations] = useState<Invitation[]>([]);
  const [stores, setStores] = useState<Store[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('');
  const [storeFilter, setStoreFilter] = useState('');
  const [selectedInvitation, setSelectedInvitation] = useState<Invitation | null>(null);
  const [inviteUrl, setInviteUrl] = useState('');
  const [copied, setCopied] = useState(false);
  const [resending, setResending] = useState(false);

  const fetchData = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (statusFilter) params.set('status', statusFilter);
      if (storeFilter) params.set('storeId', storeFilter);

      const [invRes, storesRes] = await Promise.all([
        fetch(`/api/invitations?${params}`),
        fetch('/api/stores'),
      ]);

      if (invRes.ok) {
        const invData = await invRes.json();
        setInvitations(invData.data || []);
      }

      if (storesRes.ok) {
        const storesData = await storesRes.json();
        setStores(Array.isArray(storesData) ? storesData : storesData.data || []);
      }
    } catch (err) {
      console.error('Failed to fetch data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [statusFilter, storeFilter]);

  const openDetailDialog = async (invitation: Invitation) => {
    setSelectedInvitation(invitation);
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || window.location.origin;
    setInviteUrl(`${baseUrl}/invite/${invitation.token}`);
  };

  const copyToClipboard = async () => {
    await navigator.clipboard.writeText(inviteUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleResend = async () => {
    if (!selectedInvitation) return;
    setResending(true);

    try {
      const response = await fetch(`/api/invitations/${selectedInvitation.id}/resend`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sendMethods: ['kakao', 'sms', 'link'] }),
      });

      if (response.ok) {
        alert('재발송되었습니다.');
        setSelectedInvitation(null);
        fetchData();
      } else {
        const result = await response.json();
        alert(result.error || '재발송에 실패했습니다.');
      }
    } catch (err) {
      alert('재발송에 실패했습니다.');
    } finally {
      setResending(false);
    }
  };

  const handleCancel = async () => {
    if (!selectedInvitation) return;
    if (!confirm('정말 초대를 취소하시겠습니까?')) return;

    try {
      const response = await fetch(`/api/invitations/${selectedInvitation.id}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        setSelectedInvitation(null);
        fetchData();
      } else {
        const result = await response.json();
        alert(result.error || '취소에 실패했습니다.');
      }
    } catch (err) {
      alert('취소에 실패했습니다.');
    }
  };

  const getExpiresText = (expiresAt: string) => {
    const expires = new Date(expiresAt);
    const now = new Date();
    if (expires < now) {
      return '만료됨';
    }
    return formatDistanceToNow(expires, { addSuffix: true, locale: ko });
  };

  return (
    <div>
      <Header title="초대 현황" />

      <div className="p-6">
        <div className="mb-6 flex flex-col sm:flex-row gap-4 justify-between">
          <div className="flex gap-4">
            <Select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              options={[
                { value: '', label: '전체 상태' },
                { value: 'PENDING', label: '대기 중' },
                { value: 'ACCEPTED', label: '가입 완료' },
                { value: 'EXPIRED', label: '만료됨' },
                { value: 'CANCELLED', label: '취소됨' },
              ]}
              className="w-32"
            />
            <Select
              value={storeFilter}
              onChange={(e) => setStoreFilter(e.target.value)}
              options={[
                { value: '', label: '전체 매장' },
                ...stores.map((s) => ({ value: s.id, label: s.name })),
              ]}
              className="w-40"
            />
          </div>
          <Link href="/employees/invite">
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              직원 초대
            </Button>
          </Link>
        </div>

        {loading ? (
          <div className="flex justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          </div>
        ) : invitations.length === 0 ? (
          <EmptyState
            icon={UserPlus}
            title="초대 내역이 없습니다"
            description="직원을 초대해보세요."
            action={
              <Link href="/employees/invite">
                <Button>
                  <Plus className="h-4 w-4 mr-2" />
                  직원 초대
                </Button>
              </Link>
            }
          />
        ) : (
          <div className="bg-white rounded-lg border border-gray-200">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>이름</TableHead>
                  <TableHead>전화번호</TableHead>
                  <TableHead>매장</TableHead>
                  <TableHead>템플릿</TableHead>
                  <TableHead>상태</TableHead>
                  <TableHead>유효기간</TableHead>
                  <TableHead>초대일</TableHead>
                  <TableHead className="text-right">액션</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {invitations.map((invitation) => (
                  <TableRow key={invitation.id}>
                    <TableCell>
                      <div className="font-medium">{invitation.name}</div>
                      <div className="text-sm text-gray-500">
                        {roleLabels[invitation.role] || invitation.role}
                        {invitation.position && ` / ${invitation.position}`}
                      </div>
                    </TableCell>
                    <TableCell>{invitation.phone}</TableCell>
                    <TableCell>{invitation.stores?.name || '-'}</TableCell>
                    <TableCell>
                      {invitation.invitation_templates?.name || (
                        <span className="text-gray-400">직접 입력</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge variant={statusConfig[invitation.status]?.variant || 'default'}>
                        {statusConfig[invitation.status]?.label || invitation.status}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {invitation.status === 'PENDING' ? (
                        <span className="flex items-center gap-1 text-sm">
                          <Clock className="h-3 w-3" />
                          {getExpiresText(invitation.expires_at)}
                        </span>
                      ) : invitation.status === 'ACCEPTED' ? (
                        <span className="text-sm text-green-600">
                          {invitation.accepted_at && format(new Date(invitation.accepted_at), 'M/d HH:mm', { locale: ko })}
                        </span>
                      ) : (
                        '-'
                      )}
                    </TableCell>
                    <TableCell>
                      {format(new Date(invitation.created_at), 'M/d HH:mm', { locale: ko })}
                    </TableCell>
                    <TableCell>
                      <div className="flex justify-end">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => openDetailDialog(invitation)}
                        >
                          상세
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </div>

      {/* 상세 다이얼로그 */}
      <Dialog open={!!selectedInvitation} onOpenChange={() => setSelectedInvitation(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>초대 상세</DialogTitle>
          </DialogHeader>

          {selectedInvitation && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="text-gray-500">이름</span>
                  <p className="font-medium">{selectedInvitation.name}</p>
                </div>
                <div>
                  <span className="text-gray-500">전화번호</span>
                  <p className="font-medium">{selectedInvitation.phone}</p>
                </div>
                <div>
                  <span className="text-gray-500">매장</span>
                  <p className="font-medium">{selectedInvitation.stores?.name}</p>
                </div>
                <div>
                  <span className="text-gray-500">상태</span>
                  <p>
                    <Badge variant={statusConfig[selectedInvitation.status]?.variant || 'default'}>
                      {statusConfig[selectedInvitation.status]?.label || selectedInvitation.status}
                    </Badge>
                  </p>
                </div>
              </div>

              {selectedInvitation.status === 'PENDING' && (
                <div className="bg-gray-50 rounded-lg p-4">
                  <p className="text-sm font-medium text-gray-700 mb-2">초대 링크</p>
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      readOnly
                      value={inviteUrl}
                      className="flex-1 px-3 py-2 bg-white border border-gray-200 rounded text-sm"
                    />
                    <Button variant="outline" size="sm" onClick={copyToClipboard}>
                      {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                    </Button>
                  </div>
                  <p className="text-xs text-gray-500 mt-2">
                    유효기간: {getExpiresText(selectedInvitation.expires_at)}
                  </p>
                </div>
              )}

              {selectedInvitation.status === 'ACCEPTED' && selectedInvitation.users && (
                <div className="bg-green-50 rounded-lg p-4">
                  <p className="text-sm font-medium text-green-700 mb-2">가입 완료</p>
                  <p className="text-sm">
                    {selectedInvitation.users.name} ({selectedInvitation.users.email})
                  </p>
                </div>
              )}
            </div>
          )}

          <DialogFooter className="mt-6">
            {selectedInvitation?.status === 'PENDING' && (
              <>
                <Button variant="outline" onClick={handleCancel}>
                  <X className="h-4 w-4 mr-2" />
                  취소
                </Button>
                <Button onClick={handleResend} disabled={resending}>
                  <RefreshCw className={`h-4 w-4 mr-2 ${resending ? 'animate-spin' : ''}`} />
                  재발송
                </Button>
              </>
            )}
            {selectedInvitation?.status === 'EXPIRED' && (
              <Button onClick={handleResend} disabled={resending}>
                <Send className="h-4 w-4 mr-2" />
                다시 보내기
              </Button>
            )}
            <Button variant="outline" onClick={() => setSelectedInvitation(null)}>
              닫기
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
