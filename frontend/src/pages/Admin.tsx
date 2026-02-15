import React, { useEffect, useState } from 'react';
import { Table, Button, Upload, message, Space, Image, Tag, Modal, Form, Input, Card } from 'antd';
import {
  UploadOutlined,
  PlayCircleOutlined,
  DownloadOutlined,
  EditOutlined,
  DeleteOutlined,
  FileTextOutlined,
  TeamOutlined,
  TagsOutlined
} from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import { Track } from '../types';
import { trackService } from '../services/trackService';
import { usePlayerStore } from '../store/playerStore';
import { MUSIC_ICON_PLACEHOLDER } from '../utils/imageUtils';
import LyricsEditor from '../components/LyricsEditor';
import CreditsEditor from '../components/CreditsEditor';
import TrackTagsManager from '../components/TrackTagsManager';
import AdminLayout from '../components/AdminLayout';
import './Admin.css';


const Admin: React.FC = () => {
  const [tracks, setTracks] = useState<Track[]>([]);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [pagination, setPagination] = useState({ current: 1, pageSize: 20, total: 0 });
  const [editingTrack, setEditingTrack] = useState<Track | null>(null);
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [lyricsEditorVisible, setLyricsEditorVisible] = useState(false);
  const [creditsEditorVisible, setCreditsEditorVisible] = useState(false);
  const [tagsManagerVisible, setTagsManagerVisible] = useState(false);
  const [currentTrackId, setCurrentTrackId] = useState<number | null>(null);
  const [currentTrackTitle, setCurrentTrackTitle] = useState<string>('');
  const [fileList, setFileList] = useState<any[]>([]);
  const [form] = Form.useForm();

  const { playTrackOnly } = usePlayerStore();

  const fetchTracks = async (page = 1) => {
    setLoading(true);
    try {
      const data = await trackService.getTracks(page, pagination.pageSize);
      setTracks(data.tracks);
      setPagination({
        ...pagination,
        current: data.pagination.page,
        total: data.pagination.total,
      });
    } catch (error: any) {
      message.error(error.message || 'Failed to fetch tracks');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTracks();
  }, []);

  const handleBeforeUpload = (file: any) => {
    // 阻止自动上传，只添加到文件列表
    return false;
  };

  const handleFileChange = (info: any) => {
    // 只更新文件列表，不触发上传
    setFileList(info.fileList);
  };

  const handleStartUpload = async () => {
    if (fileList.length === 0) {
      message.warning('Please select files first');
      return;
    }

    if (uploading) {
      return;
    }

    setUploading(true);
    try {
      const files = fileList.map((f: any) => f.originFileObj || f);
      await trackService.uploadTracks(files);
      message.success(`${fileList.length} track(s) uploaded successfully`);

      // 清空文件列表
      setFileList([]);

      fetchTracks();
    } catch (error: any) {
      message.error(error.message || 'Upload failed');
    } finally {
      setUploading(false);
    }
  };

  const handlePlay = (track: Track) => {
    // Only add this single track to queue
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
        });
        message.success('Track updated successfully');
        setEditModalVisible(false);
        fetchTracks();
      }
    } catch (error: any) {
      message.error(error.message || 'Update failed');
    }
  };

  const handleDelete = (track: Track) => {
    Modal.confirm({
      title: 'Delete Track',
      content: `Are you sure you want to delete "${track.title}"?`,
      okText: 'Delete',
      okType: 'danger',
      onOk: async () => {
        try {
          await trackService.deleteTrack(track.id);
          message.success('Track deleted successfully');
          fetchTracks();
        } catch (error: any) {
          message.error(error.message || 'Delete failed');
        }
      },
    });
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

  const columns: ColumnsType<Track> = [
    {
      title: 'Cover',
      dataIndex: 'cover_path',
      key: 'cover',
      width: 80,
      render: (coverPath) => (
        <Image
          width={50}
          height={50}
          src={trackService.getCoverUrl(coverPath)}
          fallback={MUSIC_ICON_PLACEHOLDER}
          style={{ borderRadius: 4, objectFit: 'cover' }}
        />
      ),
    },
    {
      title: 'Title',
      dataIndex: 'title',
      key: 'title',
      ellipsis: true,
    },
    {
      title: 'Artist',
      dataIndex: 'artists',
      key: 'artists',
      render: (artists: any[]) => artists.map((a) => a.name).join(', '),
    },
    {
      title: 'Album',
      dataIndex: 'album_title',
      key: 'album',
      ellipsis: true,
    },
    {
      title: 'Duration',
      dataIndex: 'duration',
      key: 'duration',
      width: 100,
      render: formatDuration,
    },
    {
      title: 'Quality',
      key: 'quality',
      width: 150,
      render: (_, record) => (
        <Space direction="vertical" size={0}>
          <Tag color="blue">FLAC</Tag>
          {record.sample_rate && record.bit_depth && (
            <span style={{ fontSize: 12, color: '#888' }}>
              {(record.sample_rate / 1000).toFixed(1)}kHz / {record.bit_depth}bit
            </span>
          )}
        </Space>
      ),
    },
    {
      title: 'Size',
      dataIndex: 'file_size',
      key: 'size',
      width: 120,
      render: formatFileSize,
    },
    {
      title: 'Actions',
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
            Play
          </Button>
          <Button
            icon={<EditOutlined />}
            onClick={() => handleEdit(record)}
            size="small"
          >
            Edit
          </Button>
          <Button
            icon={<FileTextOutlined />}
            onClick={() => {
              setCurrentTrackId(record.id);
              setLyricsEditorVisible(true);
            }}
            size="small"
          >
            Lyrics
          </Button>
          <Button
            icon={<TeamOutlined />}
            onClick={() => {
              setCurrentTrackId(record.id);
              setCreditsEditorVisible(true);
            }}
            size="small"
          >
            Credits
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
            Tags
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

  return (
    <AdminLayout>
      <Card
        title="Track Management"
        extra={
          <Space>
            <Upload
              beforeUpload={handleBeforeUpload}
              onChange={handleFileChange}
              fileList={fileList}
              multiple
              accept=".flac"
              showUploadList={false}
            >
              <Button icon={<UploadOutlined />}>
                Select Files {fileList.length > 0 && `(${fileList.length})`}
              </Button>
            </Upload>
            {fileList.length > 0 && (
              <Button
                type="primary"
                loading={uploading}
                onClick={handleStartUpload}
              >
                Upload {fileList.length} File(s)
              </Button>
            )}
          </Space>
        }
      >
        <Table
          columns={columns}
          dataSource={tracks}
          rowKey="id"
          loading={loading}
          pagination={{
            ...pagination,
            showSizeChanger: true,
            showTotal: (total: number) => `Total ${total} tracks`,
          }}
          onChange={(newPagination) => {
            fetchTracks(newPagination.current);
          }}
        />
      </Card>

      {/* Edit Modal */}
      <Modal
        title="Edit Track"
        open={editModalVisible}
        onOk={handleEditSave}
        onCancel={() => setEditModalVisible(false)}
        okText="Save"
      >
        <Form form={form} layout="vertical">
          <Form.Item name="title" label="Title" rules={[{ required: true }]}>
            <Input />
          </Form.Item>
          <Form.Item name="artists" label="Artists" rules={[{ required: true }]}>
            <Input placeholder="Separate multiple artists with comma" />
          </Form.Item>
          <Form.Item name="album_title" label="Album">
            <Input />
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
            message.success('Lyrics updated successfully');
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
            message.success('Credits updated successfully');
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
            message.success('Tags updated successfully');
            fetchTracks(pagination.current);
          }}
        />
      )}
    </AdminLayout>
  );
};

export default Admin;

