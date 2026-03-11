import React, { useState, useEffect, useCallback } from 'react';
import { Card, Row, Col, Button, Modal, Input, Typography, Empty, message, Space, Switch } from 'antd';
import { PlusOutlined, PlayCircleOutlined, DeleteOutlined, UnorderedListOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import playlistService, { Playlist } from '../services/playlistService';

const { Title, Text } = Typography;

const Playlists: React.FC = () => {
  const [playlists, setPlaylists] = useState<Playlist[]>([]);
  const [loading, setLoading] = useState(true);
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [newName, setNewName] = useState('');
  const [newDesc, setNewDesc] = useState('');
  const [newPublic, setNewPublic] = useState(false);
  const navigate = useNavigate();

  const loadPlaylists = useCallback(async () => {
    setLoading(true);
    try {
      const data = await playlistService.getPlaylists();
      setPlaylists(data);
    } catch {
      message.error('加载播放列表失败');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadPlaylists(); }, [loadPlaylists]);

  const handleCreate = async () => {
    if (!newName.trim()) return message.warning('请输入名称');
    try {
      await playlistService.createPlaylist(newName, newDesc, newPublic);
      message.success('创建成功');
      setCreateModalOpen(false);
      setNewName('');
      setNewDesc('');
      setNewPublic(false);
      loadPlaylists();
    } catch {
      message.error('创建失败');
    }
  };

  const handleDelete = async (id: number, e: React.MouseEvent) => {
    e.stopPropagation();
    Modal.confirm({
      title: '确认删除',
      content: '删除后无法恢复',
      onOk: async () => {
        try {
          await playlistService.deletePlaylist(id);
          message.success('已删除');
          loadPlaylists();
        } catch {
          message.error('删除失败');
        }
      },
    });
  };

  const fmtDuration = (s: number) => {
    const h = Math.floor(s / 3600);
    const m = Math.floor((s % 3600) / 60);
    return h > 0 ? `${h}小时${m}分钟` : `${m}分钟`;
  };

  return (
    <div style={{ padding: 24 }}>
      <Space style={{ marginBottom: 16 }} align="center">
        <UnorderedListOutlined style={{ fontSize: 24 }} />
        <Title level={3} style={{ margin: 0 }}>播放列表</Title>
        <Button type="primary" icon={<PlusOutlined />} onClick={() => setCreateModalOpen(true)}>
          新建
        </Button>
      </Space>

      {playlists.length === 0 && !loading ? (
        <Empty description="还没有播放列表" />
      ) : (
        <Row gutter={[16, 16]}>
          {playlists.map(p => (
            <Col key={p.id} xs={24} sm={12} md={8} lg={6}>
              <Card
                hoverable
                onClick={() => navigate(`/playlists/${p.id}`)}
                actions={[
                  <PlayCircleOutlined key="play" />,
                  <DeleteOutlined key="delete" onClick={(e) => handleDelete(p.id, e)} />,
                ]}
              >
                <Card.Meta
                  title={p.name}
                  description={
                    <Space direction="vertical" size={0}>
                      <Text type="secondary">{p.track_count} 首 · {fmtDuration(p.total_duration)}</Text>
                      {p.description && <Text type="secondary" ellipsis>{p.description}</Text>}
                    </Space>
                  }
                />
              </Card>
            </Col>
          ))}
        </Row>
      )}

      <Modal
        title="新建播放列表"
        open={createModalOpen}
        onOk={handleCreate}
        onCancel={() => setCreateModalOpen(false)}
      >
        <Space direction="vertical" style={{ width: '100%' }} size="middle">
          <Input placeholder="播放列表名称" value={newName} onChange={e => setNewName(e.target.value)} />
          <Input.TextArea placeholder="描述（可选）" value={newDesc} onChange={e => setNewDesc(e.target.value)} rows={2} />
          <Space>
            <Switch checked={newPublic} onChange={setNewPublic} />
            <Text>公开</Text>
          </Space>
        </Space>
      </Modal>
    </div>
  );
};

export default Playlists;

