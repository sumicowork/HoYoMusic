import React, { useEffect, useMemo, useState } from 'react';
import { Alert, Button, Divider, Empty, Form, Input, List, Modal, Select, Space, Switch, Tag, Typography, message } from 'antd';
import { PlusOutlined, ReloadOutlined } from '@ant-design/icons';
import playlistService, { type Playlist } from '../services/playlistService';

const { Text } = Typography;

interface PlaylistPickerModalProps {
  open: boolean;
  onCancel: () => void;
  onSubmit: (playlistId: number) => Promise<void>;
  title?: string;
}

const fmtDuration = (seconds: number): string => {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  return h > 0 ? `${h}小时${m}分钟` : `${m}分钟`;
};

const PlaylistPickerModal: React.FC<PlaylistPickerModalProps> = ({ open, onCancel, onSubmit, title = '收藏到歌单' }) => {
  const [playlists, setPlaylists] = useState<Playlist[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [creating, setCreating] = useState(false);
  const [selectedPlaylistId, setSelectedPlaylistId] = useState<number | null>(null);
  const [createForm] = Form.useForm<{ name: string; description: string; isPublic: boolean }>();

  const selectedPlaylist = useMemo(
    () => playlists.find((item) => item.id === selectedPlaylistId) || null,
    [playlists, selectedPlaylistId]
  );

  const loadPlaylists = async () => {
    setLoading(true);
    try {
      const data = await playlistService.getPlaylists();
      setPlaylists(data);
      if (data.length > 0 && !selectedPlaylistId) {
        setSelectedPlaylistId(data[0].id);
      }
    } catch {
      message.error('加载歌单失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!open) {
      setSelectedPlaylistId(null);
      createForm.resetFields();
      return;
    }
    void loadPlaylists();
  }, [open]);

  const handleCreate = async () => {
    try {
      const values = await createForm.validateFields();
      setCreating(true);
      const created = await playlistService.createPlaylist(
        values.name.trim(),
        values.description?.trim() || undefined,
        Boolean(values.isPublic)
      );
      await loadPlaylists();
      setSelectedPlaylistId(created.id);
      createForm.resetFields();
      message.success('新歌单已创建并自动选中');
    } catch (error: any) {
      if (!error?.errorFields) {
        message.error(error?.message || '创建歌单失败');
      }
    } finally {
      setCreating(false);
    }
  };

  const handleSubmit = async () => {
    if (!selectedPlaylistId) {
      message.warning('请先选择目标歌单');
      return;
    }
    setSaving(true);
    try {
      await onSubmit(selectedPlaylistId);
      onCancel();
    } catch {
      // parent handles specific errors
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      title={title}
      open={open}
      onCancel={onCancel}
      onOk={() => void handleSubmit()}
      okText="添加到歌单"
      cancelText="取消"
      confirmLoading={saving}
      width={560}
      destroyOnHidden
    >
      <Space direction="vertical" style={{ width: '100%' }} size={14}>
        <Alert
          type="info"
          showIcon
          message="选择一个已有歌单，或在弹窗内直接创建新歌单。"
        />

        <Space.Compact style={{ width: '100%' }}>
          <Select
            style={{ width: '100%' }}
            placeholder="选择目标歌单"
            loading={loading}
            value={selectedPlaylistId ?? undefined}
            onChange={(value) => setSelectedPlaylistId(value)}
            options={playlists.map((playlist) => ({
              value: playlist.id,
              label: `${playlist.name} · ${playlist.track_count} 首`,
            }))}
            showSearch
            optionFilterProp="label"
          />
          <Button icon={<ReloadOutlined />} onClick={() => void loadPlaylists()} loading={loading} />
        </Space.Compact>

        {selectedPlaylist ? (
          <List
            size="small"
            bordered
            dataSource={[selectedPlaylist]}
            renderItem={(playlist) => (
              <List.Item>
                <Space direction="vertical" size={2} style={{ width: '100%' }}>
                  <Space>
                    <Text strong>{playlist.name}</Text>
                    {playlist.is_public ? <Tag color="blue">公开</Tag> : <Tag>私有</Tag>}
                  </Space>
                  <Text type="secondary" style={{ fontSize: 12 }}>
                    {playlist.track_count} 首 · {fmtDuration(playlist.total_duration)}
                  </Text>
                  {playlist.description ? (
                    <Text type="secondary" style={{ fontSize: 12 }}>{playlist.description}</Text>
                  ) : null}
                </Space>
              </List.Item>
            )}
          />
        ) : (
          <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="暂无可用歌单，请先新建一个" />
        )}

        <Divider style={{ margin: '4px 0' }} />

        <Form
          form={createForm}
          layout="vertical"
          initialValues={{ isPublic: false }}
          onFinish={() => void handleCreate()}
        >
          <Space direction="vertical" style={{ width: '100%' }} size={8}>
            <Text strong>新建歌单</Text>
            <Form.Item
              name="name"
              rules={[{ required: true, message: '请输入歌单名称' }, { max: 100, message: '最多 100 字符' }]}
              style={{ marginBottom: 0 }}
            >
              <Input placeholder="例如：夜间循环 / 游戏战斗曲" maxLength={100} />
            </Form.Item>
            <Form.Item name="description" style={{ marginBottom: 0 }}>
              <Input.TextArea rows={2} placeholder="歌单描述（可选）" maxLength={500} />
            </Form.Item>
            <Form.Item name="isPublic" valuePropName="checked" style={{ marginBottom: 0 }}>
              <Switch checkedChildren="公开" unCheckedChildren="私有" />
            </Form.Item>
            <Button
              icon={<PlusOutlined />}
              loading={creating}
              onClick={() => void createForm.submit()}
              block
            >
              创建并选中
            </Button>
          </Space>
        </Form>
      </Space>
    </Modal>
  );
};

export default PlaylistPickerModal;

