import React from 'react';
import { Modal, Button, Slider, Select, Switch, Typography, Space } from 'antd';
import { SlidersOutlined } from '@ant-design/icons';
import { useEqualizerStore, EQ_PRESETS } from '../store/equalizerStore';
import './EqualizerControl.css';

const { Text } = Typography;

const bandLabels = ['31', '62', '125', '250', '500', '1K', '2K', '4K', '8K', '16K'];

const EqualizerControl: React.FC = () => {
  const [open, setOpen] = React.useState(false);
  const { enabled, presetName, gains, setEnabled, setPreset, setGain } = useEqualizerStore();

  return (
    <>
      <Button
        type="text"
        size="small"
        icon={<SlidersOutlined />}
        onClick={() => setOpen(true)}
        style={{
          fontSize: 12,
          color: enabled ? '#1890ff' : undefined,
        }}
        title="均衡器"
      >
        {enabled ? 'EQ' : ''}
      </Button>

      <Modal
        title={
          <Space>
            <SlidersOutlined />
            <span>均衡器</span>
            <Switch
              checked={enabled}
              onChange={setEnabled}
              size="small"
              checkedChildren="开"
              unCheckedChildren="关"
            />
          </Space>
        }
        open={open}
        onCancel={() => setOpen(false)}
        footer={null}
        width={520}
        className="equalizer-modal"
        centered
      >
        <div className="eq-preset-row">
          <Text type="secondary" style={{ fontSize: 12 }}>预设：</Text>
          <Select
            value={presetName}
            onChange={setPreset}
            size="small"
            style={{ width: 120 }}
            disabled={!enabled}
            options={[
              ...EQ_PRESETS.map((p) => ({ value: p.name, label: p.label })),
              ...(presetName === 'custom' ? [{ value: 'custom', label: '自定义' }] : []),
            ]}
          />
        </div>

        <div className="eq-sliders">
          {gains.map((gain, i) => (
            <div key={i} className="eq-band">
              <div className="eq-band-value">{gain > 0 ? `+${gain}` : gain}</div>
              <Slider
                vertical
                min={-12}
                max={12}
                step={1}
                value={gain}
                onChange={(v) => setGain(i, v)}
                disabled={!enabled}
                className="eq-band-slider"
                tooltip={{ formatter: (v) => `${(v ?? 0) > 0 ? '+' : ''}${v ?? 0} dB` }}
              />
              <div className="eq-band-label">{bandLabels[i]}</div>
            </div>
          ))}
        </div>

        <div className="eq-footer">
          <Text type="secondary" style={{ fontSize: 11 }}>
            Hz — 调节各频段增益（-12 ~ +12 dB）
          </Text>
        </div>
      </Modal>
    </>
  );
};

export default EqualizerControl;


