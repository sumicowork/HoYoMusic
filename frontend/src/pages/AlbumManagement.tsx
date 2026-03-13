import React, { useEffect, useState } from 'react';
import { Table, Button, message, Space, Image, Modal, Form, Input, Select, DatePicker, Card, InputNumber, List, Popconfirm } from 'antd';
import {
  EditOutlined,
  PictureOutlined,
  AppstoreOutlined,
  CalendarOutlined,
  DatabaseOutlined,
  PlusOutlined,
  DeleteOutlined,
} from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import type { TableRowSelection } from 'antd/es/table/interface';
import { albumService, Album } from '../services/albumService';
import { gameService, Game } from '../services/gameService';
import { discService, Disc } from '../services/discService';
import { useNavigate } from 'react-router-dom';
import dayjs from 'dayjs';
import AlbumCoverUpload from '../components/AlbumCoverUpload';
import AdminLayout from '../components/AdminLayout';
import { getCoverUrl } from '../utils/imageUtils';
import { Track } from '../types';

const AlbumManagement: React.FC = () => {
  const [albums, setAlbums] = useState<Album[]>([]);
  const [games, setGames] = useState<Game[]>([]);
  const [loading, setLoading] = useState(false);
  const [pagination, setPagination] = useState({ current: 1, pageSize: 20, total: 0 });
  const [editingAlbum, setEditingAlbum] = useState<Album | null>(null);
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [coverUploadVisible, setCoverUploadVisible] = useState(false);
  const [selectedAlbumForCover, setSelectedAlbumForCover] = useState<Album | null>(null);
  const [form] = Form.useForm();
  const navigate = useNavigate();

  // Bulk game assignment
  const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([]);
  const [bulkGameModalVisible, setBulkGameModalVisible] = useState(false);
  const [bulkGameId, setBulkGameId] = useState<number | null>(null);

  // Disc management
  const [discModalVisible, setDiscModalVisible] = useState(false);
  const [discAlbum, setDiscAlbum] = useState<Album | null>(null);
  const [discs, setDiscs] = useState<Disc[]>([]);
  const [discLoading, setDiscLoading] = useState(false);
  const [discForm] = Form.useForm();
  const [discTracks, setDiscTracks] = useState<Track[]>([]);
  const [discAssignments, setDiscAssignments] = useState<Record<number, number | null>>({});


  const fetchAlbums = async (page = 1, pageSize?: number) => {
    const size = pageSize ?? pagination.pageSize;
    setLoading(true);
    try {
      const data = await albumService.getAlbums(page, size);
      setAlbums(data.albums);
      setPagination(prev => ({
        ...prev,
        current: data.pagination.page,
        total: data.pagination.total,
        pageSize: size,
      }));
    } catch (error: any) {
      message.error(error.message || '获取专辑列表失败');
    } finally {
      setLoading(false);
    }
  };

  const fetchGames = async () => {
    try {
      const data = await gameService.getGames();
      setGames(data);
    } catch (error: any) {
      message.error(error.message || '获取游戏列表失败');
    }
  };

  useEffect(() => {
    fetchAlbums();
    fetchGames();
  }, []);

  const handleEdit = (album: Album) => {
    setEditingAlbum(album);
    form.setFieldsValue({
      title: album.title,
      game_id: album.game_id,
      release_date: album.release_date ? dayjs(album.release_date) : null,
      notes: album.notes || '',
    });
    setEditModalVisible(true);
  };

  const handleEditSave = async () => {
    try {
      const values = await form.validateFields();
      if (editingAlbum) {
        const updateData = {
          title: values.title,
          game_id: values.game_id || null,
          release_date: values.release_date ? values.release_date.format('YYYY-MM-DD') : null,
          notes: values.notes || null,
        };

        console.log('Updating album with data:', updateData);

        await albumService.updateAlbum(editingAlbum.id, updateData);
        message.success('专辑更新成功！');
        setEditModalVisible(false);
        fetchAlbums(pagination.current);
      }
    } catch (error: any) {
      console.error('Update error:', error);
      message.error(error.message || '更新失败，请重试');
    }
  };

  const handleUploadCover = (album: Album) => {
    setSelectedAlbumForCover(album);
    setCoverUploadVisible(true);
  };

  const handleCoverUploadSuccess = () => {
    message.success('封面更新成功！');
    setCoverUploadVisible(false);
    fetchAlbums(pagination.current);
  };

  const handleRescanDates = async (album: Album) => {
    try {
      const result = await albumService.rescanDates(album.id);
      message.success(result.message || `成功更新发行日期`);
      fetchAlbums(pagination.current);
    } catch (error: any) {
      message.error(error.message || '重新读取日期失败');
    }
  };

  // ── Disc management ──────────────────────
  const handleManageDiscs = async (album: Album) => {
    setDiscAlbum(album);
    setDiscModalVisible(true);
    setDiscLoading(true);
    try {
      const [discData, albumDetail] = await Promise.all([
        discService.getDiscs(album.id),
        albumService.getAlbumById(album.id),
      ]);
      setDiscs(discData);
      const tracks: Track[] = albumDetail.tracks || [];
      setDiscTracks(tracks);
      const map: Record<number, number | null> = {};
      tracks.forEach((t) => {
        map[t.id] = t.disc_id ?? null;
      });
      setDiscAssignments(map);
    } catch (error: any) {
      message.error('获取碟片列表失败');
    } finally {
      setDiscLoading(false);
    }
  };

  const handleAddDisc = async () => {
    try {
      const values = await discForm.validateFields();
      if (!discAlbum) return;
      await discService.createDisc(discAlbum.id, {
        disc_number: values.disc_number,
        disc_title: values.disc_title || undefined,
      });
      message.success('碟片创建成功');
      discForm.resetFields();
      const data = await discService.getDiscs(discAlbum.id);
      setDiscs(data);
    } catch (error: any) {
      message.error(error.message || '创建碟片失败');
    }
  };

  const handleSaveDiscAssignments = async () => {
    try {
      if (!discAlbum) return;
      const assignments = Object.entries(discAssignments).map(([trackId, discId]) => ({
        track_id: Number(trackId),
        disc_id: discId,
      }));
      await discService.bulkAssignTracks(discAlbum.id, assignments);
      message.success('曲目分碟已保存');
      const albumDetail = await albumService.getAlbumById(discAlbum.id);
      const tracks: Track[] = albumDetail.tracks || [];
      setDiscTracks(tracks);
    } catch (error: any) {
      message.error(error.message || '保存曲目分碟失败');
    }
  };

  const handleDeleteDisc = async (discId: number) => {
    try {
      await discService.deleteDisc(discId);
      message.success('碟片已删除');
      if (discAlbum) {
        const data = await discService.getDiscs(discAlbum.id);
        setDiscs(data);
      }
    } catch (error: any) {
      message.error(error.message || '删除碟片失败');
    }
  };

  const columns: ColumnsType<Album> = [
    {
      title: '封面',
      dataIndex: 'cover_path',
      key: 'cover',
      width: 80,
      render: (coverPath) => (
        <Image
          width={50}
          height={50}
          src={getCoverUrl(coverPath, undefined, true)}
          style={{ borderRadius: 4, objectFit: 'cover' }}
          preview={coverPath ? { src: getCoverUrl(coverPath) } : false}
        />
      ),
    },
    {
      title: '标题',
      dataIndex: 'title',
      key: 'title',
      ellipsis: true,
    },
    {
      title: '游戏',
      dataIndex: 'game_id',
      key: 'game_id',
      width: 150,
      render: (gameId) => {
        const game = games.find(g => g.id === gameId);
        return game ? game.name : '-';
      },
    },
    {
      title: '曲目数',
      dataIndex: 'track_count',
      key: 'track_count',
      width: 100,
      render: (count) => `${count || 0} 首`,
    },
    {
      title: '发行日期',
      dataIndex: 'release_date',
      key: 'release_date',
      width: 120,
      render: (date) => date ? new Date(date).getFullYear() : '-',
    },
    {
      title: '操作',
      key: 'actions',
      width: 340,
      render: (_, record) => (
        <Space wrap>
          <Button
            icon={<EditOutlined />}
            onClick={() => handleEdit(record)}
            size="small"
          >
            编辑
          </Button>
          <Button
            icon={<PictureOutlined />}
            onClick={() => handleUploadCover(record)}
            size="small"
          >
            上传封面
          </Button>
          <Button
            icon={<DatabaseOutlined />}
            onClick={() => handleManageDiscs(record)}
            size="small"
          >
            碟片
          </Button>
          <Button
            icon={<CalendarOutlined />}
            onClick={() => handleRescanDates(record)}
            size="small"
          >
            重读日期
          </Button>
          <Button
            onClick={() => navigate(`/albums/${record.id}`)}
            size="small"
          >
            查看
          </Button>
        </Space>
      ),
    },
  ];

  const rowSelection: TableRowSelection<Album> = {
    selectedRowKeys,
    onChange: (keys) => setSelectedRowKeys(keys),
  };

  const handleBulkSetGame = async () => {
    try {
      await albumService.bulkSetGame(selectedRowKeys as number[], bulkGameId);
      message.success(`成功设置 ${selectedRowKeys.length} 张专辑的游戏`);
      setBulkGameModalVisible(false);
      setSelectedRowKeys([]);
      setBulkGameId(null);
      fetchAlbums(pagination.current);
    } catch (error: any) {
      message.error(error.message || '批量设置游戏失败');
    }
  };

  const hasSelection = selectedRowKeys.length > 0;

  return (
    <AdminLayout>
      <Card
        title="专辑管理"
        extra={
          <Space>
            {hasSelection && (
              <Button
                icon={<AppstoreOutlined />}
                onClick={() => setBulkGameModalVisible(true)}
              >
                批量设置游戏 ({selectedRowKeys.length})
              </Button>
            )}
          </Space>
        }
      >
        <Table
          columns={columns}
          dataSource={albums}
          rowKey="id"
          loading={loading}
          rowSelection={rowSelection}
          pagination={{
            ...pagination,
            showSizeChanger: true,
            pageSizeOptions: ['10', '20', '50', '100'],
            showTotal: (total: number) => `共 ${total} 张专辑`,
          }}
          onChange={(newPagination) => {
            const newSize = newPagination.pageSize || pagination.pageSize;
            const newPage = newPagination.pageSize !== pagination.pageSize ? 1 : (newPagination.current || 1);
            fetchAlbums(newPage, newSize);
          }}
        />
      </Card>

      {/* Edit Modal */}
      <Modal
        title="编辑专辑"
        open={editModalVisible}
        onOk={handleEditSave}
        onCancel={() => setEditModalVisible(false)}
        okText="保存"
        cancelText="取消"
        width={600}
      >
        <Form form={form} layout="vertical">
          <Form.Item name="title" label="标题" rules={[{ required: true, message: '请输入专辑标题' }]}>
            <Input />
          </Form.Item>
          <Form.Item name="game_id" label="游戏">
            <Select allowClear placeholder="选择游戏">
              {games.map(game => (
                <Select.Option key={game.id} value={game.id}>
                  {game.name}
                </Select.Option>
              ))}
            </Select>
          </Form.Item>
          <Form.Item name="release_date" label="发行日期">
            <DatePicker style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item name="notes" label="备注">
            <Input.TextArea rows={3} placeholder="专辑备注信息（可选）" maxLength={5000} showCount />
          </Form.Item>
        </Form>
      </Modal>

      {selectedAlbumForCover && (
        <AlbumCoverUpload
          visible={coverUploadVisible}
          albumId={selectedAlbumForCover.id}
          currentCover={selectedAlbumForCover.cover_path}
          onClose={() => {
            setCoverUploadVisible(false);
            setSelectedAlbumForCover(null);
          }}
          onSuccess={handleCoverUploadSuccess}
        />
      )}

      {/* Disc Management Modal */}
      <Modal
        title={discAlbum ? `碟片管理 - ${discAlbum.title}` : '碟片管理'}
        open={discModalVisible}
        onCancel={() => {
          setDiscModalVisible(false);
          setDiscAlbum(null);
          setDiscs([]);
          setDiscTracks([]);
          setDiscAssignments({});
          discForm.resetFields();
        }}
        width={860}
        footer={[
          <Button key="save" type="primary" onClick={handleSaveDiscAssignments} disabled={!discAlbum}>
            保存曲目分碟
          </Button>,
          <Button key="close" onClick={() => setDiscModalVisible(false)}>
            关闭
          </Button>,
        ]}
      >
        <Form form={discForm} layout="inline" style={{ marginBottom: 12 }}>
          <Form.Item
            name="disc_number"
            label="碟号"
            rules={[{ required: true, message: '请输入碟号' }]}
          >
            <InputNumber min={1} style={{ width: 120 }} />
          </Form.Item>
          <Form.Item name="disc_title" label="碟片名称">
            <Input placeholder="例如：Disc 1 / Bonus" style={{ width: 280 }} />
          </Form.Item>
          <Form.Item>
            <Button type="dashed" icon={<PlusOutlined />} onClick={handleAddDisc}>
              添加碟片
            </Button>
          </Form.Item>
        </Form>

        <List
          bordered
          loading={discLoading}
          dataSource={discs}
          locale={{ emptyText: '暂无碟片，可先新增' }}
          style={{ marginBottom: 16 }}
          renderItem={(disc) => (
            <List.Item
              actions={[
                <Popconfirm
                  key="delete"
                  title="删除该碟片？"
                  description="已分配到该碟片的曲目会变为未分配"
                  onConfirm={() => handleDeleteDisc(disc.id)}
                  okText="删除"
                  cancelText="取消"
                >
                  <Button size="small" icon={<DeleteOutlined />} danger>
                    删除
                  </Button>
                </Popconfirm>,
              ]}
            >
              <Space>
                <strong>Disc {disc.disc_number}</strong>
                <span>{disc.disc_title || '未命名碟片'}</span>
              </Space>
            </List.Item>
          )}
        />

        <Table
          rowKey="id"
          size="small"
          pagination={false}
          dataSource={[...discTracks].sort((a, b) => (a.track_number || 9999) - (b.track_number || 9999))}
          columns={[
            { title: '#', dataIndex: 'track_number', width: 70, render: (v: number) => v || '-' },
            { title: '曲目', dataIndex: 'title' },
            {
              title: '分碟',
              width: 220,
              render: (_: any, record: Track) => (
                <Select
                  value={discAssignments[record.id] ?? null}
                  allowClear
                  placeholder="未分配"
                  style={{ width: '100%' }}
                  onChange={(value) => {
                    setDiscAssignments((prev) => ({ ...prev, [record.id]: value ?? null }));
                  }}
                >
                  {discs.map((disc) => (
                    <Select.Option key={disc.id} value={disc.id}>
                      Disc {disc.disc_number}{disc.disc_title ? ` - ${disc.disc_title}` : ''}
                    </Select.Option>
                  ))}
                </Select>
              ),
            },
          ]}
        />
      </Modal>

      {/* Bulk Set Game Modal */}
      <Modal
        title={`批量设置游戏 (${selectedRowKeys.length} 张专辑)`}
        open={bulkGameModalVisible}
        onOk={handleBulkSetGame}
        onCancel={() => { setBulkGameModalVisible(false); setBulkGameId(null); }}
        okText="确定"
        cancelText="取消"
      >
        <Select
          allowClear
          placeholder="选择游戏（清空则取消关联）"
          style={{ width: '100%' }}
          value={bulkGameId}
          onChange={setBulkGameId}
        >
          {games.map(game => (
            <Select.Option key={game.id} value={game.id}>
              {game.name}
            </Select.Option>
          ))}
        </Select>
      </Modal>
    </AdminLayout>
  );
};

export default AlbumManagement;

