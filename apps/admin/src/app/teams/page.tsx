'use client';

import { useState, useEffect, Suspense } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useSearchParams } from 'next/navigation';
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
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  Input,
  Label,
  Alert,
  Card,
  CardContent,
} from '@/components/ui';
import {
  Users,
  Plus,
  Edit,
  Trash2,
  UserPlus,
  Crown,
  User,
  Building2,
  ChevronRight,
  Search,
  ClipboardList,
} from 'lucide-react';
import { createClient } from '@/lib/supabase/client';

interface Team {
  id: string;
  name: string;
  description?: string;
  team_type: string;
  store_id: string;
  company_id: string;
  display_order: number;
  is_active: boolean;
  created_at: string;
  stores?: { id: string; name: string };
  members?: TeamMember[];
  _count?: { members: number };
}

interface TeamMemberUser {
  id: string;
  name: string;
  email: string;
  role: string;
  profile_image_url?: string;
}

interface TeamMember {
  id: string;
  user_id: string;
  team_role: 'leader' | 'member';
  is_primary_team: boolean;
  joined_at: string;
  users?: TeamMemberUser;
}

interface Store {
  id: string;
  name: string;
  company_id: string;
}

interface Employee {
  id: string;
  name: string;
  email: string;
  role: string;
  profile_image_url?: string;
}

const TEAM_TYPES = [
  { value: 'barista', label: '바리스타팀' },
  { value: 'kitchen', label: '주방팀' },
  { value: 'hall', label: '홀팀' },
  { value: 'production', label: '생산팀' },
  { value: 'quality', label: '품질관리팀' },
  { value: 'warehouse', label: '창고팀' },
  { value: 'delivery', label: '배송팀' },
  { value: 'cleaning', label: '청소팀' },
  { value: 'other', label: '기타' },
];

const getTeamTypeLabel = (type: string) => {
  return TEAM_TYPES.find((t) => t.value === type)?.label || type;
};

// API fetchers
const fetchStores = async (): Promise<Store[]> => {
  const res = await fetch('/api/stores');
  if (!res.ok) throw new Error('Failed to fetch stores');
  return res.json();
};

const fetchTeams = async (storeId?: string): Promise<Team[]> => {
  const params = new URLSearchParams();
  if (storeId) params.set('store_id', storeId);
  params.set('include_members', 'true');
  const res = await fetch(`/api/teams?${params}`);
  if (!res.ok) throw new Error('Failed to fetch teams');
  return res.json();
};

const fetchEmployees = async (storeId?: string): Promise<Employee[]> => {
  const params = new URLSearchParams();
  if (storeId) params.set('storeId', storeId);
  params.set('status', 'ACTIVE');
  const res = await fetch(`/api/employees?${params}`);
  if (!res.ok) throw new Error('Failed to fetch employees');
  const data = await res.json();
  return data.users || [];
};

function TeamsPageContent() {
  const queryClient = useQueryClient();
  const searchParams = useSearchParams();
  const initialStoreId = searchParams.get('storeId') || '';
  const [storeFilter, setStoreFilter] = useState(initialStoreId);
  const [error, setError] = useState('');
  const [searchTerm, setSearchTerm] = useState('');

  // Dialog states
  const [showNewDialog, setShowNewDialog] = useState(false);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [showMembersDialog, setShowMembersDialog] = useState(false);
  const [selectedTeam, setSelectedTeam] = useState<Team | null>(null);

  // Form states
  const [newTeam, setNewTeam] = useState({
    name: '',
    description: '',
    team_type: 'other',
    store_id: '',
  });

  const [editForm, setEditForm] = useState({
    name: '',
    description: '',
    team_type: 'other',
    display_order: 0,
  });

  // Queries
  const { data: stores = [] } = useQuery({
    queryKey: ['stores'],
    queryFn: fetchStores,
    staleTime: 30 * 1000,
  });

  const { data: teams = [], isLoading: teamsLoading } = useQuery({
    queryKey: ['teams', storeFilter],
    queryFn: () => fetchTeams(storeFilter),
    staleTime: 30 * 1000,
  });

  const { data: employees = [] } = useQuery({
    queryKey: ['employees', storeFilter],
    queryFn: () => fetchEmployees(storeFilter),
    staleTime: 30 * 1000,
    enabled: !!storeFilter,
  });

  // Mutations
  const createMutation = useMutation({
    mutationFn: async (data: typeof newTeam) => {
      const res = await fetch('/api/teams', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || '팀 생성에 실패했습니다.');
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['teams'] });
      setShowNewDialog(false);
      setNewTeam({ name: '', description: '', team_type: 'other', store_id: '' });
      setError('');
    },
    onError: (err: Error) => {
      setError(err.message);
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: typeof editForm }) => {
      const res = await fetch(`/api/teams/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || '수정에 실패했습니다.');
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['teams'] });
      setShowEditDialog(false);
      setSelectedTeam(null);
      setError('');
    },
    onError: (err: Error) => {
      setError(err.message);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/teams/${id}`, { method: 'DELETE' });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || '삭제에 실패했습니다.');
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['teams'] });
    },
    onError: (err: Error) => {
      alert(err.message);
    },
  });

  const addMemberMutation = useMutation({
    mutationFn: async ({
      teamId,
      userId,
      teamRole,
    }: {
      teamId: string;
      userId: string;
      teamRole: 'leader' | 'member';
    }) => {
      const res = await fetch(`/api/teams/${teamId}/members`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: userId, team_role: teamRole }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || '팀원 추가에 실패했습니다.');
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['teams'] });
    },
    onError: (err: Error) => {
      alert(err.message);
    },
  });

  const updateMemberMutation = useMutation({
    mutationFn: async ({
      teamId,
      memberId,
      teamRole,
    }: {
      teamId: string;
      memberId: string;
      teamRole: 'leader' | 'member';
    }) => {
      const res = await fetch(`/api/teams/${teamId}/members`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ member_id: memberId, team_role: teamRole }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || '역할 변경에 실패했습니다.');
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['teams'] });
    },
    onError: (err: Error) => {
      alert(err.message);
    },
  });

  const removeMemberMutation = useMutation({
    mutationFn: async ({ teamId, memberId }: { teamId: string; memberId: string }) => {
      const res = await fetch(`/api/teams/${teamId}/members?member_id=${memberId}`, {
        method: 'DELETE',
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || '팀원 삭제에 실패했습니다.');
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['teams'] });
    },
    onError: (err: Error) => {
      alert(err.message);
    },
  });

  // Handlers
  const handleCreateTeam = () => {
    if (!newTeam.name.trim()) {
      setError('팀 이름을 입력해주세요');
      return;
    }
    if (!newTeam.store_id) {
      setError('매장을 선택해주세요');
      return;
    }
    setError('');
    createMutation.mutate(newTeam);
  };

  const handleUpdateTeam = () => {
    if (!selectedTeam) return;
    if (!editForm.name.trim()) {
      setError('팀 이름을 입력해주세요');
      return;
    }
    setError('');
    updateMutation.mutate({ id: selectedTeam.id, data: editForm });
  };

  const handleDeleteTeam = (id: string) => {
    if (!confirm('정말 삭제하시겠습니까?\n팀원 정보도 함께 삭제됩니다.')) return;
    deleteMutation.mutate(id);
  };

  const openEditDialog = (team: Team) => {
    setSelectedTeam(team);
    setEditForm({
      name: team.name,
      description: team.description || '',
      team_type: team.team_type,
      display_order: team.display_order || 0,
    });
    setError('');
    setShowEditDialog(true);
  };

  const openMembersDialog = (team: Team) => {
    setSelectedTeam(team);
    setShowMembersDialog(true);
  };

  // Get available employees (not already in the selected team)
  const getAvailableEmployees = () => {
    if (!selectedTeam) return employees;
    const memberIds = selectedTeam.members?.map((m) => m.user_id) || [];
    return employees.filter((e) => !memberIds.includes(e.id));
  };

  // Filter teams by search term
  const filteredTeams = teams.filter(
    (team) =>
      team.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      getTeamTypeLabel(team.team_type).toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Stats
  const totalTeams = teams.length;
  const totalMembers = teams.reduce((acc, team) => acc + (team.members?.length || 0), 0);
  const teamLeaders = teams.reduce(
    (acc, team) => acc + (team.members?.filter((m) => m.team_role === 'leader').length || 0),
    0
  );

  return (
    <div>
      <Header title="팀 관리" />

      <div className="p-6">
        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-6">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-500">전체 팀</p>
                  <p className="text-2xl font-bold">{totalTeams}</p>
                </div>
                <div className="p-3 bg-blue-100 rounded-full">
                  <Users className="h-6 w-6 text-blue-600" />
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-500">총 팀원</p>
                  <p className="text-2xl font-bold">{totalMembers}</p>
                </div>
                <div className="p-3 bg-green-100 rounded-full">
                  <User className="h-6 w-6 text-green-600" />
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-500">팀장</p>
                  <p className="text-2xl font-bold">{teamLeaders}</p>
                </div>
                <div className="p-3 bg-yellow-100 rounded-full">
                  <Crown className="h-6 w-6 text-yellow-600" />
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-500">매장</p>
                  <p className="text-2xl font-bold">{stores.length}</p>
                </div>
                <div className="p-3 bg-purple-100 rounded-full">
                  <Building2 className="h-6 w-6 text-purple-600" />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Toolbar */}
        <div className="mb-6 flex flex-col sm:flex-row gap-4 justify-between">
          <div className="flex gap-4 flex-wrap">
            <Select
              value={storeFilter}
              onChange={(e) => setStoreFilter(e.target.value)}
              options={[
                { value: '', label: '전체 매장' },
                ...stores.map((s) => ({ value: s.id, label: s.name })),
              ]}
              className="w-40"
            />
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <Input
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="팀 검색..."
                className="pl-9 w-48"
              />
            </div>
          </div>
          <Button onClick={() => setShowNewDialog(true)} disabled={stores.length === 0}>
            <Plus className="h-4 w-4 mr-2" />
            팀 등록
          </Button>
        </div>

        {stores.length === 0 && !teamsLoading && (
          <Alert variant="info" className="mb-6">
            팀을 등록하려면 먼저 매장을 등록해야 합니다.
          </Alert>
        )}

        {teamsLoading ? (
          <PageLoading />
        ) : filteredTeams.length === 0 ? (
          <EmptyState
            icon={Users}
            title="팀이 없습니다"
            description={
              stores.length === 0
                ? '먼저 매장을 등록해주세요.'
                : searchTerm
                ? '검색 결과가 없습니다.'
                : '새로운 팀을 등록해보세요.'
            }
            action={
              <Button onClick={() => setShowNewDialog(true)} disabled={stores.length === 0}>
                <Plus className="h-4 w-4 mr-2" />
                팀 등록
              </Button>
            }
          />
        ) : (
          <div className="bg-white rounded-lg border border-gray-200">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>팀명</TableHead>
                  <TableHead>유형</TableHead>
                  <TableHead>매장</TableHead>
                  <TableHead>팀장</TableHead>
                  <TableHead>팀원 수</TableHead>
                  <TableHead>등록일</TableHead>
                  <TableHead className="text-right">액션</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredTeams.map((team) => {
                  const leader = team.members?.find((m) => m.team_role === 'leader');
                  const memberCount = team.members?.length || 0;

                  return (
                    <TableRow key={team.id}>
                      <TableCell className="font-medium">{team.name}</TableCell>
                      <TableCell>
                        <Badge variant="secondary">{getTeamTypeLabel(team.team_type)}</Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center text-sm">
                          <Building2 className="h-4 w-4 mr-1 text-gray-400" />
                          {team.stores?.name || '-'}
                        </div>
                      </TableCell>
                      <TableCell>
                        {leader ? (
                          <div className="flex items-center gap-2">
                            <Crown className="h-4 w-4 text-yellow-500" />
                            <span>{leader.users?.name || '-'}</span>
                          </div>
                        ) : (
                          <span className="text-gray-400">미지정</span>
                        )}
                      </TableCell>
                      <TableCell>{memberCount}명</TableCell>
                      <TableCell>
                        {new Date(team.created_at).toLocaleDateString('ko-KR')}
                      </TableCell>
                      <TableCell>
                        <div className="flex justify-end gap-2">
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => openMembersDialog(team)}
                            title="팀원 관리"
                          >
                            <UserPlus className="h-4 w-4" />
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => openEditDialog(team)}
                            title="팀 수정"
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => handleDeleteTeam(team.id)}
                            disabled={deleteMutation.isPending}
                            title="팀 삭제"
                          >
                            <Trash2 className="h-4 w-4 text-red-500" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        )}
      </div>

      {/* New Team Dialog */}
      <Dialog open={showNewDialog} onOpenChange={setShowNewDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>팀 등록</DialogTitle>
          </DialogHeader>

          {error && (
            <Alert variant="error" className="mb-4">
              {error}
            </Alert>
          )}

          <div className="space-y-4">
            <div>
              <Label required>매장</Label>
              <Select
                value={newTeam.store_id}
                onChange={(e) => setNewTeam({ ...newTeam, store_id: e.target.value })}
                options={[
                  { value: '', label: '매장을 선택해주세요' },
                  ...stores.map((s) => ({ value: s.id, label: s.name })),
                ]}
                className="mt-1"
              />
            </div>
            <div>
              <Label required>팀 이름</Label>
              <Input
                value={newTeam.name}
                onChange={(e) => setNewTeam({ ...newTeam, name: e.target.value })}
                placeholder="예: 바리스타팀"
                className="mt-1"
              />
            </div>
            <div>
              <Label>팀 유형</Label>
              <Select
                value={newTeam.team_type}
                onChange={(e) => setNewTeam({ ...newTeam, team_type: e.target.value })}
                options={TEAM_TYPES}
                className="mt-1"
              />
            </div>
            <div>
              <Label>설명</Label>
              <Input
                value={newTeam.description}
                onChange={(e) => setNewTeam({ ...newTeam, description: e.target.value })}
                placeholder="팀에 대한 설명 (선택)"
                className="mt-1"
              />
            </div>
          </div>

          <DialogFooter className="mt-6">
            <Button variant="outline" onClick={() => setShowNewDialog(false)}>
              취소
            </Button>
            <Button
              onClick={handleCreateTeam}
              disabled={createMutation.isPending || !newTeam.name || !newTeam.store_id}
            >
              {createMutation.isPending ? '등록 중...' : '등록'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Team Dialog */}
      <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>팀 수정</DialogTitle>
          </DialogHeader>

          {error && (
            <Alert variant="error" className="mb-4">
              {error}
            </Alert>
          )}

          <div className="space-y-4">
            <div>
              <Label required>팀 이름</Label>
              <Input
                value={editForm.name}
                onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                placeholder="예: 바리스타팀"
                className="mt-1"
              />
            </div>
            <div>
              <Label>팀 유형</Label>
              <Select
                value={editForm.team_type}
                onChange={(e) => setEditForm({ ...editForm, team_type: e.target.value })}
                options={TEAM_TYPES}
                className="mt-1"
              />
            </div>
            <div>
              <Label>설명</Label>
              <Input
                value={editForm.description}
                onChange={(e) => setEditForm({ ...editForm, description: e.target.value })}
                placeholder="팀에 대한 설명 (선택)"
                className="mt-1"
              />
            </div>
            <div>
              <Label>표시 순서</Label>
              <Input
                type="number"
                value={editForm.display_order}
                onChange={(e) =>
                  setEditForm({ ...editForm, display_order: parseInt(e.target.value) || 0 })
                }
                className="mt-1"
              />
            </div>
          </div>

          <DialogFooter className="mt-6">
            <Button variant="outline" onClick={() => setShowEditDialog(false)}>
              취소
            </Button>
            <Button
              onClick={handleUpdateTeam}
              disabled={updateMutation.isPending || !editForm.name}
            >
              {updateMutation.isPending ? '저장 중...' : '저장'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Team Members Dialog */}
      <Dialog open={showMembersDialog} onOpenChange={setShowMembersDialog}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>
              {selectedTeam?.name} - 팀원 관리
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-6">
            {/* Current Members */}
            <div>
              <h4 className="font-medium text-gray-900 mb-3">
                현재 팀원 ({selectedTeam?.members?.length || 0}명)
              </h4>
              {selectedTeam?.members && selectedTeam.members.length > 0 ? (
                <div className="space-y-2">
                  {selectedTeam.members.map((member) => (
                    <div
                      key={member.id}
                      className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-gray-200 rounded-full flex items-center justify-center">
                          {member.users?.profile_image_url ? (
                            <img
                              src={member.users.profile_image_url}
                              alt=""
                              className="w-10 h-10 rounded-full object-cover"
                            />
                          ) : (
                            <User className="w-5 h-5 text-gray-500" />
                          )}
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-medium">{member.users?.name || '-'}</span>
                            {member.team_role === 'leader' && (
                              <Badge variant="warning" className="text-xs">
                                <Crown className="w-3 h-3 mr-1" />
                                팀장
                              </Badge>
                            )}
                          </div>
                          <p className="text-sm text-gray-500">{member.users?.email}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {member.team_role === 'member' ? (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() =>
                              updateMemberMutation.mutate({
                                teamId: selectedTeam.id,
                                memberId: member.id,
                                teamRole: 'leader',
                              })
                            }
                            disabled={updateMemberMutation.isPending}
                          >
                            <Crown className="w-4 h-4 mr-1" />
                            팀장 지정
                          </Button>
                        ) : (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() =>
                              updateMemberMutation.mutate({
                                teamId: selectedTeam.id,
                                memberId: member.id,
                                teamRole: 'member',
                              })
                            }
                            disabled={updateMemberMutation.isPending}
                          >
                            팀원으로 변경
                          </Button>
                        )}
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => {
                            if (confirm('이 팀원을 팀에서 제거하시겠습니까?')) {
                              removeMemberMutation.mutate({
                                teamId: selectedTeam.id,
                                memberId: member.id,
                              });
                            }
                          }}
                          disabled={removeMemberMutation.isPending}
                        >
                          <Trash2 className="w-4 h-4 text-red-500" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-6 text-gray-500">
                  아직 팀원이 없습니다.
                </div>
              )}
            </div>

            {/* Add Member */}
            <div className="border-t pt-6">
              <h4 className="font-medium text-gray-900 mb-3">팀원 추가</h4>
              {storeFilter ? (
                getAvailableEmployees().length > 0 ? (
                  <div className="space-y-2 max-h-60 overflow-y-auto">
                    {getAvailableEmployees().map((employee) => (
                      <div
                        key={employee.id}
                        className="flex items-center justify-between p-3 border rounded-lg hover:bg-gray-50"
                      >
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 bg-gray-200 rounded-full flex items-center justify-center">
                            {employee.profile_image_url ? (
                              <img
                                src={employee.profile_image_url}
                                alt=""
                                className="w-10 h-10 rounded-full object-cover"
                              />
                            ) : (
                              <User className="w-5 h-5 text-gray-500" />
                            )}
                          </div>
                          <div>
                            <span className="font-medium">{employee.name}</span>
                            <p className="text-sm text-gray-500">{employee.email}</p>
                          </div>
                        </div>
                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() =>
                              addMemberMutation.mutate({
                                teamId: selectedTeam!.id,
                                userId: employee.id,
                                teamRole: 'member',
                              })
                            }
                            disabled={addMemberMutation.isPending}
                          >
                            팀원 추가
                          </Button>
                          <Button
                            size="sm"
                            onClick={() =>
                              addMemberMutation.mutate({
                                teamId: selectedTeam!.id,
                                userId: employee.id,
                                teamRole: 'leader',
                              })
                            }
                            disabled={addMemberMutation.isPending}
                          >
                            <Crown className="w-4 h-4 mr-1" />
                            팀장 추가
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-6 text-gray-500">
                    추가할 수 있는 직원이 없습니다.
                  </div>
                )
              ) : (
                <Alert variant="info">
                  팀원을 추가하려면 상단에서 매장을 선택해주세요.
                </Alert>
              )}
            </div>
          </div>

          <DialogFooter className="mt-6">
            <Button variant="outline" onClick={() => setShowMembersDialog(false)}>
              닫기
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default function TeamsPage() {
  return (
    <Suspense fallback={<PageLoading />}>
      <TeamsPageContent />
    </Suspense>
  );
}
