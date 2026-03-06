import React, { useEffect, useState } from 'react';
import {
  Table, Button, message, Space, Tag, Card, Modal, Input, Select, List, Popconfirm, Upload, Avatar
} from 'antd';
import {
  MergeCellsOutlined,
  DeleteOutlined,
  SearchOutlined,
  UserOutlined,
} from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import type { TableRowSelection } from 'antd/es/table/interface';
import api from '../services/api';
import { trackService } from '../services/trackService';
import AdminLayout from '../components/AdminLayout';

interface ArtistItem {
  name: string;
  track_count: number;
  album_count: number;
  roles: string[];
}

interface AliasItem {
  id: number;
  canonical_name: string;
  alias_name: string;
  created_at: string;
}

const ArtistManagement: React.FC = () => {
  const [artists, setArtists] = useState<ArtistItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [pagination, setPagination] = useState({ current: 1, pageSize: 50, total: 0 });
  const [searchText, setSearchText] = useState('');

  // Merge state
  const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([]);
  const [mergeModalVisible, setMergeModalVisible] = useState(false);
  const [canonicalName, setCanonicalName] = useState('');

  // Aliases
  const [aliases, setAliases] = useState<AliasItem[]>([]);
  const [aliasesModalVisible, setAliasesModalVisible] = useState(false);

  // Avatars
  const [avatars, setAvatars] = useState<Record<string, string>>({});

  const fetchArtists = async (page = 1, search = '') => {
    setLoading(true);
    try {
      const response = await api.get(`/artists?page=${page}&limit=${pagination.pageSize}&search=${encodeURIComponent(search)}`);
      if (response.data.success) {
        setArtists(response.data.data.artists);
        setPagination(prev => ({
          ...prev,
          current: response.data.data.pagination.page,
          total: response.data.data.pagination.total,
        }));
      }
    } catch (error: any) {
      message.error(error.message || '获取艺术家列表失败');
    } finally {
      setLoading(false);
    }
  };

  const fetchAliases = async () => {
    try {
      const response = await api.get('/artists/aliases');
      if (response.data.success) {
        setAliases(response.data.data.aliases);
      }
    } catch (error: any) {
      message.error('获取别名列表失败');
    }
  };

  const fetchAvatars = async () => {
    try {
      const response = await api.get('/artists/avatars');
      if (response.data.success) {
        setAvatars(response.data.data.avatars);
      }
    } catch { /* ignore */ }
  };

  const handleAvatarUpload = async (file: File, artistName: string) => {
    const formData = new FormData();
    formData.append('avatar', file);
    try {
      const token = localStorage.getItem('token');
      const response = await api.post(`/artists/avatar/${encodeURIComponent(artistName)}`, formData, {
        headers: { 'Content-Type': 'multipart/form-data', Authorization: `Bearer ${token}` }
      });
      if (response.data.success) {
        message.success('头像上传成功');
        setAvatars(prev => ({ ...prev, [artistName]: response.data.data.avatar_path }));
      }
    } catch (error: any) {
      message.error('头像上传失败');
    }
  };

  useEffect(() => {
    fetchArtists();
    fetchAliases();
    fetchAvatars();
  }, []);

  const handleMerge = async () => {
    if (!canonicalName.trim()) {
      message.warning('请输入主名称');
      return;
    }
    const aliasNames = (selectedRowKeys as string[]).filter(n => n !== canonicalName.trim());
    if (aliasNames.length === 0) {
      message.warning('请至少选择一个不同于主名称的艺术家作为别名');
      return;
    }
    try {
      const response = await api.post('/artists/merge', {
        canonicalName: canonicalName.trim(),
        aliasNames,
      });
      if (response.data.success) {
        message.success(response.data.data.message);
        setMergeModalVisible(false);
        setSelectedRowKeys([]);
        setCanonicalName('');
        fetchAliases();
      }
    } catch (error: any) {
      message.error(error.message || '合并失败');
    }
  };

  const handleDeleteAlias = async (id: number) => {
    try {
      await api.delete(`/artists/aliases/${id}`);
      message.success('别名已删除');
      fetchAliases();
    } catch (error: any) {
      message.error('删除别名失败');
    }
  };

  const rowSelection: TableRowSelection<ArtistItem> = {
    selectedRowKeys,
    onChange: (keys) => setSelectedRowKeys(keys),
  };

  const columns: ColumnsType<ArtistItem> = [
    {
      title: '头像',
      key: 'avatar',
      width: 80,
      render: (_, record) => {
        const avatarPath = avatars[record.name];
        return (
          <Upload
            showUploadList={false}
            accept="image/*"
            beforeUpload={(file) => {
              handleAvatarUpload(file, record.name);
              return false;
            }}
          >
            {avatarPath ? (
              <Avatar
                size={48}
                src={trackService.getCoverUrl(avatarPath, true)}
                style={{ cursor: 'pointer' }}
              />
            ) : (
              <Avatar
                size={48}
                icon={<UserOutlined />}
                style={{ cursor: 'pointer', backgroundColor: '#667eea' }}
              />
            )}
          </Upload>
        );
      },
    },
    {
      title: '名称',
      dataIndex: 'name',
      key: 'name',
      ellipsis: true,
    },
    {
      title: '曲目数',
      dataIndex: 'track_count',
      key: 'track_count',
      width: 100,
      sorter: (a, b) => a.track_count - b.track_count,
    },
    {
      title: '专辑数',
      dataIndex: 'album_count',
      key: 'album_count',
      width: 100,
    },
    {
      title: '角色',
      dataIndex: 'roles',
      key: 'roles',
      render: (roles: string[]) => (
        <Space wrap>
          {(roles || []).filter(Boolean).slice(0, 5).map(r => (
            <Tag key={r} color="purple" style={{ fontSize: 11 }}>{r}</Tag>
          ))}
          {(roles || []).length > 5 && <Tag>+{roles.length - 5}</Tag>}
        </Space>
      ),
    },
  ];

  const hasSelection = selectedRowKeys.length > 0;

  // Group aliases by canonical_name
  const aliasGroups: Record<string, AliasItem[]> = {};
  aliases.forEach(a => {
    if (!aliasGroups[a.canonical_name]) aliasGroups[a.canonical_name] = [];
    aliasGroups[a.canonical_name].push(a);
  });

  return (
    <AdminLayout>
      <Card
        title="艺术家管理"
        extra={
          <Space>
            <Input.Search
              placeholder="搜索艺术家..."
              allowClear
              style={{ width: 240 }}
              value={searchText}
              onChange={e => setSearchText(e.target.value)}
              onSearch={(val) => { setSearchText(val); fetchArtists(1, val); }}
              enterButton={<SearchOutlined />}
            />
            {hasSelection && selectedRowKeys.length >= 2 && (
              <Button
                icon={<MergeCellsOutlined />}
                onClick={() => {
                  setCanonicalName(selectedRowKeys[0] as string);
                  setMergeModalVisible(true);
                }}
              >
                合并艺术家 ({selectedRowKeys.length})
              </Button>
            )}
            <Button onClick={() => { fetchAliases(); setAliasesModalVisible(true); }}>
              查看别名列表
            </Button>
          </Space>
        }
      >
        <Table
          columns={columns}
          dataSource={artists}
          rowKey="name"
          loading={loading}
          rowSelection={rowSelection}
          pagination={{
            ...pagination,
            showSizeChanger: true,
            showTotal: (total: number) => `共 ${total} 位艺术家`,
          }}
          onChange={(newPagination) => {
            fetchArtists(newPagination.current, searchText);
          }}
        />
      </Card>

      {/* Merge Modal */}
      <Modal
        title="合并艺术家（别名）"
        open={mergeModalVisible}
        onOk={handleMerge}
        onCancel={() => { setMergeModalVisible(false); setCanonicalName(''); }}
        okText="合并"
        cancelText="取消"
        width={500}
      >
        <div style={{ marginBottom: 16 }}>
          <p>已选择 <strong>{selectedRowKeys.length}</strong> 个艺术家。请选择<strong>主名称</strong>，其余将作为别名。</p>
          <p style={{ color: '#999', fontSize: 12 }}>合并仅创建别名关系，不会修改原始 Credits 数据。</p>
        </div>
        <div style={{ marginBottom: 12 }}>
          <strong>主名称（规范名称）：</strong>
          <Select
            style={{ width: '100%', marginTop: 4 }}
            value={canonicalName}
            onChange={setCanonicalName}
          >
            {(selectedRowKeys as string[]).map(name => (
              <Select.Option key={name} value={name}>{name}</Select.Option>
            ))}
          </Select>
        </div>
        <div>
          <strong>将作为别名：</strong>
          <div style={{ marginTop: 4 }}>
            {(selectedRowKeys as string[]).filter(n => n !== canonicalName).map(name => (
              <Tag key={name} color="orange" style={{ margin: 4 }}>{name}</Tag>
            ))}
          </div>
        </div>
      </Modal>

      {/* Aliases List Modal */}
      <Modal
        title="艺术家别名列表"
        open={aliasesModalVisible}
        onCancel={() => setAliasesModalVisible(false)}
        footer={null}
        width={600}
      >
        {Object.keys(aliasGroups).length === 0 ? (
          <p style={{ textAlign: 'center', color: '#999' }}>暂无别名记录</p>
        ) : (
          Object.entries(aliasGroups).map(([canonical, aliasList]) => (
            <Card key={canonical} size="small" style={{ marginBottom: 12 }} title={<><strong>{canonical}</strong> <Tag color="blue">主名称</Tag></>}>
              <List
                size="small"
                dataSource={aliasList}
                renderItem={item => (
                  <List.Item
                    actions={[
                      <Popconfirm
                        key="del"
                        title="确定删除此别名？"
                        onConfirm={() => handleDeleteAlias(item.id)}
                      >
                        <Button size="small" danger icon={<DeleteOutlined />} />
                      </Popconfirm>
                    ]}
                  >
                    <Tag color="orange">{item.alias_name}</Tag>
                    <span style={{ fontSize: 11, color: '#999' }}>→ {item.canonical_name}</span>
                  </List.Item>
                )}
              />
            </Card>
          ))
        )}
      </Modal>
    </AdminLayout>
  );
};

export default ArtistManagement;

