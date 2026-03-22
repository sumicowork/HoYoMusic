import React, { useEffect, useState } from 'react';
import { Button, Card, Table, Tag, Typography, message } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import AdminLayout from '../components/AdminLayout';
import { userService, type AdminUserItem } from '../services/userService';

const { Title } = Typography;

const UserManagement: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const [items, setItems] = useState<AdminUserItem[]>([]);
  const [pagination, setPagination] = useState({ page: 1, pageSize: 20, total: 0 });

  const loadUsers = async (page = pagination.page, pageSize = pagination.pageSize) => {
    setLoading(true);
    try {
      const data = await userService.getUsers(page, pageSize);
      setItems(data.items);
      setPagination({ page: data.pagination.page, pageSize: data.pagination.pageSize, total: data.pagination.total });
    } catch (error: any) {
      message.error(error?.message || '加载用户列表失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadUsers();
  }, []);

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
      title: '注册时间',
      dataIndex: 'created_at',
      key: 'created_at',
      width: 180,
      render: (value: string) => new Date(value).toLocaleString('zh-CN'),
    },
  ];

  return (
    <AdminLayout>
      <div style={{ padding: 24 }}>
        <Card
          title={<Title level={4} style={{ margin: 0 }}>用户管理</Title>}
          extra={<Button onClick={() => loadUsers(1, pagination.pageSize)} loading={loading}>刷新</Button>}
        >
          <Table
            rowKey="id"
            loading={loading}
            columns={columns}
            dataSource={items}
            pagination={{
              current: pagination.page,
              pageSize: pagination.pageSize,
              total: pagination.total,
              showSizeChanger: true,
              pageSizeOptions: ['10', '20', '50', '100'],
              showTotal: (total) => `共 ${total} 位用户`,
            }}
            onChange={(nextPagination) => {
              loadUsers(nextPagination.current || 1, nextPagination.pageSize || pagination.pageSize);
            }}
          />
        </Card>
      </div>
    </AdminLayout>
  );
};

export default UserManagement;

