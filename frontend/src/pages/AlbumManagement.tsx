import React, { useEffect, useState } from 'react';
import { Table, Button, message, Space, Image, Modal, Form, Input, Select, DatePicker, Card } from 'antd';
import {
  EditOutlined,
  PictureOutlined,
  AppstoreOutlined,
  CalendarOutlined,
} from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import type { TableRowSelection } from 'antd/es/table/interface';
import { albumService, Album } from '../services/albumService';
import { gameService, Game } from '../services/gameService';
import { useNavigate } from 'react-router-dom';
import dayjs from 'dayjs';
import AlbumCoverUpload from '../components/AlbumCoverUpload';
import AdminLayout from '../components/AdminLayout';
import { getCoverUrl } from '../utils/imageUtils';

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
      width: 280,
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

