'use client';

import { useEffect, useState } from 'react';
import { Header } from '@/components/layout/header';
import {
  Button,
  Badge,
  Table,
  TableHeader,
  TableBody,
  TableHead,
  TableRow,
  TableCell,
  EmptyState,
  PageLoading,
  Select,
  Pagination,
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  Textarea,
  Label,
  Card,
  CardContent,
} from '@/components/ui';
import { CheckSquare, Check, X, Eye, Clock, Calendar, DollarSign, ShoppingCart, UserMinus, RefreshCw, Trash2, FileX, UserPlus } from 'lucide-react';

interface ApprovalRequest {
  id: string;
  type: string;
  requester_name: string;
  requester_role: string;
  final_status: string;
  current_step: number;
  approval_line: Array<{
    order: number;
    approverId: string;
    approverName: string;
    approverRole: string;
    status: string;
    comment?: string;
    decidedAt?: string;
  }>;
  details: Record<string, unknown>;
  created_at: string;
  finalized_at: string | null;
}

const typeLabels: Record<string, { label: string; icon: React.ComponentType<{ className?: string }> }> = {
  LEAVE: { label: '휴가', icon: Calendar },
  OVERTIME: { label: '초과근무', icon: Clock },
  SCHEDULE_CHANGE: { label: '근무조정', icon: RefreshCw },
  PURCHASE: { label: '구매', icon: ShoppingCart },
  EXPENSE: { label: '경비', icon: DollarSign },
  DISPOSAL: { label: '폐기', icon: Trash2 },
  RESIGNATION: { label: '사직서', icon: UserMinus },
  ABSENCE_EXCUSE: { label: '결근사유서', icon: FileX },
  UNSCHEDULED_CHECKIN: { label: '미배정 출근', icon: UserPlus },
};

const statusMap: Record<string, { label: string; variant: 'default' | 'warning' | 'success' | 'danger' }> = {
  PENDING: { label: '대기중', variant: 'warning' },
  APPROVED: { label: '승인', variant: 'success' },
  REJECTED: { label: '거부', variant: 'danger' },
  CANCELLED: { label: '취소', variant: 'default' },
};

export default function ApprovalsPage() {
  const [approvals, setApprovals] = useState<ApprovalRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [typeFilter, setTypeFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  // Process dialog
  const [selectedApproval, setSelectedApproval] = useState<ApprovalRequest | null>(null);
  const [showProcessDialog, setShowProcessDialog] = useState(false);
  const [comment, setComment] = useState('');
  const [processing, setProcessing] = useState(false);


  const fetchApprovals = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: currentPage.toString(),
        limit: '10',
      });
      if (typeFilter) params.set('type', typeFilter);
      if (statusFilter) params.set('status', statusFilter);

      const response = await fetch(`/api/approvals?${params}`);
      const result = await response.json();

      if (response.ok) {
        setApprovals(result.data);
        setTotalPages(result.pagination.totalPages);
      }
    } catch (error) {
      console.error('Failed to fetch approvals:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchApprovals();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentPage, typeFilter, statusFilter]);

  const handleProcess = async (decision: 'APPROVED' | 'REJECTED') => {
    if (!selectedApproval) return;

    setProcessing(true);

    try {
      const response = await fetch(`/api/approvals/${selectedApproval.id}/process`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ decision, comment }),
      });

      if (response.ok) {
        setShowProcessDialog(false);
        setComment('');
        setSelectedApproval(null);
        fetchApprovals();
      } else {
        const data = await response.json();
        alert(data.error || '처리에 실패했습니다.');
      }
    } catch (_error) {
      alert('처리에 실패했습니다.');
    } finally {
      setProcessing(false);
    }
  };

  const openProcessDialog = (approval: ApprovalRequest) => {
    setSelectedApproval(approval);
    setShowProcessDialog(true);
  };

  const formatDetails = (type: string, details: Record<string, unknown>) => {
    switch (type) {
      case 'LEAVE':
        return `${details.leave_type_name || details.leaveType || '-'} (${details.start_date || details.startDate} ~ ${details.end_date || details.endDate})`;
      case 'OVERTIME':
        return `${details.overtime_date || details.date} ${details.overtime_hours || details.startTime}시간`;
      case 'SCHEDULE_CHANGE':
        return `${details.original_date || '-'} → ${details.requested_date || '-'}`;
      case 'PURCHASE':
        return `${details.itemName} (${(details.quantity as number) * (details.unitPrice as number)}원)`;
      case 'EXPENSE':
        return `${details.description || details.itemName || '-'} (${details.amount || '-'}원)`;
      case 'DISPOSAL':
        return `${details.itemName || '-'} (${details.reason || '-'})`;
      case 'RESIGNATION':
        return `퇴사 예정일: ${details.resignationDate || '-'}`;
      case 'ABSENCE_EXCUSE':
        return `${details.work_date || details.absence_date || '-'} / 사유: ${details.reason || '-'}`;
      case 'UNSCHEDULED_CHECKIN':
        return `${details.work_date || '-'} / 출근시간: ${details.check_in_time ? new Date(details.check_in_time as string).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' }) : '-'}`;
      default:
        return JSON.stringify(details);
    }
  };

  return (
    <div>
      <Header title="승인 관리" />

      <div className="p-6">
        {/* Toolbar */}
        <div className="mb-6 flex flex-col sm:flex-row gap-4 justify-between">
          <div className="flex gap-4">
            <Select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
              options={[
                { value: '', label: '전체 유형' },
                { value: 'LEAVE', label: '휴가' },
                { value: 'OVERTIME', label: '초과근무' },
                { value: 'SCHEDULE_CHANGE', label: '근무조정' },
                { value: 'PURCHASE', label: '구매' },
                { value: 'EXPENSE', label: '경비' },
                { value: 'DISPOSAL', label: '폐기' },
                { value: 'RESIGNATION', label: '사직서' },
                { value: 'ABSENCE_EXCUSE', label: '결근사유서' },
                { value: 'UNSCHEDULED_CHECKIN', label: '미배정 출근' },
              ]}
              className="w-36"
            />
            <Select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              options={[
                { value: '', label: '전체 상태' },
                { value: 'PENDING', label: '대기중' },
                { value: 'APPROVED', label: '승인' },
                { value: 'REJECTED', label: '거부' },
              ]}
              className="w-32"
            />
          </div>
        </div>

        {loading ? (
          <PageLoading />
        ) : approvals.length === 0 ? (
          <EmptyState
            icon={CheckSquare}
            title="승인 요청이 없습니다"
            description="직원들의 승인 요청이 여기에 표시됩니다."
          />
        ) : (
          <>
            <div className="bg-white rounded-lg border border-gray-200">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>유형</TableHead>
                    <TableHead>요청자</TableHead>
                    <TableHead>내용</TableHead>
                    <TableHead>결재선</TableHead>
                    <TableHead>상태</TableHead>
                    <TableHead>요청일</TableHead>
                    <TableHead className="text-right">액션</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {approvals.map((approval) => {
                    const TypeIcon = typeLabels[approval.type]?.icon || CheckSquare;
                    return (
                      <TableRow key={approval.id}>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <TypeIcon className="h-4 w-4 text-gray-400" />
                            <span>{typeLabels[approval.type]?.label || approval.type}</span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div>
                            <p className="font-medium">{approval.requester_name}</p>
                            <p className="text-sm text-gray-500">{approval.requester_role}</p>
                          </div>
                        </TableCell>
                        <TableCell className="max-w-xs truncate">
                          {formatDetails(approval.type, approval.details)}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1">
                            {approval.approval_line.map((step, idx) => (
                              <span key={idx}>
                                <span
                                  className={`inline-block w-6 h-6 rounded-full text-xs flex items-center justify-center ${
                                    step.status === 'APPROVED'
                                      ? 'bg-green-100 text-green-600'
                                      : step.status === 'REJECTED'
                                      ? 'bg-red-100 text-red-600'
                                      : approval.current_step === step.order
                                      ? 'bg-blue-100 text-blue-600'
                                      : 'bg-gray-100 text-gray-400'
                                  }`}
                                >
                                  {step.order}
                                </span>
                                {idx < approval.approval_line.length - 1 && (
                                  <span className="text-gray-300 mx-1">→</span>
                                )}
                              </span>
                            ))}
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant={statusMap[approval.final_status]?.variant}>
                            {statusMap[approval.final_status]?.label}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          {new Date(approval.created_at).toLocaleDateString('ko-KR')}
                        </TableCell>
                        <TableCell>
                          <div className="flex justify-end gap-2">
                            {approval.final_status === 'PENDING' && (
                              <>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  className="text-green-600"
                                  onClick={() => openProcessDialog(approval)}
                                >
                                  <Check className="h-4 w-4" />
                                </Button>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  className="text-red-600"
                                  onClick={() => openProcessDialog(approval)}
                                >
                                  <X className="h-4 w-4" />
                                </Button>
                              </>
                            )}
                            <Button size="sm" variant="ghost">
                              <Eye className="h-4 w-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>

            {totalPages > 1 && (
              <div className="mt-6">
                <Pagination
                  currentPage={currentPage}
                  totalPages={totalPages}
                  onPageChange={setCurrentPage}
                />
              </div>
            )}
          </>
        )}
      </div>

      {/* Process Dialog */}
      <Dialog open={showProcessDialog} onOpenChange={setShowProcessDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>승인 처리</DialogTitle>
          </DialogHeader>

          {selectedApproval && (
            <div className="space-y-4">
              <Card>
                <CardContent className="pt-4">
                  <div className="space-y-2">
                    <div>
                      <span className="text-sm text-gray-500">요청자:</span>{' '}
                      <span className="font-medium">{selectedApproval.requester_name}</span>
                    </div>
                    <div>
                      <span className="text-sm text-gray-500">유형:</span>{' '}
                      <span className="font-medium">
                        {typeLabels[selectedApproval.type]?.label}
                      </span>
                    </div>
                    <div>
                      <span className="text-sm text-gray-500">내용:</span>{' '}
                      <span className="font-medium">
                        {formatDetails(selectedApproval.type, selectedApproval.details)}
                      </span>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <div>
                <Label>코멘트</Label>
                <Textarea
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                  placeholder="승인/거부 사유를 입력하세요 (선택)"
                  className="mt-1"
                />
              </div>
            </div>
          )}

          <DialogFooter className="mt-6">
            <Button variant="outline" onClick={() => setShowProcessDialog(false)}>
              취소
            </Button>
            <Button
              variant="destructive"
              onClick={() => handleProcess('REJECTED')}
              disabled={processing}
            >
              <X className="h-4 w-4 mr-2" />
              거부
            </Button>
            <Button onClick={() => handleProcess('APPROVED')} disabled={processing}>
              <Check className="h-4 w-4 mr-2" />
              승인
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
