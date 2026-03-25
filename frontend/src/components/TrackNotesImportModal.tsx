import React, { useMemo, useRef, useState } from 'react';
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
import { FileTextOutlined, ImportOutlined, UploadOutlined } from '@ant-design/icons';
import type { UploadFile } from 'antd/es/upload/interface';
import {
  trackService,
  type TrackNotesImportCandidate,
  type TrackNotesImportCommitResult,
  type TrackNotesImportEntry,
  type TrackNotesImportItem,
  type TrackNotesImportPreviewResult,
} from '../services/trackService';

const { Text } = Typography;

type ConflictMode = 'overwrite' | 'append' | 'skip';

interface TrackNotesImportModalProps {
  visible: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

interface RawUsageItem {
  location?: unknown;
}

interface RawTrackNotesItem {
  [key: string]: unknown;
  '歌曲名'?: unknown;
  '歌曲编号'?: unknown;
  'soundtrack usage'?: unknown;
}

const conflictOptions = [
  { value: 'overwrite', label: '覆盖（overwrite）' },
  { value: 'append', label: '追加（append）' },
  { value: 'skip', label: '跳过已有备注（skip）' },
] as const;

const statusTag = (status: TrackNotesImportItem['status']) => {
  if (status === 'matched' || status === 'imported') return <Tag color="success">{status}</Tag>;
  if (status === 'needs_manual') return <Tag color="orange">needs_manual</Tag>;
  if (status === 'not_found' || status === 'invalid') return <Tag color="warning">{status}</Tag>;
  if (status === 'skipped') return <Tag color="default">skipped</Tag>;
  return <Tag color="error">error</Tag>;
};

const buildCandidateLabel = (candidate: TrackNotesImportCandidate): string => {
  const extra = [
    candidate.track_number != null ? `#${candidate.track_number}` : '',
    candidate.album_title,
    candidate.artists,
  ].filter(Boolean).join(' | ');
  return extra ? `${candidate.title} (${extra})` : candidate.title;
};

const rowKeyToNumber = (rowKey: string): number => {
  const parsed = Number.parseInt(rowKey, 10);
  return Number.isInteger(parsed) ? parsed : Number.MAX_SAFE_INTEGER;
};

const sortManualFirst = (items: TrackNotesImportItem[]): TrackNotesImportItem[] => {
  return [...items].sort((a, b) => {
    const aManual = a.status === 'needs_manual' ? 0 : 1;
    const bManual = b.status === 'needs_manual' ? 0 : 1;
    if (aManual !== bManual) return aManual - bManual;
    return rowKeyToNumber(a.row_key) - rowKeyToNumber(b.row_key);
  });
};

const normalizeForCompare = (value: string): string => value.trim().toLowerCase();

const sortCandidatesForRow = (
  candidates: TrackNotesImportCandidate[],
  songName: string,
  selectedTrackId?: number
): TrackNotesImportCandidate[] => {
  const normalizedSongName = normalizeForCompare(songName || '');

  return [...candidates].sort((a, b) => {
    // Keep user's current choice visible at top after selection.
    if (selectedTrackId) {
      const aSelected = a.track_id === selectedTrackId ? 0 : 1;
      const bSelected = b.track_id === selectedTrackId ? 0 : 1;
      if (aSelected !== bSelected) return aSelected - bSelected;
    }

    const aTitle = normalizeForCompare(a.title);
    const bTitle = normalizeForCompare(b.title);

    const aExact = normalizedSongName && aTitle === normalizedSongName ? 0 : 1;
    const bExact = normalizedSongName && bTitle === normalizedSongName ? 0 : 1;
    if (aExact !== bExact) return aExact - bExact;

    const aContains = normalizedSongName && aTitle.includes(normalizedSongName) ? 0 : 1;
    const bContains = normalizedSongName && bTitle.includes(normalizedSongName) ? 0 : 1;
    if (aContains !== bContains) return aContains - bContains;

    const titleCompare = a.title.localeCompare(b.title, 'zh-CN');
    if (titleCompare !== 0) return titleCompare;

    return a.track_id - b.track_id;
  });
};

const parseTrackNotesFile = async (file: File): Promise<TrackNotesImportEntry[]> => {
  const rawText = await file.text();
  const parsed = JSON.parse(rawText) as unknown;
  if (!Array.isArray(parsed)) {
    throw new Error('JSON 顶层结构必须是数组');
  }

  return parsed.map((row, idx) => {
    const item = (row || {}) as RawTrackNotesItem;
    const songName = typeof item['歌曲名'] === 'string' ? item['歌曲名'].trim() : '';
    const songNumberRaw = item['歌曲编号'];
    const usageList = Array.isArray(item['soundtrack usage']) ? (item['soundtrack usage'] as RawUsageItem[]) : [];
    const noteLines = usageList
      .map((usage) => (typeof usage?.location === 'string' ? usage.location.trim() : ''))
      .filter(Boolean);

    return {
      row_key: String(idx + 1),
      song_name: songName,
      song_number: typeof songNumberRaw === 'number' || typeof songNumberRaw === 'string' ? songNumberRaw : null,
      note_lines: noteLines,
    };
  });
};

const TrackNotesImportModal: React.FC<TrackNotesImportModalProps> = ({ visible, onClose, onSuccess }) => {
  const [file, setFile] = useState<File | null>(null);
  const [entries, setEntries] = useState<TrackNotesImportEntry[]>([]);
  const [preview, setPreview] = useState<TrackNotesImportPreviewResult | null>(null);
  const [result, setResult] = useState<TrackNotesImportCommitResult | null>(null);
  const [resolutions, setResolutions] = useState<Record<string, number>>({});
  const [manualOptionsByRow, setManualOptionsByRow] = useState<Record<string, TrackNotesImportCandidate[]>>({});
  const [searchingRows, setSearchingRows] = useState<Record<string, boolean>>({});
  const [conflictMode, setConflictMode] = useState<ConflictMode>('overwrite');
  const [previewLoading, setPreviewLoading] = useState(false);
  const [commitLoading, setCommitLoading] = useState(false);
  const searchTimerRef = useRef<Record<string, ReturnType<typeof setTimeout>>>({});

  const mergeUniqueCandidates = (
    base: TrackNotesImportCandidate[],
    incoming: TrackNotesImportCandidate[]
  ): TrackNotesImportCandidate[] => {
    const map = new Map<number, TrackNotesImportCandidate>();
    // Incoming (searched) candidates should override list order over initial seed candidates.
    [...incoming, ...base].forEach((candidate) => {
      map.set(candidate.track_id, candidate);
    });
    return Array.from(map.values());
  };

  const resetState = () => {
    setFile(null);
    setEntries([]);
    setPreview(null);
    setResult(null);
    setResolutions({});
    setManualOptionsByRow({});
    setSearchingRows({});
    setConflictMode('overwrite');
    setPreviewLoading(false);
    setCommitLoading(false);
    Object.values(searchTimerRef.current).forEach((timer) => clearTimeout(timer));
    searchTimerRef.current = {};
  };

  const handleClose = () => {
    resetState();
    onClose();
  };

  const needsManualItems = useMemo(
    () => (preview?.items || []).filter((item) => item.status === 'needs_manual'),
    [preview]
  );

  const unresolvedManualCount = useMemo(
    () => needsManualItems.filter((item) => !resolutions[item.row_key]).length,
    [needsManualItems, resolutions]
  );

  const sortedPreviewItems = useMemo(
    () => sortManualFirst(preview?.items || []),
    [preview]
  );

  const sortedResultItems = useMemo(
    () => sortManualFirst(result?.items || []),
    [result]
  );

  const uploadList: UploadFile[] = file
    ? [{ uid: `${file.name}_${file.size}`, name: file.name, status: 'done', size: file.size }]
    : [];

  const handleManualSearch = (rowKey: string, seedCandidates: TrackNotesImportCandidate[], keyword: string) => {
    const normalized = keyword.trim();
    const existingTimer = searchTimerRef.current[rowKey];
    if (existingTimer) clearTimeout(existingTimer);

    if (!normalized) {
      setManualOptionsByRow((prev) => ({ ...prev, [rowKey]: seedCandidates }));
      setSearchingRows((prev) => ({ ...prev, [rowKey]: false }));
      return;
    }

    searchTimerRef.current[rowKey] = setTimeout(async () => {
      setSearchingRows((prev) => ({ ...prev, [rowKey]: true }));
      try {
        const fetched = await trackService.searchTrackNotesImportCandidates(normalized, 40);
        setManualOptionsByRow((prev) => ({
          ...prev,
          [rowKey]: mergeUniqueCandidates(seedCandidates, fetched),
        }));
      } catch {
        // Keep existing options if search request fails.
      } finally {
        setSearchingRows((prev) => ({ ...prev, [rowKey]: false }));
      }
    }, 250);
  };

  const handlePreview = async () => {
    if (!file) {
      message.warning('请先选择 JSON 文件');
      return;
    }

    setPreviewLoading(true);
    setResult(null);
    try {
      const parsedEntries = await parseTrackNotesFile(file);
      setEntries(parsedEntries);

      const data = await trackService.previewTrackNotesImport(parsedEntries);
      setPreview(data);

      const autoResolved: Record<string, number> = {};
      data.items.forEach((item) => {
        if (item.status === 'matched' && item.matched_track_id) {
          autoResolved[item.row_key] = item.matched_track_id;
        }
      });
      setResolutions(autoResolved);
      const nextManualOptions: Record<string, TrackNotesImportCandidate[]> = {};
      data.items.forEach((item) => {
        if (item.status === 'needs_manual' && item.candidates) {
          nextManualOptions[item.row_key] = item.candidates;
        }
      });
      setManualOptionsByRow(nextManualOptions);
      message.success(`预览完成，共 ${parsedEntries.length} 条`);
    } catch (error: any) {
      message.error(error?.message || '预览失败');
    } finally {
      setPreviewLoading(false);
    }
  };

  const handleCommit = async () => {
    if (!preview || entries.length === 0) {
      message.warning('请先执行预览');
      return;
    }
    if (unresolvedManualCount > 0) {
      message.info(`仍有 ${unresolvedManualCount} 条未人工匹配，提交后这些条目会保留为 needs_manual`);
    }

    setCommitLoading(true);
    try {
      const data = await trackService.commitTrackNotesImport(entries, resolutions, conflictMode);
      setResult(data);
      if (data.summary.imported > 0) {
        onSuccess?.();
      }
      message.success(`导入完成，成功 ${data.summary.imported} 条`);
    } catch (error: any) {
      message.error(error?.message || '导入失败');
    } finally {
      setCommitLoading(false);
    }
  };

  const previewColumns = [
    { title: '行号', dataIndex: 'row_key', key: 'row_key', width: 90 },
    { title: '歌曲名', dataIndex: 'song_name', key: 'song_name', width: 220, ellipsis: true },
    { title: '歌曲编号', dataIndex: 'song_number_raw', key: 'song_number_raw', width: 110 },
    {
      title: '备注行数',
      dataIndex: 'note_lines_count',
      key: 'note_lines_count',
      width: 90,
      render: (value: number) => <Tag color="blue">{value}</Tag>,
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      width: 120,
      render: (status: TrackNotesImportItem['status']) => statusTag(status),
    },
    {
      title: '匹配结果 / 人工选择',
      key: 'match_result',
      render: (_: unknown, row: TrackNotesImportItem) => {
        if (!row.candidates || row.candidates.length === 0) {
          return <Text type="secondary">{row.message || '—'}</Text>;
        }

        if (row.status === 'needs_manual') {
          const optionsSource = manualOptionsByRow[row.row_key] || row.candidates;
          const sortedOptions = sortCandidatesForRow(optionsSource, row.song_name, resolutions[row.row_key]);
          return (
            <Select
              style={{ width: '100%' }}
              placeholder="请选择目标曲目"
              value={resolutions[row.row_key]}
              showSearch
              filterOption={false}
              onSearch={(value) => handleManualSearch(row.row_key, row.candidates || [], value)}
              notFoundContent={searchingRows[row.row_key] ? '搜索中...' : '无匹配结果'}
              options={sortedOptions.map((candidate) => ({
                value: candidate.track_id,
                label: buildCandidateLabel(candidate),
              }))}
              onChange={(value) => {
                setResolutions((prev) => ({ ...prev, [row.row_key]: value }));
              }}
            />
          );
        }

        return <Text>{buildCandidateLabel(row.candidates[0])}</Text>;
      },
    },
  ];

  const resultColumns = [
    { title: '行号', dataIndex: 'row_key', key: 'row_key', width: 90 },
    { title: '歌曲名', dataIndex: 'song_name', key: 'song_name', width: 220, ellipsis: true },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      width: 120,
      render: (status: TrackNotesImportItem['status']) => statusTag(status),
    },
    { title: '说明', dataIndex: 'message', key: 'message', render: (value: string | undefined) => value || '—' },
  ];

  return (
    <Modal
      title={
        <Space>
          <ImportOutlined style={{ color: '#1677ff' }} />
          <span>批量导入歌曲备注（location）</span>
        </Space>
      }
      open={visible}
      onCancel={handleClose}
      width={1000}
      destroyOnHidden
      footer={[
        <Button key="close" onClick={handleClose}>关闭</Button>,
        <Button key="preview" icon={<FileTextOutlined />} loading={previewLoading} onClick={handlePreview}>
          预览匹配
        </Button>,
        <Button key="commit" type="primary" icon={<ImportOutlined />} loading={commitLoading} disabled={!preview} onClick={handleCommit}>
          确认导入
        </Button>,
      ]}
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <Alert
          type="info"
          showIcon
          description={(
            <>
              <Text strong>匹配规则：优先 歌曲名 + 歌曲编号 唯一匹配</Text>
              <div>未唯一命中时，可在下拉框输入关键词搜索全库曲目（标题/专辑/艺术家/ID/编号）后手动选择；备注写入内容为 location 字段，按每行一条拼接。</div>
            </>
          )}
        />

        <Upload
          accept=".json"
          maxCount={1}
          fileList={uploadList}
          beforeUpload={(nextFile) => {
            setFile(nextFile);
            setPreview(null);
            setResult(null);
            setEntries([]);
            setResolutions({});
            return false;
          }}
          onRemove={() => {
            setFile(null);
            setPreview(null);
            setResult(null);
            setEntries([]);
            setResolutions({});
          }}
        >
          <Button icon={<UploadOutlined />}>选择示例 JSON 文件</Button>
        </Upload>

        <Select
          value={conflictMode}
          options={conflictOptions as unknown as Array<{ value: ConflictMode; label: string }>}
          onChange={(value: ConflictMode) => setConflictMode(value)}
          style={{ width: 260 }}
        />

        {preview && (
          <Alert
            type={preview.summary.needs_manual > 0 ? 'warning' : 'success'}
            showIcon
            description={
              <>
                <Text strong>
                  {`预览结果：共 ${preview.summary.total} 条，自动匹配 ${preview.summary.matched} 条，需人工匹配 ${preview.summary.needs_manual} 条，未找到 ${preview.summary.not_found} 条`}
                </Text>
                <div>
                  {preview.summary.needs_manual > 0
                    ? `还有 ${unresolvedManualCount} 条未完成人工匹配（不影响提交，提交后会保留为 needs_manual）。`
                    : '已可直接执行导入。'}
                </div>
              </>
            }
          />
        )}

        {preview && (
          <Table
            rowKey={(row) => row.row_key}
            dataSource={sortedPreviewItems}
            columns={previewColumns}
            pagination={{ pageSize: 8 }}
            size="small"
            scroll={{ x: 920 }}
          />
        )}

        {result && (
          <>
            <Result
              status={result.summary.error > 0 || result.summary.needs_manual > 0 ? 'warning' : 'success'}
              title={`导入完成：成功 ${result.summary.imported} / ${result.summary.total}`}
              subTitle={`跳过 ${result.summary.skipped}，需人工 ${result.summary.needs_manual}，未找到 ${result.summary.not_found}，错误 ${result.summary.error}`}
            />
            <Table
              rowKey={(row) => `${row.row_key}_${row.status}`}
              dataSource={sortedResultItems}
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

export default TrackNotesImportModal;

