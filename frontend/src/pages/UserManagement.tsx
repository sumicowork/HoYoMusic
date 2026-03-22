import React, { useEffect, useMemo, useState } from 'react';
import { Button, Card, Form, Input, Modal, Popconfirm, Select, Space, Table, Tag, Typography, message } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import AdminLayout from '../components/AdminLayout';
import { useAuthStore } from '../store/authStore';
import { userService, type AdminUserItem, type UserListFilters } from '../services/userService';

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
    </AdminLayout>
  );
};

export default UserManagement;

