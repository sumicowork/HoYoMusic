import React, { useEffect, useMemo, useState } from 'react';
import { Button, Card, Descriptions, Form, Input, Modal, Popconfirm, Select, Space, Statistic, Table, Tabs, Tag, Typography, message } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import AdminLayout from '../components/AdminLayout';
import { useAuthStore } from '../store/authStore';
import {
  userService,
  type AdminUserItem,
  type UserInsightBehaviorItem,
  type UserFullProfileResponse,
  type UserInsightsResponse,
  type UserListFilters,
} from '../services/userService';
import { messageService } from '../services/messageService';

const { Title } = Typography;

const UserManagement: React.FC = () => {
  const { user: currentUser } = useAuthStore();
  const [loading, setLoading] = useState(false);
  const [items, setItems] = useState<AdminUserItem[]>([]);
  const [pagination, setPagination] = useState({ page: 1, pageSize: 20, total: 0 });
  const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([]);
  const [filters, setFilters] = useState<UserListFilters>({
    keyword: '',
    role: 'all',
    verified: 'all',
    status: 'all',
  });
  const [passwordModalOpen, setPasswordModalOpen] = useState(false);
  const [targetUser, setTargetUser] = useState<AdminUserItem | null>(null);
  const [passwordSubmitting, setPasswordSubmitting] = useState(false);
  const [passwordForm] = Form.useForm<{ newPassword: string; confirmPassword: string }>();
  const [insightsModalOpen, setInsightsModalOpen] = useState(false);
  const [insightsLoading, setInsightsLoading] = useState(false);
  const [insightsDays, setInsightsDays] = useState(30);
  const [userInsights, setUserInsights] = useState<UserInsightsResponse | null>(null);
  const [userFullProfile, setUserFullProfile] = useState<UserFullProfileResponse | null>(null);
  const [siteMessageModalOpen, setSiteMessageModalOpen] = useState(false);
  const [siteMessageSubmitting, setSiteMessageSubmitting] = useState(false);
  const [messageForm] = Form.useForm<{ title: string; content: string; scope: 'broadcast' | 'selected'; recipient_user_ids: number[] }>();

  const loadUsers = async (
    page = pagination.page,
    pageSize = pagination.pageSize,
    nextFilters: UserListFilters = filters
  ) => {
    setLoading(true);
    try {
      const data = await userService.getUsers(page, pageSize, nextFilters);
      setItems(data.items);
      setPagination({ page: data.pagination.page, pageSize: data.pagination.pageSize, total: data.pagination.total });
    } catch (error: any) {
      message.error(error?.message || '加载用户列表失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadUsers();
  }, []);

  const selectedUserCount = selectedRowKeys.length;
  const selectedUsers = useMemo(() => {
    const selected = new Set(selectedRowKeys.map((key) => Number(key)));
    return items.filter((item) => selected.has(item.id));
  }, [items, selectedRowKeys]);

  const updateLocalUser = (updated: AdminUserItem) => {
    setItems((prev) => prev.map((item) => (item.id === updated.id ? updated : item)));
  };

  const handleRoleChange = async (record: AdminUserItem, isAdmin: boolean) => {
    try {
      const updated = await userService.updateRole(record.id, isAdmin);
      updateLocalUser(updated);
      message.success(`用户 ${record.username} 权限已更新`);
    } catch (error: any) {
      message.error(error?.message || '更新用户权限失败');
    }
  };

  const handleEmailVerificationChange = async (record: AdminUserItem, emailVerified: boolean) => {
    try {
      const updated = await userService.updateEmailVerification(record.id, emailVerified);
      updateLocalUser(updated);
      message.success(`用户 ${record.username} 邮箱状态已更新`);
    } catch (error: any) {
      message.error(error?.message || '更新邮箱状态失败');
    }
  };

  const handleStatusChange = async (record: AdminUserItem, nextStatus: 'active' | 'disabled') => {
    let reason = '';
    if (nextStatus === 'disabled') {
      reason = window.prompt(`请输入停用原因（可选），用户：${record.username}`)?.trim() || '';
    }

    try {
      const updated = await userService.updateStatus(record.id, nextStatus, reason);
      updateLocalUser(updated);
      message.success(`用户 ${record.username} 状态已更新`);
    } catch (error: any) {
      message.error(error?.message || '更新账号状态失败');
    }
  };

  const handleBulkStatusChange = async (nextStatus: 'active' | 'disabled') => {
    if (selectedUsers.length === 0) {
      return;
    }

    const reason = nextStatus === 'disabled'
      ? (window.prompt('请输入批量停用原因（可选）')?.trim() || '')
      : '';

    setLoading(true);
    try {
      await Promise.all(selectedUsers.map((item) => userService.updateStatus(item.id, nextStatus, reason)));
      message.success(`已批量${nextStatus === 'disabled' ? '停用' : '启用'} ${selectedUsers.length} 位用户`);
      setSelectedRowKeys([]);
      await loadUsers(pagination.page, pagination.pageSize);
    } catch (error: any) {
      message.error(error?.message || '批量操作失败');
    } finally {
      setLoading(false);
    }
  };

  const openResetPasswordModal = (record: AdminUserItem) => {
    setTargetUser(record);
    setPasswordModalOpen(true);
    passwordForm.resetFields();
  };

  const handleResetPassword = async () => {
    if (!targetUser) return;

    try {
      const values = await passwordForm.validateFields();
      setPasswordSubmitting(true);
      await userService.resetPassword(targetUser.id, values.newPassword);
      message.success(`已重置用户 ${targetUser.username} 的密码`);
      setPasswordModalOpen(false);
      setTargetUser(null);
      passwordForm.resetFields();
    } catch (error: any) {
      if (error?.errorFields) {
        return;
      }
      message.error(error?.message || '重置密码失败');
    } finally {
      setPasswordSubmitting(false);
    }
  };

  const openUserInsights = async (record: AdminUserItem) => {
    setTargetUser(record);
    setInsightsModalOpen(true);
    setInsightsLoading(true);
    try {
      const [insightData, profileData] = await Promise.all([
        userService.getUserInsights(record.id, insightsDays),
        userService.getUserFullProfile(record.id),
      ]);
      setUserInsights(insightData);
      setUserFullProfile(profileData);
    } catch (error: any) {
      message.error(error?.message || '加载用户分析失败');
      setUserInsights(null);
      setUserFullProfile(null);
    } finally {
      setInsightsLoading(false);
    }
  };

  const reloadInsights = async (days: number) => {
    if (!targetUser) {
      return;
    }
    setInsightsLoading(true);
    try {
      const [insightData, profileData] = await Promise.all([
        userService.getUserInsights(targetUser.id, days),
        userService.getUserFullProfile(targetUser.id),
      ]);
      setUserInsights(insightData);
      setUserFullProfile(profileData);
    } catch (error: any) {
      message.error(error?.message || '刷新用户分析失败');
    } finally {
      setInsightsLoading(false);
    }
  };

  const openSiteMessageModal = (initialRecipientIds?: number[]) => {
    const selectedIds = initialRecipientIds && initialRecipientIds.length > 0
      ? initialRecipientIds
      : selectedUsers.map((item) => item.id);

    setSiteMessageModalOpen(true);
    messageForm.setFieldsValue({
      title: '',
      content: '',
      scope: selectedIds.length > 0 ? 'selected' : 'broadcast',
      recipient_user_ids: selectedIds,
    });
  };

  const handleSendSiteMessage = async () => {
    try {
      const values = await messageForm.validateFields();
      const isBroadcast = values.scope === 'broadcast';
      setSiteMessageSubmitting(true);
      const result = await messageService.sendByAdmin({
        title: values.title,
        content: values.content,
        is_broadcast: isBroadcast,
        recipient_user_ids: isBroadcast ? [] : values.recipient_user_ids,
      });

      message.success(`站内信发送成功，投递 ${result.delivery_count} 人`);
      setSiteMessageModalOpen(false);
      messageForm.resetFields();
    } catch (error: any) {
      if (error?.errorFields) {
        return;
      }
      message.error(error?.message || '发送站内信失败');
    } finally {
      setSiteMessageSubmitting(false);
    }
  };

  const applyFilters = () => {
    setSelectedRowKeys([]);
    void loadUsers(1, pagination.pageSize, filters);
  };

  const resetFilters = () => {
    const nextFilters: UserListFilters = { keyword: '', role: 'all', verified: 'all', status: 'all' };
    setFilters(nextFilters);
    setSelectedRowKeys([]);
    void loadUsers(1, pagination.pageSize, nextFilters);
  };

  const columns: ColumnsType<AdminUserItem> = [
    {
      title: 'ID',
      dataIndex: 'id',
      key: 'id',
      width: 90,
    },
    {
      title: '用户名',
      dataIndex: 'username',
      key: 'username',
      width: 180,
    },
    {
      title: '邮箱',
      dataIndex: 'email',
      key: 'email',
      render: (value: string | null) => value || '—',
    },
    {
      title: '邮箱状态',
      dataIndex: 'email_verified',
      key: 'email_verified',
      width: 120,
      render: (value: boolean) => (value ? <Tag color="green">已验证</Tag> : <Tag color="orange">未验证</Tag>),
    },
    {
      title: '账号状态',
      dataIndex: 'account_status',
      key: 'account_status',
      width: 120,
      render: (value: 'active' | 'disabled', record) => (
        value === 'active'
          ? <Tag color="green">正常</Tag>
          : <Tag color="red" title={record.status_reason || ''}>停用</Tag>
      ),
    },
    {
      title: '角色',
      dataIndex: 'is_admin',
      key: 'is_admin',
      width: 120,
      render: (value: boolean) => (value ? <Tag color="blue">管理员</Tag> : <Tag>普通用户</Tag>),
    },
    {
      title: '最近登录',
      dataIndex: 'last_login_at',
      key: 'last_login_at',
      width: 180,
      render: (value: string | null) => (value ? new Date(value).toLocaleString('zh-CN') : '从未登录'),
    },
    {
      title: '注册时间',
      dataIndex: 'created_at',
      key: 'created_at',
      width: 180,
      render: (value: string) => new Date(value).toLocaleString('zh-CN'),
    },
    {
      title: '操作',
      key: 'actions',
      width: 320,
      render: (_, record) => {
        const disableRoleChange = currentUser?.id === record.id;
        const disableStatusChange = currentUser?.id === record.id;

        return (
          <Space size={4} wrap>
            <Popconfirm
              title={record.is_admin ? '确认取消管理员权限？' : '确认设为管理员？'}
              onConfirm={() => void handleRoleChange(record, !record.is_admin)}
              disabled={disableRoleChange}
            >
              <Button size="small" disabled={disableRoleChange}>
                {record.is_admin ? '取消管理' : '设为管理'}
              </Button>
            </Popconfirm>

            <Popconfirm
              title={record.account_status === 'active' ? '确认停用该账号？' : '确认启用该账号？'}
              onConfirm={() => void handleStatusChange(record, record.account_status === 'active' ? 'disabled' : 'active')}
              disabled={disableStatusChange}
            >
              <Button size="small" danger={record.account_status === 'active'} disabled={disableStatusChange}>
                {record.account_status === 'active' ? '停用' : '启用'}
              </Button>
            </Popconfirm>

            <Button
              size="small"
              onClick={() => void handleEmailVerificationChange(record, !record.email_verified)}
            >
              {record.email_verified ? '设未验证' : '设已验证'}
            </Button>

            <Button size="small" onClick={() => openResetPasswordModal(record)}>
              重置密码
            </Button>

            <Button size="small" onClick={() => void openUserInsights(record)}>
              行为分析
            </Button>

            <Button size="small" onClick={() => openSiteMessageModal([record.id])}>
              发站内信
            </Button>
          </Space>
        );
      },
    },
  ];

  return (
    <AdminLayout>
      <div style={{ padding: 24 }}>
        <Card
          title={<Title level={4} style={{ margin: 0 }}>用户管理</Title>}
          extra={<Button onClick={() => void loadUsers(1, pagination.pageSize)} loading={loading}>刷新</Button>}
        >
          <Space direction="vertical" size={12} style={{ width: '100%', marginBottom: 16 }}>
            <Space wrap>
              <Input
                allowClear
                placeholder="搜索用户名或邮箱"
                style={{ width: 260 }}
                value={filters.keyword}
                onChange={(event) => setFilters((prev) => ({ ...prev, keyword: event.target.value }))}
                onPressEnter={applyFilters}
              />
              <Select
                value={filters.role}
                style={{ width: 130 }}
                onChange={(value) => setFilters((prev) => ({ ...prev, role: value }))}
                options={[
                  { label: '全部角色', value: 'all' },
                  { label: '管理员', value: 'admin' },
                  { label: '普通用户', value: 'user' },
                ]}
              />
              <Select
                value={filters.verified}
                style={{ width: 140 }}
                onChange={(value) => setFilters((prev) => ({ ...prev, verified: value }))}
                options={[
                  { label: '全部邮箱状态', value: 'all' },
                  { label: '已验证', value: 'verified' },
                  { label: '未验证', value: 'unverified' },
                ]}
              />
              <Select
                value={filters.status}
                style={{ width: 140 }}
                onChange={(value) => setFilters((prev) => ({ ...prev, status: value }))}
                options={[
                  { label: '全部账号状态', value: 'all' },
                  { label: '正常', value: 'active' },
                  { label: '停用', value: 'disabled' },
                ]}
              />
              <Button type="primary" onClick={applyFilters} loading={loading}>筛选</Button>
              <Button onClick={resetFilters} disabled={loading}>重置</Button>
            </Space>

            <Space wrap>
              <Popconfirm
                title={`确认批量启用 ${selectedUserCount} 位用户？`}
                onConfirm={() => void handleBulkStatusChange('active')}
                disabled={selectedUserCount === 0}
              >
                <Button disabled={selectedUserCount === 0 || loading}>批量启用</Button>
              </Popconfirm>
              <Popconfirm
                title={`确认批量停用 ${selectedUserCount} 位用户？`}
                onConfirm={() => void handleBulkStatusChange('disabled')}
                disabled={selectedUserCount === 0}
              >
                <Button danger disabled={selectedUserCount === 0 || loading}>批量停用</Button>
              </Popconfirm>
              <Button
                type="primary"
                onClick={() => openSiteMessageModal()}
                disabled={loading}
              >
                发送站内信
              </Button>
              <Typography.Text type="secondary">已选 {selectedUserCount} 位用户</Typography.Text>
            </Space>
          </Space>

          <Table
            rowKey="id"
            loading={loading}
            columns={columns}
            dataSource={items}
            rowSelection={{
              selectedRowKeys,
              onChange: (nextSelectedRowKeys) => setSelectedRowKeys(nextSelectedRowKeys),
            }}
            pagination={{
              current: pagination.page,
              pageSize: pagination.pageSize,
              total: pagination.total,
              showSizeChanger: true,
              pageSizeOptions: ['10', '20', '50', '100'],
              showTotal: (total) => `共 ${total} 位用户`,
            }}
            onChange={(nextPagination) => {
              void loadUsers(nextPagination.current || 1, nextPagination.pageSize || pagination.pageSize);
            }}
          />
        </Card>
      </div>

      <Modal
        title={targetUser ? `重置密码 - ${targetUser.username}` : '重置密码'}
        open={passwordModalOpen}
        onCancel={() => {
          setPasswordModalOpen(false);
          setTargetUser(null);
          passwordForm.resetFields();
        }}
        onOk={() => void handleResetPassword()}
        okButtonProps={{ loading: passwordSubmitting }}
      >
        <Form form={passwordForm} layout="vertical">
          <Form.Item
            name="newPassword"
            label="新密码"
            rules={[
              { required: true, message: '请输入新密码' },
              { min: 6, message: '密码至少 6 位' },
            ]}
          >
            <Input.Password autoComplete="new-password" />
          </Form.Item>
          <Form.Item
            name="confirmPassword"
            label="确认新密码"
            dependencies={['newPassword']}
            rules={[
              { required: true, message: '请再次输入新密码' },
              ({ getFieldValue }) => ({
                validator(_, value) {
                  if (!value || getFieldValue('newPassword') === value) {
                    return Promise.resolve();
                  }
                  return Promise.reject(new Error('两次输入的密码不一致'));
                },
              }),
            ]}
          >
            <Input.Password autoComplete="new-password" />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title={targetUser ? `用户行为分析 - ${targetUser.username}` : '用户行为分析'}
        open={insightsModalOpen}
        onCancel={() => {
          setInsightsModalOpen(false);
          setUserInsights(null);
          setUserFullProfile(null);
        }}
        footer={<Button onClick={() => setInsightsModalOpen(false)}>关闭</Button>}
        width={980}
      >
        <Space style={{ marginBottom: 12 }}>
          <Select
            value={insightsDays}
            style={{ width: 140 }}
            onChange={(value) => {
              setInsightsDays(value);
              void reloadInsights(value);
            }}
            options={[
              { label: '近 7 天', value: 7 },
              { label: '近 30 天', value: 30 },
              { label: '近 90 天', value: 90 },
            ]}
          />
          <Button onClick={() => void reloadInsights(insightsDays)} loading={insightsLoading}>刷新</Button>
        </Space>

        <Descriptions size="small" bordered column={3} style={{ marginBottom: 12 }}>
          <Descriptions.Item label="请求总数">
            <Statistic value={userInsights?.overview?.total_requests || 0} />
          </Descriptions.Item>
          <Descriptions.Item label="异常率">
            <Statistic value={userInsights?.overview?.error_rate || 0} suffix="%" />
          </Descriptions.Item>
          <Descriptions.Item label="活跃天数">
            <Statistic value={userInsights?.overview?.active_days || 0} suffix="天" />
          </Descriptions.Item>
          <Descriptions.Item label="独立路径">
            <Statistic value={userInsights?.overview?.unique_paths || 0} />
          </Descriptions.Item>
          <Descriptions.Item label="平均耗时">
            <Statistic value={userInsights?.overview?.avg_duration_ms || 0} suffix="ms" />
          </Descriptions.Item>
          <Descriptions.Item label="最近行为">
            {userInsights?.overview?.last_seen ? new Date(userInsights.overview.last_seen).toLocaleString('zh-CN') : '暂无'}
          </Descriptions.Item>
        </Descriptions>

        <Tabs
          items={[
            {
              key: 'behavior',
              label: '行为分析',
              children: (
                <>
                  <Card size="small" title="高频行为（可读）" style={{ marginBottom: 12 }}>
                    <Table
                      size="small"
                      loading={insightsLoading}
                      rowKey="action_key"
                      pagination={false}
                      dataSource={userInsights?.top_actions || []}
                      columns={[
                        { title: '行为', dataIndex: 'action_label', width: 220 },
                        { title: '模块', dataIndex: 'module', width: 120 },
                        { title: '次数', dataIndex: 'requests', width: 90, align: 'right' },
                        {
                          title: '最近发生',
                          dataIndex: 'last_seen',
                          render: (value: string | null) => (value ? new Date(value).toLocaleString('zh-CN') : '—'),
                        },
                      ]}
                    />
                  </Card>

                  <Card size="small" title="最近行为时间线">
                    <Table<UserInsightBehaviorItem>
                      size="small"
                      loading={insightsLoading}
                      rowKey={(record, index) => `${record.ts}-${record.path}-${index}`}
                      dataSource={userInsights?.recent_behaviors || []}
                      pagination={{ pageSize: 8, size: 'small', showSizeChanger: false }}
                      columns={[
                        { title: '时间', dataIndex: 'ts', width: 165, render: (value: string) => new Date(value).toLocaleString('zh-CN') },
                        { title: '行为摘要', dataIndex: 'summary', width: 260, ellipsis: true },
                        { title: '模块', dataIndex: 'module', width: 100 },
                        { title: '状态', dataIndex: 'status', width: 80, align: 'center' },
                        { title: '耗时', dataIndex: 'duration_ms', width: 80, align: 'right', render: (value: number) => `${value}ms` },
                        { title: '路径', dataIndex: 'path', ellipsis: true },
                      ]}
                    />
                  </Card>
                </>
              ),
            },
            {
              key: 'account',
              label: '账户资料',
              children: (
                <Descriptions size="small" bordered column={2}>
                  <Descriptions.Item label="用户ID">{userFullProfile?.user.id || '-'}</Descriptions.Item>
                  <Descriptions.Item label="用户名">{userFullProfile?.user.username || '-'}</Descriptions.Item>
                  <Descriptions.Item label="邮箱">{userFullProfile?.user.email || '—'}</Descriptions.Item>
                  <Descriptions.Item label="邮箱验证">{userFullProfile?.user.email_verified ? '已验证' : '未验证'}</Descriptions.Item>
                  <Descriptions.Item label="账号状态">{userFullProfile?.user.account_status === 'disabled' ? '停用' : '正常'}</Descriptions.Item>
                  <Descriptions.Item label="管理员">{userFullProfile?.user.is_admin ? '是' : '否'}</Descriptions.Item>
                  <Descriptions.Item label="最近登录时间">{userFullProfile?.user.last_login_at ? new Date(userFullProfile.user.last_login_at).toLocaleString('zh-CN') : '从未登录'}</Descriptions.Item>
                  <Descriptions.Item label="最近登录IP">{userFullProfile?.user.last_login_ip || '—'}</Descriptions.Item>
                  <Descriptions.Item label="收藏数">{userFullProfile?.summary.favorite_count || 0}</Descriptions.Item>
                  <Descriptions.Item label="歌单数">{userFullProfile?.summary.playlist_count || 0}</Descriptions.Item>
                </Descriptions>
              ),
            },
            {
              key: 'favorites',
              label: '收藏',
              children: (
                <Table
                  size="small"
                  loading={insightsLoading}
                  rowKey={(record) => `${record.track_id}-${record.favorited_at}`}
                  dataSource={userFullProfile?.favorites || []}
                  pagination={{ pageSize: 8, size: 'small', showSizeChanger: false }}
                  columns={[
                    { title: '曲目ID', dataIndex: 'track_id', width: 100 },
                    { title: '曲目', dataIndex: 'track_title', width: 260, ellipsis: true },
                    { title: '专辑', dataIndex: 'album_title', ellipsis: true, render: (value: string | null) => value || '—' },
                    { title: '收藏时间', dataIndex: 'favorited_at', width: 170, render: (value: string) => new Date(value).toLocaleString('zh-CN') },
                  ]}
                />
              ),
            },
            {
              key: 'playlists',
              label: '歌单',
              children: (
                <Table
                  size="small"
                  loading={insightsLoading}
                  rowKey="id"
                  dataSource={userFullProfile?.playlists || []}
                  pagination={{ pageSize: 6, size: 'small', showSizeChanger: false }}
                  columns={[
                    { title: '歌单', dataIndex: 'name', width: 200, ellipsis: true },
                    { title: '描述', dataIndex: 'description', ellipsis: true, render: (value: string | null) => value || '—' },
                    { title: '曲目数', dataIndex: 'track_count', width: 90, align: 'right' },
                    { title: '总时长', dataIndex: 'total_duration', width: 90, align: 'right', render: (value: number) => `${Math.floor((value || 0) / 60)}m` },
                    { title: '更新时间', dataIndex: 'updated_at', width: 170, render: (value: string) => new Date(value).toLocaleString('zh-CN') },
                  ]}
                />
              ),
            },
          ]}
        />
      </Modal>

      <Modal
        title="发送站内信"
        open={siteMessageModalOpen}
        onCancel={() => {
          setSiteMessageModalOpen(false);
          messageForm.resetFields();
        }}
        onOk={() => void handleSendSiteMessage()}
        okButtonProps={{ loading: siteMessageSubmitting }}
      >
        <Form form={messageForm} layout="vertical">
          <Form.Item
            name="scope"
            label="发送范围"
            rules={[{ required: true, message: '请选择发送范围' }]}
          >
            <Select
              options={[
                { label: '全站用户', value: 'broadcast' },
                { label: '指定用户', value: 'selected' },
              ]}
            />
          </Form.Item>

          <Form.Item noStyle shouldUpdate>
            {({ getFieldValue }) => (
              getFieldValue('scope') === 'selected' ? (
                <Form.Item
                  name="recipient_user_ids"
                  label="指定用户"
                  rules={[{ required: true, message: '请选择至少一个用户' }]}
                >
                  <Select
                    mode="multiple"
                    placeholder="选择接收用户"
                    optionFilterProp="label"
                    options={items.map((item) => ({
                      label: `${item.username} (#${item.id})`,
                      value: item.id,
                    }))}
                  />
                </Form.Item>
              ) : null
            )}
          </Form.Item>

          <Form.Item
            name="title"
            label="标题"
            rules={[{ required: true, message: '请输入标题' }, { max: 200, message: '标题最多 200 字' }]}
          >
            <Input maxLength={200} />
          </Form.Item>

          <Form.Item
            name="content"
            label="内容"
            rules={[{ required: true, message: '请输入内容' }, { max: 10000, message: '内容最多 10000 字' }]}
          >
            <Input.TextArea rows={5} maxLength={10000} />
          </Form.Item>
        </Form>
      </Modal>
    </AdminLayout>
  );
};

export default UserManagement;

