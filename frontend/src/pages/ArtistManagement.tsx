import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import dayjs from 'dayjs';
import {
  Avatar,
  Button,
  Card,
  Checkbox,
  Drawer,
  Input,
  List,
  message,
  Modal,
  Popconfirm,
  Select,
  Space,
  Table,
  Tag,
  Upload,
  Grid,
} from 'antd';
import {
  DeleteOutlined,
  EditOutlined,
  MergeCellsOutlined,
  SearchOutlined,
  UserOutlined,
} from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import type { TableRowSelection } from 'antd/es/table/interface';
import api from '../services/api';
import { trackService } from '../services/trackService';
import AdminLayout from '../components/AdminLayout';
import AdminActionBar from '../components/admin/AdminActionBar';
import AdminPageHeader from '../components/admin/AdminPageHeader';

const { useBreakpoint } = Grid;

interface ArtistItem {
  name: string;
  track_count: number;
  album_count: number;
  roles: string[];
  is_alias?: boolean;
  canonical_name?: string | null;
  user_id?: number | null;
  updated_at?: string;
}

interface RoleMappingItem {
  from: string;
  to: string;
}

interface AliasItem {
  id: number;
  canonical_name: string;
  alias_name: string;
  created_at: string;
}

interface RoleAliasItem {
  id: number;
  canonical_role: string;
  alias_role: string;
  created_at: string;
}

interface RoleStatItem {
  role: string;
  usage_count: number;
}

const ArtistManagement: React.FC = () => {
  const screens = useBreakpoint();
  const isMobile = !screens.md;

  const [artists, setArtists] = useState<ArtistItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [pagination, setPagination] = useState({ current: 1, pageSize: 50, total: 0 });
  const [searchText, setSearchText] = useState('');

  const [selectedArtistNames, setSelectedArtistNames] = useState<string[]>([]);
  const [mergeModalVisible, setMergeModalVisible] = useState(false);
  const [canonicalName, setCanonicalName] = useState('');

  const [editModalVisible, setEditModalVisible] = useState(false);
  const [editingArtist, setEditingArtist] = useState<ArtistItem | null>(null);
  const [editName, setEditName] = useState('');
  const [editRoleMappings, setEditRoleMappings] = useState<RoleMappingItem[]>([]);

  const [aliases, setAliases] = useState<AliasItem[]>([]);
  const [aliasesModalVisible, setAliasesModalVisible] = useState(false);
  const [roleAliases, setRoleAliases] = useState<RoleAliasItem[]>([]);
  const [allRoles, setAllRoles] = useState<RoleStatItem[]>([]);
  const [roleAliasesModalVisible, setRoleAliasesModalVisible] = useState(false);
  const [roleMergeModalVisible, setRoleMergeModalVisible] = useState(false);
  const [mergeRoleCandidates, setMergeRoleCandidates] = useState<string[]>([]);
  const [selectedRoles, setSelectedRoles] = useState<string[]>([]);
  const [canonicalRole, setCanonicalRole] = useState('');
  const [avatars, setAvatars] = useState<Record<string, string>>({});

  const [mobileActionArtist, setMobileActionArtist] = useState<ArtistItem | null>(null);

  const fetchArtists = async (page = 1, search = '', pageSize?: number) => {
    const size = pageSize ?? pagination.pageSize;
    setLoading(true);
    try {
      const response = await api.get(`/artists?page=${page}&limit=${size}&search=${encodeURIComponent(search)}&include_aliases=true`);
      if (response.data.success) {
        setArtists(response.data.data.artists);
        setPagination((prev) => ({
          ...prev,
          current: response.data.data.pagination.page,
          total: response.data.data.pagination.total,
          pageSize: size,
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
      if (response.data.success) setAliases(response.data.data.aliases);
    } catch {
      message.error('获取别名列表失败');
    }
  };

  const fetchRoleAliases = async () => {
    try {
      const response = await api.get('/artists/roles/aliases');
      if (response.data.success) setRoleAliases(response.data.data.aliases);
    } catch {
      message.error('获取角色别名列表失败');
    }
  };

  const fetchAllRoles = async () => {
    try {
      const response = await api.get('/artists/roles');
      if (response.data.success) setAllRoles(response.data.data.roles || []);
    } catch {
      message.error('获取角色列表失败');
    }
  };

  const fetchAvatars = async () => {
    try {
      const response = await api.get('/artists/avatars');
      if (response.data.success) setAvatars(response.data.data.avatars);
    } catch {
      // ignore
    }
  };

  useEffect(() => {
    void fetchArtists();
    void fetchAliases();
    void fetchRoleAliases();
    void fetchAvatars();
  }, []);

  const handleAvatarUpload = async (file: File, artistName: string) => {
    const formData = new FormData();
    formData.append('avatar', file);
    try {
      const token = localStorage.getItem('token');
      const response = await api.post(`/artists/avatar/${encodeURIComponent(artistName)}`, formData, {
        headers: { 'Content-Type': 'multipart/form-data', Authorization: `Bearer ${token}` },
      });
      if (response.data.success) {
        setAvatars((prev) => ({ ...prev, [artistName]: response.data.data.avatar_path }));
        message.success('头像上传成功');
      }
    } catch {
      message.error('头像上传失败');
    }
  };

  const handleMerge = async () => {
    if (!canonicalName.trim()) {
      message.warning('请输入主名称');
      return;
    }

    const aliasNames = selectedArtistNames.filter((name) => name !== canonicalName.trim());
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
        message.success(response.data.data.message || '合并成功');
        setMergeModalVisible(false);
        setSelectedArtistNames([]);
        setCanonicalName('');
        void fetchArtists(pagination.current, searchText, pagination.pageSize);
        void fetchAliases();
      }
    } catch (error: any) {
      message.error(error.message || '合并失败');
    }
  };

  const handleDeleteAlias = async (id: number) => {
    try {
      await api.delete(`/artists/aliases/${id}`);
      message.success('别名已删除');
      void fetchAliases();
    } catch {
      message.error('删除别名失败');
    }
  };

  const handleDeleteRoleAlias = async (id: number) => {
    try {
      await api.delete(`/artists/roles/aliases/${id}`);
      message.success('角色别名已删除');
      void fetchRoleAliases();
      void fetchArtists(pagination.current, searchText, pagination.pageSize);
    } catch {
      message.error('删除角色别名失败');
    }
  };

  const openEditModal = (artist: ArtistItem) => {
    setMobileActionArtist(null);
    setEditingArtist(artist);
    setEditName(artist.name);
    setEditRoleMappings((artist.roles || []).filter(Boolean).map((r) => ({ from: r, to: r })));
    setSelectedRoles([]);
    setCanonicalRole('');
    setEditModalVisible(true);
  };

  const handleMergeRoles = async () => {
    if (!canonicalRole.trim()) {
      message.warning('请选择主角色');
      return;
    }

    const aliasRoles = selectedRoles.filter((role) => role !== canonicalRole.trim());
    if (aliasRoles.length === 0) {
      message.warning('请至少选择一个别名角色');
      return;
    }

    try {
      const response = await api.post('/artists/roles/merge', {
        canonicalRole: canonicalRole.trim(),
        aliasRoles,
      });
      if (response.data.success) {
        message.success(response.data.data.message || '角色别名合并成功');
        setRoleMergeModalVisible(false);
        setMergeRoleCandidates([]);
        setSelectedRoles([]);
        setCanonicalRole('');
        void fetchRoleAliases();
        void fetchAllRoles();
        void fetchArtists(pagination.current, searchText, pagination.pageSize);
      }
    } catch (error: any) {
      message.error(error?.response?.data?.error?.message || error.message || '角色别名合并失败');
    }
  };

  const handleSaveArtistEdit = async () => {
    if (!editingArtist) return;

    const trimmedName = editName.trim();
    if (!trimmedName) {
      message.warning('名称不能为空');
      return;
    }

    const roleMappings = editRoleMappings
      .map((item) => ({ from: item.from.trim(), to: item.to.trim() }))
      .filter((item) => item.from && item.to && item.from !== item.to);

    try {
      const response = await api.put(`/artists/${encodeURIComponent(editingArtist.name)}`, {
        name: trimmedName,
        roleMappings,
      });
      if (response.data.success) {
        message.success(response.data.data?.message || '艺术家信息已更新');
        setEditModalVisible(false);
        setEditingArtist(null);
        setEditName('');
        setEditRoleMappings([]);
        setSelectedArtistNames([]);
        setCanonicalName('');
        setMobileActionArtist(null);
        void fetchArtists(pagination.current, searchText, pagination.pageSize);
        void fetchAliases();
        void fetchAvatars();
      }
    } catch (error: any) {
      message.error(error?.response?.data?.error?.message || error.message || '更新失败');
    }
  };

  const getArtistRowKey = (record: ArtistItem) => (
    record.is_alias ? `alias:${record.canonical_name || ''}:${record.name}` : `main:${record.name}`
  );

  const rowSelection: TableRowSelection<ArtistItem> = {
    selectedRowKeys: selectedArtistNames.map((name) => `main:${name}`),
    onChange: (_keys, selectedRows) => {
      const names = selectedRows.filter((row) => !row.is_alias).map((row) => row.name);
      setSelectedArtistNames(names);
    },
    getCheckboxProps: (record) => ({ disabled: !!record.is_alias }),
  };

  const columns: ColumnsType<ArtistItem> = [
    {
      title: '头像',
      key: 'avatar',
      width: 84,
      render: (_, record) => {
        const avatarPath = avatars[record.name];
        return (
          <Upload
            showUploadList={false}
            accept="image/*"
            beforeUpload={(file) => {
              void handleAvatarUpload(file, record.name);
              return false;
            }}
          >
            {avatarPath ? (
              <Avatar size={44} src={trackService.getCoverUrl(avatarPath, true)} style={{ cursor: 'pointer' }} />
            ) : (
              <Avatar size={44} icon={<UserOutlined />} style={{ cursor: 'pointer' }} />
            )}
          </Upload>
        );
      },
    },
    {
      title: '艺术家',
      dataIndex: 'name',
      key: 'name',
      ellipsis: true,
      render: (name: string, record: ArtistItem) => (
        <div>
          <Link to={`/artists/${encodeURIComponent(record.name)}`}>{name}</Link>
          {record.is_alias && record.canonical_name && (
            <div style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>（{record.canonical_name} 的别名）</div>
          )}
        </div>
      ),
    },
    {
      title: '曲目数',
      dataIndex: 'track_count',
      key: 'track_count',
      width: 100,
      sorter: (a, b) => a.track_count - b.track_count,
      responsive: ['sm'],
    },
    {
      title: '专辑数',
      dataIndex: 'album_count',
      key: 'album_count',
      width: 100,
      responsive: ['md'],
    },
    {
      title: '角色',
      dataIndex: 'roles',
      key: 'roles',
      responsive: ['lg'],
      render: (roles: string[]) => (
        <Space wrap>
          {(roles || []).filter(Boolean).slice(0, 5).map((role) => (
            <Tag key={role} color="purple" style={{ fontSize: 11 }}>{role}</Tag>
          ))}
          {(roles || []).length > 5 && <Tag>+{roles.length - 5}</Tag>}
        </Space>
      ),
    },
    {
      title: '最近活跃',
      dataIndex: 'updated_at',
      key: 'updated_at',
      width: 180,
      responsive: ['xl'],
      render: (value?: string) => (value ? dayjs(value).format('YYYY-MM-DD HH:mm') : '—'),
    },
    {
      title: '操作',
      key: 'actions',
      width: 90,
      render: (_: unknown, record: ArtistItem) => (
        <Button size="small" icon={<EditOutlined />} onClick={() => openEditModal(record)}>
          修改
        </Button>
      ),
    },
  ];

  const hasSelection = selectedArtistNames.length > 0;

  const aliasGroups = useMemo(() => {
    const grouped: Record<string, AliasItem[]> = {};
    aliases.forEach((item) => {
      if (!grouped[item.canonical_name]) grouped[item.canonical_name] = [];
      grouped[item.canonical_name].push(item);
    });
    return grouped;
  }, [aliases]);

  const roleAliasGroups = useMemo(() => {
    const grouped: Record<string, RoleAliasItem[]> = {};
    roleAliases.forEach((item) => {
      if (!grouped[item.canonical_role]) grouped[item.canonical_role] = [];
      grouped[item.canonical_role].push(item);
    });
    return grouped;
  }, [roleAliases]);

  const headerActions = (
    <AdminActionBar>
      <Input.Search
        placeholder="搜索艺术家..."
        allowClear
        style={{ width: isMobile ? '100%' : 240 }}
        value={searchText}
        onChange={(e) => setSearchText(e.target.value)}
        onSearch={(value) => {
          setSearchText(value);
          void fetchArtists(1, value);
        }}
        enterButton={<SearchOutlined />}
      />
      {hasSelection && selectedArtistNames.length >= 2 && (
        <Button
          icon={<MergeCellsOutlined />}
          onClick={() => {
            setCanonicalName(selectedArtistNames[0]);
            setMergeModalVisible(true);
          }}
        >
          合并 ({selectedArtistNames.length})
        </Button>
      )}
      <Button onClick={() => { void fetchAliases(); setAliasesModalVisible(true); }}>查看别名</Button>
      <Button
        onClick={() => {
          void fetchAllRoles();
          setMergeRoleCandidates([]);
          setSelectedRoles([]);
          setCanonicalRole('');
          setRoleMergeModalVisible(true);
        }}
      >
        全局合并角色
      </Button>
      <Button onClick={() => { void fetchRoleAliases(); setRoleAliasesModalVisible(true); }}>查看角色别名</Button>
    </AdminActionBar>
  );

  return (
    <AdminLayout>
      <AdminPageHeader
        title="艺术家管理"
        description="统一维护艺术家主名称、别名、角色映射与头像。"
        actions={headerActions}
      />
      <Card title="艺术家列表">
        {isMobile ? (
          <List
            loading={loading}
            dataSource={artists}
            pagination={{
              current: pagination.current,
              pageSize: pagination.pageSize,
              total: pagination.total,
              showSizeChanger: true,
              pageSizeOptions: ['20', '50', '100'],
              onChange: (page, pageSize) => {
                void fetchArtists(page, searchText, pageSize);
              },
            }}
            renderItem={(artist) => {
              const selected = selectedArtistNames.includes(artist.name);
              const avatarPath = avatars[artist.name];
              const canSelect = !artist.is_alias;

              return (
                <List.Item>
                  <Card style={{ width: '100%' }} bodyStyle={{ padding: 12 }}>
                    <Space align="start" style={{ width: '100%', justifyContent: 'space-between' }}>
                      <Space align="start">
                        {canSelect && (
                          <Checkbox
                            checked={selected}
                            onChange={(event) => {
                              const checked = event.target.checked;
                              setSelectedArtistNames((prev) => {
                                if (checked) return prev.includes(artist.name) ? prev : [...prev, artist.name];
                                return prev.filter((name) => name !== artist.name);
                              });
                            }}
                          />
                        )}
                        {avatarPath ? (
                          <Avatar size={44} src={trackService.getCoverUrl(avatarPath, true)} />
                        ) : (
                          <Avatar size={44} icon={<UserOutlined />} />
                        )}
                        <div>
                          <div style={{ fontWeight: 600 }}>{artist.name}</div>
                          {artist.is_alias && artist.canonical_name && (
                            <div style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>别名 -&gt; {artist.canonical_name}</div>
                          )}
                          <Space size={6} wrap style={{ marginTop: 6 }}>
                            <Tag>{artist.track_count || 0} 首曲目</Tag>
                            <Tag>{artist.album_count || 0} 张专辑</Tag>
                          </Space>
                        </div>
                      </Space>
                      <Button size="small" onClick={() => setMobileActionArtist(artist)}>操作</Button>
                    </Space>
                  </Card>
                </List.Item>
              );
            }}
          />
        ) : (
          <Table
            columns={columns}
            dataSource={artists}
            rowKey={getArtistRowKey}
            loading={loading}
            rowSelection={rowSelection}
            pagination={{
              ...pagination,
              showSizeChanger: true,
              pageSizeOptions: ['20', '50', '100'],
              showTotal: (total) => `共 ${total} 位艺术家`,
            }}
            onChange={(nextPagination) => {
              const nextSize = nextPagination.pageSize || pagination.pageSize;
              const nextPage = nextPagination.pageSize !== pagination.pageSize ? 1 : (nextPagination.current || 1);
              void fetchArtists(nextPage, searchText, nextSize);
            }}
          />
        )}
      </Card>

      <Drawer
        title={mobileActionArtist ? `操作: ${mobileActionArtist.name}` : '操作'}
        open={!!mobileActionArtist}
        onClose={() => setMobileActionArtist(null)}
        placement="bottom"
        height={220}
      >
        <Space direction="vertical" style={{ width: '100%' }}>
          <Button type="primary" icon={<EditOutlined />} onClick={() => mobileActionArtist && openEditModal(mobileActionArtist)}>
            修改艺术家
          </Button>
          <Button onClick={() => setMobileActionArtist(null)}>关闭</Button>
        </Space>
      </Drawer>

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
          <p>已选择 <strong>{selectedArtistNames.length}</strong> 个艺术家，请选择主名称。</p>
        </div>
        <Select style={{ width: '100%' }} value={canonicalName} onChange={setCanonicalName}>
          {selectedArtistNames.map((name) => (
            <Select.Option key={name} value={name}>{name}</Select.Option>
          ))}
        </Select>
      </Modal>

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
          Object.entries(aliasGroups).map(([canonical, list]) => (
            <Card key={canonical} size="small" style={{ marginBottom: 12 }} title={<><strong>{canonical}</strong> <Tag color="blue">主名称</Tag></>}>
              <List
                size="small"
                dataSource={list}
                renderItem={(item) => (
                  <List.Item
                    actions={[
                      <Popconfirm key="del" title="确定删除此别名？" onConfirm={() => void handleDeleteAlias(item.id)}>
                        <Button size="small" danger icon={<DeleteOutlined />} />
                      </Popconfirm>,
                    ]}
                  >
                    <Tag color="orange">{item.alias_name}</Tag>
                  </List.Item>
                )}
              />
            </Card>
          ))
        )}
      </Modal>

      <Modal
        title={editingArtist ? `修改艺术家：${editingArtist.name}` : '修改艺术家'}
        open={editModalVisible}
        onOk={handleSaveArtistEdit}
        onCancel={() => {
          setEditModalVisible(false);
          setEditingArtist(null);
          setEditName('');
          setEditRoleMappings([]);
        }}
        okText="保存并应用"
        cancelText="取消"
        width={640}
      >
        <div style={{ marginBottom: 16 }}>
          <div style={{ marginBottom: 6, fontWeight: 600 }}>名称</div>
          <Input value={editName} onChange={(e) => setEditName(e.target.value)} maxLength={500} />
        </div>
        <Space direction="vertical" style={{ width: '100%' }} size={8}>
          {editRoleMappings.map((mapping, index) => (
            <Space key={`${mapping.from}-${index}`} style={{ width: '100%' }} align="center">
              <Tag color="purple" style={{ minWidth: 120, textAlign: 'center', marginRight: 0 }}>{mapping.from}</Tag>
              <span style={{ color: '#999' }}>→</span>
              <Input
                value={mapping.to}
                onChange={(e) => {
                  const next = [...editRoleMappings];
                  next[index] = { ...next[index], to: e.target.value };
                  setEditRoleMappings(next);
                }}
                maxLength={200}
              />
            </Space>
          ))}
        </Space>
      </Modal>

      <Modal
        title="合并角色（别名）"
        open={roleMergeModalVisible}
        onOk={handleMergeRoles}
        onCancel={() => {
          setRoleMergeModalVisible(false);
          setMergeRoleCandidates([]);
          setSelectedRoles([]);
          setCanonicalRole('');
        }}
        okText="合并"
        cancelText="取消"
        okButtonProps={{ disabled: selectedRoles.length < 2 || !canonicalRole }}
        width={520}
      >
        <div style={{ marginBottom: 12 }}>
          <p>请先勾选需要参与合并的全局角色（至少 2 项），再选择主角色。</p>
        </div>

        {allRoles.length > 0 && (
          <div style={{ marginBottom: 10 }}>
            <p style={{ marginBottom: 8, color: 'var(--text-secondary)' }}>可选角色（按使用次数排序）：</p>
            <Space wrap>
              {allRoles.map((item) => (
                <Tag key={item.role}>{item.role} ({item.usage_count})</Tag>
              ))}
            </Space>
          </div>
        )}

        <Checkbox.Group
          style={{ width: '100%', marginBottom: 12 }}
          value={selectedRoles}
          onChange={(values) => {
            const next = values as string[];
            setSelectedRoles(next);
            if (canonicalRole && !next.includes(canonicalRole)) {
              setCanonicalRole('');
            }
          }}
        >
          <Space wrap>
            {(mergeRoleCandidates.length > 0
              ? mergeRoleCandidates
              : allRoles.map((item) => item.role)
            ).map((role) => (
              <Checkbox key={role} value={role}>{role}</Checkbox>
            ))}
          </Space>
        </Checkbox.Group>

        <Select
          style={{ width: '100%', marginBottom: 12 }}
          placeholder="选择主角色"
          value={canonicalRole || undefined}
          onChange={setCanonicalRole}
          disabled={selectedRoles.length < 2}
        >
          {selectedRoles.map((role) => (
            <Select.Option key={role} value={role}>{role}</Select.Option>
          ))}
        </Select>

        <div>
          {selectedRoles.map((role) => (
            <Tag key={role} style={{ marginBottom: 8 }}>{role}</Tag>
          ))}
        </div>
      </Modal>

      <Modal
        title="角色别名列表"
        open={roleAliasesModalVisible}
        onCancel={() => setRoleAliasesModalVisible(false)}
        footer={null}
        width={640}
      >
        {Object.keys(roleAliasGroups).length === 0 ? (
          <p style={{ textAlign: 'center', color: '#999' }}>暂无角色别名记录</p>
        ) : (
          Object.entries(roleAliasGroups).map(([canonical, list]) => (
            <Card key={canonical} size="small" style={{ marginBottom: 12 }} title={<><strong>{canonical}</strong> <Tag color="blue">主角色</Tag></>}>
              <List
                size="small"
                dataSource={list}
                renderItem={(item) => (
                  <List.Item
                    actions={[
                      <Popconfirm key="del" title="确定删除此角色别名？" onConfirm={() => void handleDeleteRoleAlias(item.id)}>
                        <Button size="small" danger icon={<DeleteOutlined />} />
                      </Popconfirm>,
                    ]}
                  >
                    <Tag color="purple">{item.alias_role}</Tag>
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

