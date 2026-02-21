import React, { useEffect, useState } from 'react';
import { Table, Button, message, Space, Image, Modal, Form, Input, Select, DatePicker, Card } from 'antd';
import {
  EditOutlined,
  PictureOutlined,
} from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import { albumService, Album } from '../services/albumService';
import { gameService, Game } from '../services/gameService';
import { useNavigate } from 'react-router-dom';
import dayjs from 'dayjs';
import AlbumCoverUpload from '../components/AlbumCoverUpload';
import AdminLayout from '../components/AdminLayout';

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


  const fetchAlbums = async (page = 1) => {
    setLoading(true);
    try {
      const data = await albumService.getAlbums(page, pagination.pageSize);
      setAlbums(data.albums);
      setPagination({
        ...pagination,
        current: data.pagination.page,
        total: data.pagination.total,
      });
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
        fetchAlbums();
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
    fetchAlbums();
  };

  const getCoverUrl = (coverPath: string) => {
    if (!coverPath) return '';
    if (coverPath.startsWith('http')) return coverPath;
    const baseUrl = import.meta.env.VITE_API_URL?.replace('/api', '') || 'http://localhost:3000';
    return `${baseUrl}${coverPath}`;
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
          src={getCoverUrl(coverPath)}
          style={{ borderRadius: 4, objectFit: 'cover' }}
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
      width: 200,
      render: (_, record) => (
        <Space>
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
            onClick={() => navigate(`/albums/${record.id}`)}
            size="small"
          >
            查看
          </Button>
        </Space>
      ),
    },
  ];

  return (
    <AdminLayout>
      <Card title="专辑管理">
        <Table
          columns={columns}
          dataSource={albums}
          rowKey="id"
          loading={loading}
          pagination={{
            ...pagination,
            showSizeChanger: true,
            showTotal: (total: number) => `共 ${total} 张专辑`,
          }}
          onChange={(newPagination) => {
            fetchAlbums(newPagination.current);
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
    </AdminLayout>
  );
};

export default AlbumManagement;

