import React, { useState, useCallback } from 'react';
import {
  Modal, Button, Upload, Typography, Table, Tag, Alert, Space, Select,
  Divider, Result, Spin, Tooltip,
} from 'antd';
import {
  CheckCircleOutlined, CloseCircleOutlined,
  WarningOutlined, MinusCircleOutlined, FileTextOutlined, ImportOutlined,
} from '@ant-design/icons';
import axios from 'axios';

const { Dragger } = Upload;
const { Text } = Typography;

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000/api';

// ── Types ─────────────────────────────────────────────────────────────────────
interface ImportCreditEntry {
  key: string;
  value: string;
  order?: number;
}

interface ImportTrackEntry {
  album: string;
  track: string;
  conflict_mode?: 'append' | 'overwrite' | 'skip';
  credits: ImportCreditEntry[];
}

interface ImportFile {
  version?: string;
  conflict_mode?: 'append' | 'overwrite' | 'skip';
  tracks: ImportTrackEntry[];
}

type ImportResultStatus = 'imported' | 'skipped' | 'not_found' | 'ambiguous' | 'error';

interface ImportResultItem {
  album: string;
  track: string;
  status: ImportResultStatus;
  imported_count?: number;
  message?: string;
}

interface ImportSummary {
  total: number;
  imported: number;
  skipped: number;
  not_found: number;
  ambiguous: number;
  error: number;
}

interface CreditsImportModalProps {
  visible: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

// ── Helpers ───────────────────────────────────────────────────────────────────
const STATUS_TAG: Record<ImportResultStatus, { color: string; label: string; icon: React.ReactNode }> = {
  imported:  { color: 'success', label: '已导入',   icon: <CheckCircleOutlined /> },
  skipped:   { color: 'default', label: '已跳过',   icon: <MinusCircleOutlined /> },
  not_found: { color: 'warning', label: '未找到',   icon: <WarningOutlined /> },
  ambiguous: { color: 'orange',  label: '匹配歧义', icon: <WarningOutlined /> },
  error:     { color: 'error',   label: '错误',     icon: <CloseCircleOutlined /> },
};

const CONFLICT_OPTIONS = [
  { value: 'append',    label: 'Append（追加，不清除旧数据）' },
  { value: 'overwrite', label: 'Overwrite（清除旧数据后写入）' },
  { value: 'skip',      label: 'Skip（该曲目已有 credits 则跳过）' },
];

// ── Component ─────────────────────────────────────────────────────────────────
const CreditsImportModal: React.FC<CreditsImportModalProps> = ({ visible, onClose, onSuccess }) => {
  const [step, setStep] = useState<0 | 1 | 2>(0);   // 0=选文件, 1=预览, 2=结果
  const [parsedData, setParsedData] = useState<ImportFile | null>(null);
  const [parseError, setParseError] = useState<string | null>(null);
  const [fileRef, setFileRef] = useState<File | null>(null);
  const [globalConflictMode, setGlobalConflictMode] = useState<'append' | 'overwrite' | 'skip'>('append');
  const [submitting, setSubmitting] = useState(false);
  const [results, setResults] = useState<ImportResultItem[]>([]);
  const [summary, setSummary] = useState<ImportSummary | null>(null);

  const resetAll = () => {
    setStep(0);
    setParsedData(null);
    setParseError(null);
    setFileRef(null);
    setGlobalConflictMode('append');
    setSubmitting(false);
    setResults([]);
    setSummary(null);
  };

  const handleClose = () => {
    resetAll();
    onClose();
  };

  // Parse selected JSON file
  const handleFileSelect = useCallback((file: File) => {
    setParseError(null);
    setFileRef(file);
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const json: ImportFile = JSON.parse(e.target?.result as string);
        if (!Array.isArray(json.tracks) || json.tracks.length === 0) {
          setParseError('文件格式错误：缺少 tracks 数组或数组为空');
          setParsedData(null);
          return;
        }
        // Use file-level conflict_mode as default in the UI if present
        if (json.conflict_mode) {
          setGlobalConflictMode(json.conflict_mode);
        }
        setParsedData(json);
        setStep(1);
      } catch {
        setParseError('JSON 解析失败，请检查文件格式');
        setParsedData(null);
      }
    };
    reader.readAsText(file, 'utf-8');
    return false; // prevent antd auto-upload
  }, []);

  // Submit to backend
  const handleSubmit = async () => {
    if (!parsedData || !fileRef) return;
    setSubmitting(true);

    // Override top-level conflict_mode with UI selection
    const payload: ImportFile = { ...parsedData, conflict_mode: globalConflictMode };

    try {
      const token = localStorage.getItem('token');
      const formData = new FormData();
      const blob = new Blob([JSON.stringify(payload)], { type: 'application/json' });
      formData.append('file', blob, fileRef.name);

      const response = await axios.post(`${API_BASE_URL}/credits/import`, formData, {
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'multipart/form-data',
        },
      });

      if (response.data.success) {
        setResults(response.data.data.results);
        setSummary(response.data.data.summary);
        setStep(2);
        if (response.data.data.summary.imported > 0) {
          onSuccess();
        }
      }
    } catch (err: any) {
      const msg = err.response?.data?.error?.message || '导入请求失败，请重试';
      setParseError(msg);
    } finally {
      setSubmitting(false);
    }
  };

  // ── Preview table columns ──
  const previewColumns = [
    {
      title: '专辑',
      dataIndex: 'album',
      key: 'album',
      ellipsis: true,
      width: 200,
    },
    {
      title: '歌曲',
      dataIndex: 'track',
      key: 'track',
      ellipsis: true,
      width: 200,
    },
    {
      title: 'Credits 条数',
      key: 'count',
      width: 100,
      render: (_: any, record: ImportTrackEntry) => (
        <Tag color="blue">{record.credits?.length ?? 0} 条</Tag>
      ),
    },
    {
      title: '冲突策略',
      key: 'conflict',
      width: 120,
      render: (_: any, record: ImportTrackEntry) => {
        const mode = record.conflict_mode ?? globalConflictMode;
        const colorMap: Record<string, string> = { append: 'green', overwrite: 'red', skip: 'default' };
        return <Tag color={colorMap[mode]}>{mode}</Tag>;
      },
    },
    {
      title: 'Credits 预览',
      key: 'preview',
      render: (_: any, record: ImportTrackEntry) => (
        <Space wrap size={4}>
          {(record.credits ?? []).slice(0, 4).map((c, i) => (
            <Tooltip key={i} title={`${c.key}: ${c.value}`}>
              <Tag style={{ maxWidth: 120, overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {c.key}: {c.value}
              </Tag>
            </Tooltip>
          ))}
          {(record.credits?.length ?? 0) > 4 && (
            <Tag>+{(record.credits?.length ?? 0) - 4}</Tag>
          )}
        </Space>
      ),
    },
  ];

  // ── Result table columns ──
  const resultColumns = [
    {
      title: '专辑',
      dataIndex: 'album',
      key: 'album',
      ellipsis: true,
      width: 180,
    },
    {
      title: '歌曲',
      dataIndex: 'track',
      key: 'track',
      ellipsis: true,
      width: 180,
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      width: 110,
      render: (status: ImportResultStatus) => {
        const s = STATUS_TAG[status];
        return (
          <Tag icon={s.icon} color={s.color}>
            {s.label}
          </Tag>
        );
      },
    },
    {
      title: '导入条数',
      dataIndex: 'imported_count',
      key: 'imported_count',
      width: 90,
      render: (v: number | undefined) => v != null ? <Tag color="green">{v}</Tag> : '—',
    },
    {
      title: '备注',
      dataIndex: 'message',
      key: 'message',
      ellipsis: true,
      render: (v: string | undefined) => v ? <Text type="secondary" style={{ fontSize: 12 }}>{v}</Text> : '—',
    },
  ];

  // ── Modal footer ──
  const getFooter = () => {
    if (step === 0) {
      return [<Button key="cancel" onClick={handleClose}>取消</Button>];
    }
    if (step === 1) {
      return [
        <Button key="back" onClick={() => { setParsedData(null); setStep(0); }}>上一步</Button>,
        <Button key="submit" type="primary" icon={<ImportOutlined />}
          loading={submitting} onClick={handleSubmit}>
          确认导入 ({parsedData?.tracks.length ?? 0} 首)
        </Button>,
      ];
    }
    // step === 2
    return [
      <Button key="again" onClick={resetAll}>重新导入</Button>,
      <Button key="close" type="primary" onClick={handleClose}>关闭</Button>,
    ];
  };

  return (
    <Modal
      title={
        <Space>
          <ImportOutlined style={{ color: '#667eea' }} />
          <span>批量导入 Credits</span>
        </Space>
      }
      open={visible}
      onCancel={handleClose}
      width={800}
      footer={getFooter()}
      destroyOnClose
    >
      {/* ── Step 0: 选择文件 ── */}
      {step === 0 && (
        <div>
          <Alert
            type="info"
            showIcon
            message="请上传符合规范的 JSON 导入文件"
            description={
              <span>
                通过 <strong>专辑名 + 歌曲标题</strong> 匹配数据库曲目，批量写入 Credits。
                文件格式详见 <code>CREDITS_IMPORT_SPEC.md</code>。
              </span>
            }
            style={{ marginBottom: 16 }}
          />
          {parseError && (
            <Alert type="error" showIcon message={parseError} style={{ marginBottom: 12 }} closable
              onClose={() => setParseError(null)} />
          )}
          <Dragger
            accept=".json"
            multiple={false}
            showUploadList={false}
            beforeUpload={(file) => { handleFileSelect(file as unknown as File); return false; }}
          >
            <p className="ant-upload-drag-icon">
              <FileTextOutlined style={{ fontSize: 48, color: '#667eea' }} />
            </p>
            <p className="ant-upload-text">拖拽 JSON 文件到此处，或点击选择</p>
            <p className="ant-upload-hint">仅支持 .json 格式，文件大小不超过 5MB</p>
          </Dragger>
        </div>
      )}

      {/* ── Step 1: 预览 + 选项 ── */}
      {step === 1 && parsedData && (
        <div>
          <Alert
            type="success"
            showIcon
            message={`已解析 ${parsedData.tracks.length} 条曲目记录`}
            description="请确认下方预览，选择全局冲突策略后提交。各曲目中的 conflict_mode 字段优先级高于全局设置。"
            style={{ marginBottom: 16 }}
          />

          <Space style={{ marginBottom: 12 }} align="center">
            <Text strong>全局冲突策略：</Text>
            <Select
              value={globalConflictMode}
              onChange={(v) => setGlobalConflictMode(v)}
              options={CONFLICT_OPTIONS}
              style={{ width: 280 }}
            />
          </Space>

          <Table
            dataSource={parsedData.tracks}
            columns={previewColumns}
            rowKey={(r, i) => `${r.album}_${r.track}_${i}`}
            size="small"
            pagination={{ pageSize: 8, showSizeChanger: false }}
            scroll={{ x: 700 }}
          />
        </div>
      )}

      {/* ── Step 2: 结果报告 ── */}
      {step === 2 && summary && (
        <div>
          <Result
            status={summary.error + summary.not_found + summary.ambiguous > 0 ? 'warning' : 'success'}
            title={`导入完成：${summary.imported} 首成功写入`}
            subTitle={
              <Space wrap>
                <Tag color="success">已导入 {summary.imported}</Tag>
                {summary.skipped > 0 && <Tag color="default">已跳过 {summary.skipped}</Tag>}
                {summary.not_found > 0 && <Tag color="warning">未找到 {summary.not_found}</Tag>}
                {summary.ambiguous > 0 && <Tag color="orange">匹配歧义 {summary.ambiguous}</Tag>}
                {summary.error > 0 && <Tag color="error">错误 {summary.error}</Tag>}
              </Space>
            }
          />
          <Divider style={{ margin: '8px 0 16px' }} />
          <Table
            dataSource={results}
            columns={resultColumns}
            rowKey={(r, i) => `${r.album}_${r.track}_${i}`}
            size="small"
            pagination={{ pageSize: 10, showSizeChanger: false }}
            scroll={{ x: 700 }}
            rowClassName={(r) =>
              r.status === 'error' ? 'ant-table-row-danger'
              : r.status === 'not_found' || r.status === 'ambiguous' ? 'ant-table-row-warning'
              : ''
            }
          />
        </div>
      )}

      {submitting && (
        <div style={{ textAlign: 'center', padding: '20px 0' }}>
          <Spin tip="正在导入，请稍候…" />
        </div>
      )}
    </Modal>
  );
};

export default CreditsImportModal;



