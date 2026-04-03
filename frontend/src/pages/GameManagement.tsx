import React, { useEffect, useState } from 'react';
import { Table, Select, message, Card, Image, Button, Modal, Form, Input, InputNumber, Space, Upload, List, Drawer, Grid, Tag } from 'antd';
import { PlusOutlined, EditOutlined, UploadOutlined } from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import AdminLayout from '../components/AdminLayout';
import AdminActionBar from '../components/admin/AdminActionBar';
import AdminPageHeader from '../components/admin/AdminPageHeader';
import api from '../services/api';
import { gameService, type Game } from '../services/gameService';
import { getCoverUrl } from '../utils/imageUtils';
const { TextArea } = Input;
const { useBreakpoint } = Grid;

const STATUS_OPTIONS = [
  { value: 'active',      label: '正常' },
  { value: 'maintenance', label: '维护中' },
  { value: 'unreleased',  label: '未发行' },
];

const GameManagement: React.FC = () => {
  const screens = useBreakpoint();
  const isMobile = !screens.md;

  const [games, setGames] = useState<Game[]>([]);
  const [loading, setLoading] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [editingGame, setEditingGame] = useState<Game | null>(null);
  const [form] = Form.useForm();
  const [mobileActionGame, setMobileActionGame] = useState<Game | null>(null);

  const fetchGames = async () => {
    setLoading(true);
    try {
      const data = await gameService.getGames();
      setGames(data);
    } catch {
      message.error('加载游戏列表失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchGames(); }, []);

  const handleStatusChange = async (game: Game, status: string) => {
    try {
      await api.put(`/games/${game.id}`, { status });
      message.success(`「${game.name}」状态已更新`);
      setGames(prev => prev.map(g => g.id === game.id ? { ...g, status: status as Game['status'] } : g));
    } catch {
      message.error('更新失败');
    }
  };

  const handleAdd = () => {
    setEditingGame(null);
    form.resetFields();
    form.setFieldsValue({ display_order: games.length, status: 'active' });
    setModalVisible(true);
  };

  const handleEdit = (game: Game) => {
    setMobileActionGame(null);
    setEditingGame(game);
    form.setFieldsValue({
      name: game.name,
      name_en: game.name_en,
      description: game.description,
      display_order: game.display_order,
      status: game.status || 'active',
    });
    setModalVisible(true);
  };

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields();
      if (editingGame) {
        await api.put(`/games/${editingGame.id}`, values);
        message.success('游戏信息已更新');
      } else {
        await api.post('/games', values);
        message.success('游戏创建成功');
      }
      setModalVisible(false);
      form.resetFields();
      fetchGames();
    } catch (error: any) {
      const detail = error.response?.data?.error?.details?.[0]?.message;
      if (error.response?.data?.error?.code === 'DUPLICATE') {
        message.error('游戏名称已存在');
      } else if (detail) {
        message.error(detail);
      } else {
        message.error(editingGame ? '更新失败' : '创建失败');
      }
    }
  };

  const handleCoverUpload = async (file: File, gameId: number) => {
    const formData = new FormData();
    formData.append('cover', file);
    try {
      const res = await api.post(`/games/${gameId}/cover`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      if (res.data.success) {
        message.success('封面上传成功');
        setGames(prev => prev.map(g => g.id === gameId ? { ...g, cover_path: res.data.data.game.cover_path } : g));
      }
    } catch {
      message.error('封面上传失败');
    }
  };

  const columns: ColumnsType<Game> = [
    {
      title: '封面',
      dataIndex: 'cover_path',
      key: 'cover',
      width: 90,
      render: (cover, record) => (
        <Upload
          showUploadList={false}
          accept="image/*"
          beforeUpload={(file) => { handleCoverUpload(file, record.id); return false; }}
        >
          {cover ? (
            <Image
              width={56} height={56}
              src={getCoverUrl(cover)}
              preview={false}
              style={{ borderRadius: 8, objectFit: 'cover', cursor: 'pointer' }}
            />
          ) : (
            <div style={{
              width: 56, height: 56, background: 'linear-gradient(135deg, #667eea, #764ba2)',
              borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: '#fff', fontSize: 18, cursor: 'pointer'
            }}>
              <UploadOutlined />
            </div>
          )}
        </Upload>
      ),
    },
    {
      title: '游戏名称',
      dataIndex: 'name',
      key: 'name',
      render: (name, record) => (
        <div>
          <div style={{ fontWeight: 600 }}>{name}</div>
          {record.name_en && <div style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>{record.name_en}</div>}
        </div>
      ),
    },
    {
      title: '专辑数',
      dataIndex: 'album_count',
      key: 'album_count',
      width: 80,
      responsive: ['sm'],
    },
    {
      title: '排序',
      dataIndex: 'display_order',
      key: 'display_order',
      width: 80,
      responsive: ['md'],
    },
    {
      title: '描述',
      dataIndex: 'description',
      key: 'description',
      ellipsis: true,
      responsive: ['lg'],
    },
    {
      title: '状态',
      key: 'status',
      width: 140,
      render: (_, record) => (
        <Select
          value={record.status || 'active'}
          options={STATUS_OPTIONS}
          style={{ width: 120 }}
          onChange={(val) => handleStatusChange(record, val)}
        />
      ),
    },
    {
      title: '操作',
      key: 'actions',
      width: 80,
      render: (_, record) => (
        <Button type="link" icon={<EditOutlined />} onClick={() => handleEdit(record)}>
          编辑
        </Button>
      ),
    },
  ];

  const headerActions = (
    <AdminActionBar>
      <Button type="primary" icon={<PlusOutlined />} onClick={handleAdd}>
        添加游戏
      </Button>
    </AdminActionBar>
  );

  return (
    <AdminLayout>
      <AdminPageHeader
        title="游戏管理"
        description="管理游戏基础信息、封面与展示状态。"
        actions={headerActions}
      />
      <Card title="游戏列表">
        {isMobile ? (
          <List
            loading={loading}
            dataSource={games}
            renderItem={(game) => (
              <List.Item>
                <Card style={{ width: '100%' }} bodyStyle={{ padding: 12 }}>
                  <Space align="start" style={{ width: '100%', justifyContent: 'space-between' }}>
                    <Space align="start">
                      {game.cover_path ? (
                        <Image
                          width={56}
                          height={56}
                          src={getCoverUrl(game.cover_path)}
                          preview={false}
                          style={{ borderRadius: 8, objectFit: 'cover' }}
                        />
                      ) : (
                        <div style={{ width: 56, height: 56, borderRadius: 8, background: 'linear-gradient(135deg, #667eea, #764ba2)' }} />
                      )}
                      <div>
                        <div style={{ fontWeight: 600 }}>{game.name}</div>
                        {game.name_en && <div style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>{game.name_en}</div>}
                        <Space size={6} wrap style={{ marginTop: 6 }}>
                          <Tag>{game.album_count || 0} 张专辑</Tag>
                          <Tag>排序 {game.display_order}</Tag>
                        </Space>
                      </div>
                    </Space>
                    <Button size="small" onClick={() => setMobileActionGame(game)}>操作</Button>
                  </Space>
                </Card>
              </List.Item>
            )}
          />
        ) : (
          <Table
            columns={columns}
            dataSource={games}
            rowKey="id"
            loading={loading}
            pagination={false}
          />
        )}
      </Card>

      <Drawer
        title={mobileActionGame ? `操作: ${mobileActionGame.name}` : '操作'}
        open={!!mobileActionGame}
        onClose={() => setMobileActionGame(null)}
        placement="bottom"
        height={260}
      >
        <Space direction="vertical" style={{ width: '100%' }}>
          {mobileActionGame && (
            <Select
              value={mobileActionGame.status || 'active'}
              options={STATUS_OPTIONS}
              style={{ width: '100%' }}
              onChange={(val) => {
                void handleStatusChange(mobileActionGame, val);
                setMobileActionGame((prev) => (prev ? { ...prev, status: val as Game['status'] } : prev));
              }}
            />
          )}
          <Button type="primary" icon={<EditOutlined />} onClick={() => mobileActionGame && handleEdit(mobileActionGame)}>
            编辑游戏
          </Button>
          <Button onClick={() => setMobileActionGame(null)}>关闭</Button>
        </Space>
      </Drawer>

      <Modal
        title={editingGame ? '编辑游戏' : '添加游戏'}
        open={modalVisible}
        onOk={handleSubmit}
        onCancel={() => { setModalVisible(false); form.resetFields(); }}
        okText={editingGame ? '更新' : '创建'}
        cancelText="取消"
        width={520}
      >
        <Form form={form} layout="vertical" style={{ marginTop: 16 }}>
          <Form.Item name="name" label="游戏名称" rules={[{ required: true, message: '请输入游戏名称' }]}>
            <Input placeholder="如：原神" maxLength={100} />
          </Form.Item>
          <Form.Item name="name_en" label="英文名称">
            <Input placeholder="如：Genshin Impact" maxLength={100} />
          </Form.Item>
          <Form.Item name="description" label="描述">
            <TextArea placeholder="游戏简介（可选）" rows={3} maxLength={500} showCount />
          </Form.Item>
          <Space style={{ width: '100%' }} size="large">
            <Form.Item name="display_order" label="排列顺序" extra="数字越小越靠前">
              <InputNumber min={0} style={{ width: 120 }} />
            </Form.Item>
            <Form.Item name="status" label="展示状态">
              <Select options={STATUS_OPTIONS} style={{ width: 130 }} />
            </Form.Item>
          </Space>
        </Form>
      </Modal>
    </AdminLayout>
  );
};

export default GameManagement;

