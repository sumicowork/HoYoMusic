import React, { useEffect, useState } from 'react';
import {
  Table, Button, message, Space, Image, Tag, Modal, Form, Input, Card,
  DatePicker, InputNumber, Popconfirm
} from 'antd';
import {
  UploadOutlined,
  PlayCircleOutlined,
  DownloadOutlined,
  EditOutlined,
  DeleteOutlined,
  FileTextOutlined,
  TeamOutlined,
  TagsOutlined,
  AppstoreOutlined
} from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import type { TableRowSelection } from 'antd/es/table/interface';
import dayjs from 'dayjs';
import { Track } from '../types';
import { trackService } from '../services/trackService';
import { usePlayerStore } from '../store/playerStore';
import { MUSIC_ICON_PLACEHOLDER } from '../utils/imageUtils';
import LyricsEditor from '../components/LyricsEditor';
import CreditsEditor from '../components/CreditsEditor';
import TrackTagsManager from '../components/TrackTagsManager';
import BulkTagModal from '../components/BulkTagModal';
import BulkMoveAlbumModal from '../components/BulkMoveAlbumModal';
import AdminLayout from '../components/AdminLayout';
import UploadModal from '../components/UploadModal';
import './Admin.css';


const Admin: React.FC = () => {
  const [tracks, setTracks] = useState<Track[]>([]);
  const [loading, setLoading] = useState(false);
  const [uploadModalVisible, setUploadModalVisible] = useState(false);
  const [pagination, setPagination] = useState({ current: 1, pageSize: 20, total: 0 });
  const [editingTrack, setEditingTrack] = useState<Track | null>(null);
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [lyricsEditorVisible, setLyricsEditorVisible] = useState(false);
  const [creditsEditorVisible, setCreditsEditorVisible] = useState(false);
  const [tagsManagerVisible, setTagsManagerVisible] = useState(false);
  const [currentTrackId, setCurrentTrackId] = useState<number | null>(null);
  const [currentTrackTitle, setCurrentTrackTitle] = useState<string>('');
  const [form] = Form.useForm();

  // Bulk operations state
  const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([]);
  const [bulkTagModalVisible, setBulkTagModalVisible] = useState(false);
  const [bulkMoveModalVisible, setBulkMoveModalVisible] = useState(false);

  const { playTrackOnly } = usePlayerStore();

  const fetchTracks = async (page = 1) => {
    setLoading(true);
    try {
      const data = await trackService.getTracks(page, pagination.pageSize);
      setTracks(data.tracks);
      setPagination(prev => ({
        ...prev,
        current: data.pagination.page,
        total: data.pagination.total,
      }));
    } catch (error: any) {
      message.error(error.message || '获取曲目列表失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTracks();
  }, []);

  const handlePlay = (track: Track) => {
    playTrackOnly(track);
  };

  const handleDownload = (track: Track) => {
    window.open(trackService.getDownloadUrl(track.id), '_blank');
  };

  const handleEdit = (track: Track) => {
    setEditingTrack(track);
    form.setFieldsValue({
      title: track.title,
      artists: track.artists.map(a => a.name).join(', '),
      album_title: track.album_title,
      release_date: track.release_date ? dayjs(track.release_date) : null,
      track_number: (track as any).track_number || null,
    });
    setEditModalVisible(true);
  };

  const handleEditSave = async () => {
    try {
      const values = await form.validateFields();
      if (editingTrack) {
        await trackService.updateTrack(editingTrack.id, {
          title: values.title,
          artists: values.artists.split(',').map((a: string) => a.trim()),
          album_title: values.album_title || '',
          release_date: values.release_date ? values.release_date.format('YYYY-MM-DD') : undefined,
          track_number: values.track_number || undefined,
        });
        message.success('曲目信息已更新');
        setEditModalVisible(false);
        fetchTracks();
      }
    } catch (error: any) {
      message.error(error.message || '更新失败');
    }
  };

  const handleDelete = (track: Track) => {
    Modal.confirm({
      title: '删除曲目',
      content: `确定要删除「${track.title}」吗？此操作不可撤销。`,
      okText: '删除',
      okType: 'danger',
      cancelText: '取消',
      onOk: async () => {
        try {
          await trackService.deleteTrack(track.id);
          message.success('曲目已删除');
          fetchTracks();
        } catch (error: any) {
          message.error(error.message || '删除失败');
        }
      },
    });
  };

  const handleBulkDelete = async () => {
    try {
      await trackService.bulkDeleteTracks(selectedRowKeys as number[]);
      message.success(`成功删除 ${selectedRowKeys.length} 首曲目`);
      setSelectedRowKeys([]);
      fetchTracks();
    } catch (error: any) {
      message.error(error.message || '批量删除失败');
    }
  };

  const formatDuration = (seconds: number | null) => {
    if (!seconds) return '--:--';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const formatFileSize = (bytes: number | null) => {
    if (!bytes) return '--';
    const mb = bytes / (1024 * 1024);
    return `${mb.toFixed(2)} MB`;
  };

  const rowSelection: TableRowSelection<Track> = {
    selectedRowKeys,
    onChange: (keys) => setSelectedRowKeys(keys),
  };

  const columns: ColumnsType<Track> = [
    {
      title: '封面',
      dataIndex: 'cover_path',
      key: 'cover',
      width: 80,
      render: (coverPath, record) => {
        const src = coverPath
          ? trackService.getCoverUrl(coverPath)
          : record.album_cover
            ? trackService.getCoverUrl(record.album_cover)
            : undefined;
        return (
          <Image
            width={50}
            height={50}
            src={src}
            fallback={MUSIC_ICON_PLACEHOLDER}
            style={{ borderRadius: 4, objectFit: 'cover' }}
          />
        );
      },
    },
    {
      title: '标题',
      dataIndex: 'title',
      key: 'title',
      ellipsis: true,
    },
    {
      title: '艺术家',
      dataIndex: 'artists',
      key: 'artists',
      render: (artists: any[]) => artists.map((a) => a.name).join(', '),
    },
    {
      title: '专辑',
      dataIndex: 'album_title',
      key: 'album',
      ellipsis: true,
    },
    {
      title: '时长',
      dataIndex: 'duration',
      key: 'duration',
      width: 100,
      render: formatDuration,
    },
    {
      title: '音质',
      key: 'quality',
      width: 150,
      render: (_, record) => (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          <Tag color="blue">FLAC</Tag>
          {record.sample_rate && record.bit_depth && (
            <span style={{ fontSize: 12, color: '#888' }}>
              {(record.sample_rate / 1000).toFixed(1)}kHz / {record.bit_depth}bit
            </span>
          )}
        </div>
      ),
    },
    {
      title: '大小',
      dataIndex: 'file_size',
      key: 'size',
      width: 120,
      render: formatFileSize,
    },
    {
      title: '操作',
      key: 'actions',
      width: 280,
      render: (_, record) => (
        <Space wrap>
          <Button
            type="primary"
            icon={<PlayCircleOutlined />}
            onClick={() => handlePlay(record)}
            size="small"
          >
            播放
          </Button>
          <Button
            icon={<EditOutlined />}
            onClick={() => handleEdit(record)}
            size="small"
          >
            编辑
          </Button>
          <Button
            icon={<FileTextOutlined />}
            onClick={() => {
              setCurrentTrackId(record.id);
              setLyricsEditorVisible(true);
            }}
            size="small"
          >
            歌词
          </Button>
          <Button
            icon={<TeamOutlined />}
            onClick={() => {
              setCurrentTrackId(record.id);
              setCreditsEditorVisible(true);
            }}
            size="small"
          >
            制作人员
          </Button>
          <Button
            icon={<TagsOutlined />}
            onClick={() => {
              setCurrentTrackId(record.id);
              setCurrentTrackTitle(record.title);
              setTagsManagerVisible(true);
            }}
            size="small"
          >
            标签
          </Button>
          <Button
            icon={<DownloadOutlined />}
            onClick={() => handleDownload(record)}
            size="small"
          />
          <Button
            danger
            icon={<DeleteOutlined />}
            onClick={() => handleDelete(record)}
            size="small"
          />
        </Space>
      ),
    },
  ];

  const hasSelection = selectedRowKeys.length > 0;

  return (
    <AdminLayout>
      <Card
        title="曲目管理"
        extra={
          <Space>
            {hasSelection && (
              <>
                <Button
                  icon={<TagsOutlined />}
                  onClick={() => setBulkTagModalVisible(true)}
                >
                  批量打标签 ({selectedRowKeys.length})
                </Button>
                <Button
                  icon={<AppstoreOutlined />}
                  onClick={() => setBulkMoveModalVisible(true)}
                >
                  批量移动专辑 ({selectedRowKeys.length})
                </Button>
                <Popconfirm
                  title={`确定删除选中的 ${selectedRowKeys.length} 首曲目吗？`}
                  description="此操作不可撤销"
                  onConfirm={handleBulkDelete}
                  okText="删除"
                  cancelText="取消"
                  okType="danger"
                >
                  <Button danger>
                    批量删除 ({selectedRowKeys.length})
                  </Button>
                </Popconfirm>
              </>
            )}
            <Button
              type="primary"
              icon={<UploadOutlined />}
              onClick={() => setUploadModalVisible(true)}
            >
              上传音乐
            </Button>
          </Space>
        }
      >
        <Table
          columns={columns}
          dataSource={tracks}
          rowKey="id"
          loading={loading}
          rowSelection={rowSelection}
          pagination={{
            ...pagination,
            showSizeChanger: true,
            showTotal: (total: number) => `共 ${total} 首曲目`,
          }}
          onChange={(newPagination) => {
            fetchTracks(newPagination.current);
          }}
        />
      </Card>

      {/* Edit Modal */}
      <Modal
        title="编辑曲目信息"
        open={editModalVisible}
        onOk={handleEditSave}
        onCancel={() => setEditModalVisible(false)}
        okText="保存"
        cancelText="取消"
      >
        <Form form={form} layout="vertical">
          <Form.Item name="title" label="标题" rules={[{ required: true, message: '请输入标题' }]}>
            <Input />
          </Form.Item>
          <Form.Item name="artists" label="艺术家" rules={[{ required: true, message: '请输入艺术家' }]}>
            <Input placeholder="多个艺术家用逗号分隔" />
          </Form.Item>
          <Form.Item name="album_title" label="专辑">
            <Input />
          </Form.Item>
          <Form.Item name="release_date" label="发行日期">
            <DatePicker style={{ width: '100%' }} placeholder="选择发行日期" />
          </Form.Item>
          <Form.Item name="track_number" label="曲目编号">
            <InputNumber min={1} style={{ width: '100%' }} placeholder="曲目编号" />
          </Form.Item>
        </Form>
      </Modal>

      {/* Lyrics Editor */}
      {currentTrackId && (
        <LyricsEditor
          trackId={currentTrackId}
          visible={lyricsEditorVisible}
          onClose={() => setLyricsEditorVisible(false)}
          onSuccess={() => {
            message.success('歌词已更新');
          }}
        />
      )}

      {/* Credits Editor */}
      {currentTrackId && (
        <CreditsEditor
          trackId={currentTrackId}
          visible={creditsEditorVisible}
          onClose={() => setCreditsEditorVisible(false)}
          onSuccess={() => {
            message.success('制作人员信息已更新');
          }}
        />
      )}

      {/* Tags Manager */}
      {currentTrackId && (
        <TrackTagsManager
          trackId={currentTrackId}
          trackTitle={currentTrackTitle}
          visible={tagsManagerVisible}
          onClose={() => setTagsManagerVisible(false)}
          onTagsUpdated={() => {
            message.success('标签已更新');
            fetchTracks(pagination.current);
          }}
        />
      )}

      {/* Upload Modal */}
      <UploadModal
        visible={uploadModalVisible}
        onClose={() => setUploadModalVisible(false)}
        onSuccess={() => {
          setUploadModalVisible(false);
          fetchTracks();
        }}
      />

      {/* Bulk Tag Modal */}
      <BulkTagModal
        visible={bulkTagModalVisible}
        trackIds={selectedRowKeys as number[]}
        onClose={() => setBulkTagModalVisible(false)}
        onSuccess={() => {
          message.success('批量标签操作成功');
          setBulkTagModalVisible(false);
          fetchTracks(pagination.current);
        }}
      />

      {/* Bulk Move Album Modal */}
      <BulkMoveAlbumModal
        visible={bulkMoveModalVisible}
        trackIds={selectedRowKeys as number[]}
        onClose={() => setBulkMoveModalVisible(false)}
        onSuccess={() => {
          message.success('批量移动专辑成功');
          setBulkMoveModalVisible(false);
          fetchTracks(pagination.current);
        }}
      />
    </AdminLayout>
  );
};

export default Admin;

