import React from 'react';
import { Modal, Typography, Space } from 'antd';

const { Text } = Typography;

interface ShortcutItem {
  keys: string;
  description: string;
}

const shortcuts: ShortcutItem[] = [
  { keys: 'Space', description: '播放 / 暂停' },
  { keys: '← / →', description: '快退 / 快进 5 秒' },
  { keys: '↑ / ↓', description: '音量增 / 减' },
  { keys: 'M', description: '静音 / 恢复' },
  { keys: 'L', description: '循环模式切换' },
  { keys: 'Escape', description: '收起播放器' },
];

interface Props {
  open: boolean;
  onClose: () => void;
}

const KeyboardShortcutsModal: React.FC<Props> = ({ open, onClose }) => (
  <Modal
    title="⌨️ 键盘快捷键"
    open={open}
    onCancel={onClose}
    footer={null}
    width={360}
  >
    <Space direction="vertical" style={{ width: '100%' }} size="small">
      {shortcuts.map((s) => (
        <div key={s.keys} style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0' }}>
          <Text keyboard style={{ minWidth: 80 }}>{s.keys}</Text>
          <Text type="secondary">{s.description}</Text>
        </div>
      ))}
    </Space>
  </Modal>
);

export default KeyboardShortcutsModal;

