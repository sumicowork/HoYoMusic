import React, { useState, useEffect } from 'react';
import { Modal, Select, Radio, Space, Alert, Typography } from 'antd';
import { getTags, bulkUpdateTrackTags, Tag } from '../services/tagService';

const { Text } = Typography;

interface BulkTagModalProps {
  visible: boolean;
  trackIds: number[];
  onClose: () => void;
  onSuccess: () => void;
}

const BulkTagModal: React.FC<BulkTagModalProps> = ({ visible, trackIds, onClose, onSuccess }) => {
  const [tags, setTags] = useState<Tag[]>([]);
  const [selectedTagIds, setSelectedTagIds] = useState<number[]>([]);
  const [operation, setOperation] = useState<'add' | 'remove'>('add');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (visible) {
      getTags().then(setTags).catch(console.error);
      setSelectedTagIds([]);
      setOperation('add');
    }
  }, [visible]);

  const handleOk = async () => {
    if (selectedTagIds.length === 0) return;
    setLoading(true);
    try {
      await bulkUpdateTrackTags({
        trackIds,
        addTagIds: operation === 'add' ? selectedTagIds : [],
        removeTagIds: operation === 'remove' ? selectedTagIds : [],
      });
      onSuccess();
      onClose();
    } catch (e: any) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const tagOptions = tags.map(t => ({
    value: t.id,
    label: t.group_name ? `[${t.group_name}] ${t.name}` : t.name,
  }));

  return (
    <Modal
      title={`批量管理标签（已选 ${trackIds.length} 首曲目）`}
      open={visible}
      onOk={handleOk}
      onCancel={onClose}
      okText="确认操作"
      cancelText="取消"
      confirmLoading={loading}
      okButtonProps={{ disabled: selectedTagIds.length === 0 }}
    >
      <Space direction="vertical" style={{ width: '100%' }} size="middle">
        <Alert
          message={`将对选中的 ${trackIds.length} 首曲目执行批量标签操作`}
          type="info"
          showIcon
        />
        <div>
          <Text strong>操作类型：</Text>
          <Radio.Group
            value={operation}
            onChange={e => setOperation(e.target.value)}
            style={{ marginLeft: 12 }}
          >
            <Radio value="add">添加标签</Radio>
            <Radio value="remove">移除标签</Radio>
          </Radio.Group>
        </div>
        <div>
          <Text strong>选择标签：</Text>
          <Select
            mode="multiple"
            style={{ width: '100%', marginTop: 8 }}
            placeholder="请选择要操作的标签"
            value={selectedTagIds}
            onChange={setSelectedTagIds}
            options={tagOptions}
            filterOption={(input, option) =>
              (option?.label as string)?.toLowerCase().includes(input.toLowerCase())
            }
          />
        </div>
      </Space>
    </Modal>
  );
};

export default BulkTagModal;

