import React, { useState, useEffect } from 'react';
import { Modal, Select, Alert, Typography, Space } from 'antd';
import { albumService } from '../services/albumService';
import { trackService } from '../services/trackService';

const { Text } = Typography;

interface BulkMoveAlbumModalProps {
  visible: boolean;
  trackIds: number[];
  onClose: () => void;
  onSuccess: () => void;
}

const BulkMoveAlbumModal: React.FC<BulkMoveAlbumModalProps> = ({ visible, trackIds, onClose, onSuccess }) => {
  const [albums, setAlbums] = useState<{ id: number; title: string }[]>([]);
  const [selectedAlbumId, setSelectedAlbumId] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (visible) {
      albumService.getAlbums(1, 200).then(res => setAlbums(res.albums)).catch(console.error);
      setSelectedAlbumId(null);
    }
  }, [visible]);

  const handleOk = async () => {
    setLoading(true);
    try {
      await trackService.bulkMoveTracksToAlbum(trackIds, selectedAlbumId);
      onSuccess();
      onClose();
    } catch (e: any) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const albumOptions = [
    { value: null, label: '（无专辑 / 独立曲目）' },
    ...albums.map(a => ({ value: a.id, label: a.title })),
  ];

  return (
    <Modal
      title={`批量移动专辑（已选 ${trackIds.length} 首曲目）`}
      open={visible}
      onOk={handleOk}
      onCancel={onClose}
      okText="确认移动"
      cancelText="取消"
      confirmLoading={loading}
    >
      <Space direction="vertical" style={{ width: '100%' }} size="middle">
        <Alert
          message={`将把选中的 ${trackIds.length} 首曲目移动到指定专辑`}
          type="info"
          showIcon
        />
        <div>
          <Text strong>目标专辑：</Text>
          <Select
            showSearch
            style={{ width: '100%', marginTop: 8 }}
            placeholder="请选择目标专辑（留空表示无专辑）"
            value={selectedAlbumId}
            onChange={setSelectedAlbumId}
            options={albumOptions}
            filterOption={(input, option) =>
              (option?.label as string)?.toLowerCase().includes(input.toLowerCase())
            }
            allowClear
          />
        </div>
      </Space>
    </Modal>
  );
};

export default BulkMoveAlbumModal;

