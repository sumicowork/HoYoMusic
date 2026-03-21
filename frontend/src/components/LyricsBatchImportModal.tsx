import React, { useMemo, useState } from 'react';
import {
  Alert,
  Button,
  Modal,
  Result,
  Select,
  Space,
  Table,
  Tag,
  Typography,
  Upload,
  message,
} from 'antd';
import type { UploadFile } from 'antd/es/upload/interface';
import { FileTextOutlined, ImportOutlined, UploadOutlined } from '@ant-design/icons';
import {
  lyricsImportService,
  type LyricsImportCandidate,
  type LyricsImportCommitResult,
  type LyricsImportItem,
  type LyricsImportPreviewResult,
} from '../services/lyricsImportService';

const { Text } = Typography;

interface LyricsBatchImportModalProps {
  visible: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

const statusTag = (status: LyricsImportItem['status']) => {
  if (status === 'matched' || status === 'imported') return <Tag color="success">{status}</Tag>;
  if (status === 'ambiguous') return <Tag color="orange">ambiguous</Tag>;
  if (status === 'not_found' || status === 'invalid') return <Tag color="warning">{status}</Tag>;
  return <Tag color="error">error</Tag>;
};

const buildLabel = (candidate: LyricsImportCandidate): string => {
  const suffix = [candidate.album_title, candidate.artists].filter(Boolean).join(' | ');
  return suffix ? `${candidate.title} (${suffix})` : candidate.title;
};

const LyricsBatchImportModal: React.FC<LyricsBatchImportModalProps> = ({ visible, onClose, onSuccess }) => {
  const [files, setFiles] = useState<File[]>([]);
  const [preview, setPreview] = useState<LyricsImportPreviewResult | null>(null);
  const [result, setResult] = useState<LyricsImportCommitResult | null>(null);
  const [resolutions, setResolutions] = useState<Record<string, number>>({});
  const [previewLoading, setPreviewLoading] = useState(false);
  const [commitLoading, setCommitLoading] = useState(false);

  const resetAll = () => {
    setFiles([]);
    setPreview(null);
    setResult(null);
    setResolutions({});
    setPreviewLoading(false);
    setCommitLoading(false);
  };

  const handleClose = () => {
    resetAll();
    onClose();
  };

  const uploadList: UploadFile[] = files.map((file) => ({
    uid: `${file.name}_${file.size}`,
    name: file.name,
    status: 'done',
    size: file.size,
  }));

  const ambiguousItems = useMemo(
    () => (preview?.items || []).filter((item) => item.status === 'ambiguous'),
    [preview]
  );

  const unresolvedAmbiguousCount = useMemo(
    () => ambiguousItems.filter((item) => !resolutions[item.file_name]).length,
    [ambiguousItems, resolutions]
  );

  const handlePreview = async () => {
    if (files.length === 0) {
      message.warning('请先选择 LRC 文件');
      return;
    }

    setPreviewLoading(true);
    setResult(null);
    try {
      const data = await lyricsImportService.previewImport(files);
      setPreview(data);
      const autoResolutions: Record<string, number> = {};
      data.items.forEach((item) => {
        if (item.status === 'matched' && item.matched_track_id) {
          autoResolutions[item.file_name] = item.matched_track_id;
        }
      });
      setResolutions(autoResolutions);
      message.success('预览完成');
    } catch (error: any) {
      message.error(error?.message || '预览失败');
    } finally {
      setPreviewLoading(false);
    }
  };

  const handleCommit = async () => {
    if (files.length === 0 || !preview) {
      message.warning('请先执行预览');
      return;
    }

    if (unresolvedAmbiguousCount > 0) {
      message.warning(`还有 ${unresolvedAmbiguousCount} 个歧义文件未选择目标歌曲`);
      return;
    }

    setCommitLoading(true);
    try {
      const data = await lyricsImportService.commitImport(files, resolutions);
      setResult(data);
      if (data.summary.imported > 0) {
        onSuccess?.();
      }
      message.success(`导入完成，成功 ${data.summary.imported} 个`);
    } catch (error: any) {
      message.error(error?.message || '导入失败');
    } finally {
      setCommitLoading(false);
    }
  };

  const previewColumns = [
    {
      title: '文件名',
      dataIndex: 'file_name',
      key: 'file_name',
      width: 220,
      ellipsis: true,
    },
    {
      title: '推断歌曲名',
      dataIndex: 'inferred_title',
      key: 'inferred_title',
      width: 180,
      ellipsis: true,
      render: (value: string) => value || '—',
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      width: 110,
      render: (value: LyricsImportItem['status']) => statusTag(value),
    },
    {
      title: '候选歌曲 / 选择',
      key: 'candidates',
      render: (_: unknown, row: LyricsImportItem) => {
        if (!row.candidates || row.candidates.length === 0) {
          return <Text type="secondary">{row.message || '—'}</Text>;
        }

        if (row.status !== 'ambiguous') {
          const candidate = row.candidates[0];
          return <Text>{buildLabel(candidate)}</Text>;
        }

        return (
          <Select
            style={{ width: '100%' }}
            placeholder="请选择要绑定的歌曲"
            value={resolutions[row.file_name]}
            options={row.candidates.map((candidate) => ({
              value: candidate.track_id,
              label: buildLabel(candidate),
            }))}
            onChange={(value) => {
              setResolutions((prev) => ({ ...prev, [row.file_name]: value }));
            }}
          />
        );
      },
    },
  ];

  const resultColumns = [
    { title: '文件名', dataIndex: 'file_name', key: 'file_name', width: 220, ellipsis: true },
    { title: '推断歌曲名', dataIndex: 'inferred_title', key: 'inferred_title', width: 180, ellipsis: true },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      width: 110,
      render: (value: LyricsImportItem['status']) => statusTag(value),
    },
    {
      title: '说明',
      dataIndex: 'message',
      key: 'message',
      render: (value: string | undefined) => value || '—',
    },
  ];

  return (
    <Modal
      title={
        <Space>
          <ImportOutlined style={{ color: '#1677ff' }} />
          <span>LRC 批量导入</span>
        </Space>
      }
      open={visible}
      onCancel={handleClose}
      width={940}
      destroyOnHidden
      footer={[
        <Button key="close" onClick={handleClose}>关闭</Button>,
        <Button key="preview" icon={<FileTextOutlined />} loading={previewLoading} onClick={handlePreview}>
          预览匹配
        </Button>,
        <Button
          key="commit"
          type="primary"
          icon={<ImportOutlined />}
          loading={commitLoading}
          disabled={!preview}
          onClick={handleCommit}
        >
          确认导入
        </Button>,
      ]}
    >
      <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: 12 }}>
        <Alert
          type="info"
          showIcon
          description={(
            <>
              <Text strong>按文件名匹配歌曲名</Text>
              <div>系统会用 LRC 文件名（去扩展名）匹配曲目名；命中多首时需要你手动选择后再导入。</div>
            </>
          )}
        />

        <Upload
          multiple
          accept=".lrc"
          fileList={uploadList}
          beforeUpload={(file) => {
            setFiles((prev) => [...prev, file]);
            return false;
          }}
          onRemove={(file) => {
            setFiles((prev) => prev.filter((item) => !(item.name === file.name && item.size === file.size)));
          }}
        >
          <Button icon={<UploadOutlined />}>选择 LRC 文件</Button>
        </Upload>

        {preview && (
          <Alert
            type={preview.summary.ambiguous > 0 ? 'warning' : 'success'}
            showIcon
            description={
              <>
                <Text strong>
                  {`预览结果：共 ${preview.summary.total} 个，唯一匹配 ${preview.summary.matched} 个，歧义 ${preview.summary.ambiguous} 个，未找到 ${preview.summary.not_found} 个`}
                </Text>
                <div>
                  {preview.summary.ambiguous > 0
                    ? `还有 ${unresolvedAmbiguousCount} 个歧义文件待选择目标歌曲。`
                    : '已可直接执行导入。'}
                </div>
              </>
            }
          />
        )}

        {preview && (
          <Table
            rowKey={(row) => `${row.file_name}_${row.inferred_title}`}
            dataSource={preview.items}
            columns={previewColumns}
            pagination={{ pageSize: 8 }}
            size="small"
            scroll={{ x: 860 }}
          />
        )}

        {result && (
          <>
            <Result
              status={result.summary.error + result.summary.ambiguous > 0 ? 'warning' : 'success'}
              title={`导入完成：成功 ${result.summary.imported} / ${result.summary.total}`}
              subTitle={`歧义 ${result.summary.ambiguous}，未找到 ${result.summary.not_found}，错误 ${result.summary.error}`}
            />
            <Table
              rowKey={(row) => `${row.file_name}_${row.status}`}
              dataSource={result.items}
              columns={resultColumns}
              pagination={{ pageSize: 8 }}
              size="small"
              scroll={{ x: 760 }}
            />
          </>
        )}
      </div>
    </Modal>
  );
};

export default LyricsBatchImportModal;



