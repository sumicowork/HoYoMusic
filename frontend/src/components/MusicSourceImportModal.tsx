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
import { FileTextOutlined, ImportOutlined, SearchOutlined, UploadOutlined } from '@ant-design/icons';
import type { UploadFile } from 'antd/es/upload/interface';
import {
  musicSourceService,
  type MusicSourceConflictMode,
  type MusicSourceImportCandidate,
  type MusicSourceImportCommitResult,
  type MusicSourceImportEntry,
  type MusicSourceImportItem,
  type MusicSourceImportPreviewResult,
} from '../services/musicSourceService';

const { Text } = Typography;

interface MusicSourceImportModalProps {
  visible: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

const conflictOptions = [
  { value: 'overwrite', label: '覆盖（overwrite）' },
  { value: 'append', label: '追加（append）' },
  { value: 'skip', label: '跳过已有来源（skip）' },
] as const;

const statusTag = (status: MusicSourceImportItem['status']) => {
  if (status === 'matched' || status === 'imported') return <Tag color="success">{status}</Tag>;
  if (status === 'needs_manual') return <Tag color="orange">needs_manual</Tag>;
  if (status === 'not_found' || status === 'invalid') return <Tag color="warning">{status}</Tag>;
  if (status === 'skipped') return <Tag color="default">skipped</Tag>;
  return <Tag color="error">error</Tag>;
};

const buildCandidateLabel = (candidate: MusicSourceImportCandidate): string => {
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

const sortManualFirst = (items: MusicSourceImportItem[]): MusicSourceImportItem[] => {
  return [...items].sort((a, b) => {
    const aManual = (a.status === 'needs_manual' || a.status === 'not_found') ? 0 : 1;
    const bManual = (b.status === 'needs_manual' || b.status === 'not_found') ? 0 : 1;
    if (aManual !== bManual) return aManual - bManual;
    return rowKeyToNumber(a.row_key) - rowKeyToNumber(b.row_key);
  });
};

const normalizeForCompare = (value: string): string => value.trim().toLowerCase();

const sortCandidatesForRow = (
  candidates: MusicSourceImportCandidate[],
  songName: string,
  selectedTrackId?: number
): MusicSourceImportCandidate[] => {
  const normalizedSongName = normalizeForCompare(songName || '');
  return [...candidates].sort((a, b) => {
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

    return a.track_id - b.track_id;
  });
};

const parseMusicSourceFile = async (file: File): Promise<{ entries: MusicSourceImportEntry[]; warning: string | null }> => {
  const rawText = await file.text();
  const parsed = JSON.parse(rawText) as any;
  const entries = Array.isArray(parsed?.entries) ? parsed.entries : [];
  if (entries.length === 0) {
    throw new Error('JSON 内未找到 entries');
  }

  const emptySourceRows: string[] = [];

  const normalized = entries.map((entry: any, index: number) => {
    const rowKey = String(entry?.row_key ?? index + 1).trim();
    const songName = String(entry?.song_name ?? '').trim();
    const albumName = entry?.album_name == null ? null : String(entry.album_name).trim();
    const gameId = Number(entry?.game_id);
    const sources: MusicSourceImportEntry['sources'] = Array.isArray(entry?.sources)
      ? entry.sources.map((source: any) => ({
          category: String(source?.category ?? '').trim(),
          path: Array.isArray(source?.path)
            ? source.path.map((segment: unknown) => String(segment ?? '').trim()).filter(Boolean)
            : [],
        }))
      : [];

    const entryLabel = `第 ${index + 1} 条（row_key=${rowKey}）`;
    if (!songName) throw new Error(`${entryLabel} 缺少 song_name`);
    if (!Number.isInteger(gameId) || gameId <= 0) throw new Error(`${entryLabel} 的 game_id 无效`);
    if (sources.length === 0) emptySourceRows.push(rowKey);
    if (sources.some((source) => !source.category || source.path.length === 0)) {
      throw new Error(`${entryLabel} 的 sources 中存在空 category/path`);
    }

    return {
      row_key: rowKey,
      song_name: songName,
      song_number: entry?.song_number ?? null,
      album_name: albumName,
      game_id: gameId,
      sources,
    };
  });

  if (emptySourceRows.length === 0) {
    return { entries: normalized, warning: null };
  }

  const preview = emptySourceRows.slice(0, 10).join(', ');
  const suffix = emptySourceRows.length > 10 ? ' ...' : '';
  return {
    entries: normalized,
    warning: `警告：${emptySourceRows.length} 条记录的 sources 为空（row_key: ${preview}${suffix}）。可继续预览/提交，但这些记录会被跳过。`,
  };
};

const MusicSourceImportModal: React.FC<MusicSourceImportModalProps> = ({ visible, onClose, onSuccess }) => {
  const [file, setFile] = useState<File | null>(null);
  const [entries, setEntries] = useState<MusicSourceImportEntry[]>([]);
  const [parseWarning, setParseWarning] = useState<string | null>(null);
  const [preview, setPreview] = useState<MusicSourceImportPreviewResult | null>(null);
  const [result, setResult] = useState<MusicSourceImportCommitResult | null>(null);
  const [resolutions, setResolutions] = useState<Record<string, number>>({});
  const [manualOptionsByRow, setManualOptionsByRow] = useState<Record<string, MusicSourceImportCandidate[]>>({});
  const [searchKeywordByRow, setSearchKeywordByRow] = useState<Record<string, string>>({});
  const [searchingRows, setSearchingRows] = useState<Record<string, boolean>>({});
  const [conflictMode, setConflictMode] = useState<MusicSourceConflictMode>('overwrite');
  const [previewLoading, setPreviewLoading] = useState(false);
  const [commitLoading, setCommitLoading] = useState(false);
  const searchTimerRef = useRef<Record<string, ReturnType<typeof setTimeout>>>({});
  const searchSeqRef = useRef<Record<string, number>>({});

  const resetState = () => {
    setFile(null);
    setEntries([]);
    setParseWarning(null);
    setPreview(null);
    setResult(null);
    setResolutions({});
    setManualOptionsByRow({});
    setSearchKeywordByRow({});
    setSearchingRows({});
    setConflictMode('overwrite');
    setPreviewLoading(false);
    setCommitLoading(false);
    Object.values(searchTimerRef.current).forEach((timer) => clearTimeout(timer));
    searchTimerRef.current = {};
    searchSeqRef.current = {};
  };

  const handleClose = () => {
    resetState();
    onClose();
  };

  const needsManualItems = useMemo(
    () => (preview?.items || []).filter((item) => item.status === 'needs_manual' || item.status === 'not_found'),
    [preview]
  );

  const unresolvedManualCount = useMemo(
    () => needsManualItems.filter((item) => !resolutions[item.row_key]).length,
    [needsManualItems, resolutions]
  );

  const sortedPreviewItems = useMemo(() => sortManualFirst(preview?.items || []), [preview]);
  const sortedResultItems = useMemo(() => sortManualFirst(result?.items || []), [result]);

  const uploadList: UploadFile[] = file
    ? [{ uid: `${file.name}_${file.size}`, name: file.name, status: 'done', size: file.size }]
    : [];

  const handleManualSearch = (rowKey: string, songName: string, keyword: string) => {
    const normalized = keyword.trim();
    setSearchKeywordByRow((prev) => ({ ...prev, [rowKey]: keyword }));
    const existingTimer = searchTimerRef.current[rowKey];
    if (existingTimer) clearTimeout(existingTimer);

    if (!normalized) {
      setManualOptionsByRow((prev) => ({ ...prev, [rowKey]: [] }));
      setSearchingRows((prev) => ({ ...prev, [rowKey]: false }));
      return;
    }

    const nextSeq = (searchSeqRef.current[rowKey] || 0) + 1;
    searchSeqRef.current[rowKey] = nextSeq;
    searchTimerRef.current[rowKey] = setTimeout(async () => {
      setSearchingRows((prev) => ({ ...prev, [rowKey]: true }));
      try {
        const fetched = await musicSourceService.searchImportCandidates(normalized, 40);
        if (searchSeqRef.current[rowKey] !== nextSeq) return;
        setManualOptionsByRow((prev) => ({
          ...prev,
          [rowKey]: sortCandidatesForRow(fetched, songName),
        }));
      } catch {
        // Keep current options if search fails.
      } finally {
        if (searchSeqRef.current[rowKey] === nextSeq) {
          setSearchingRows((prev) => ({ ...prev, [rowKey]: false }));
        }
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
      const parsed = await parseMusicSourceFile(file);
      setEntries(parsed.entries);
      setParseWarning(parsed.warning);

      const data = await musicSourceService.previewImport(parsed.entries);
      setPreview(data);

      const autoResolved: Record<string, number> = {};
      data.items.forEach((item) => {
        if (item.status === 'matched' && item.matched_track_id) {
          autoResolved[item.row_key] = item.matched_track_id;
          return;
        }
        if (item.status === 'needs_manual' && item.candidates && item.candidates.length > 0) {
          const ranked = sortCandidatesForRow(item.candidates, item.song_name);
          autoResolved[item.row_key] = ranked[0].track_id;
        }
      });

      setResolutions(autoResolved);
      setManualOptionsByRow({});
      setSearchKeywordByRow({});

      // Preload manual candidates for not_found rows using song name.
      data.items.forEach((item) => {
        if (item.status === 'not_found' && item.song_name.trim()) {
          handleManualSearch(item.row_key, item.song_name, item.song_name);
        }
      });
      message.success(`预览完成，共 ${parsed.entries.length} 条`);
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
      message.info(`仍有 ${unresolvedManualCount} 条未人工匹配，提交后这些条目会保留为 needs_manual / not_found`);
    }

    setCommitLoading(true);
    try {
      const data = await musicSourceService.commitImport(entries, resolutions, conflictMode);
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
      title: '来源数',
      dataIndex: 'source_count',
      key: 'source_count',
      width: 90,
      render: (value: number) => <Tag color="blue">{value}</Tag>,
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      width: 120,
      render: (status: MusicSourceImportItem['status']) => statusTag(status),
    },
    {
      title: '匹配结果 / 人工选择',
      key: 'match_result',
      render: (_: unknown, row: MusicSourceImportItem) => {
        const canManualSelect = row.status === 'needs_manual' || row.status === 'not_found';
        if (canManualSelect) {
          const searchKeyword = (searchKeywordByRow[row.row_key] || '').trim();
          const optionsSource = searchKeyword ? (manualOptionsByRow[row.row_key] || []) : (row.candidates || []);
          const sortedOptions = sortCandidatesForRow(optionsSource, row.song_name, resolutions[row.row_key]);
          return (
            <Space.Compact style={{ width: '100%' }}>
              <Select
                style={{ width: '100%' }}
                placeholder="请选择目标曲目（可输入搜索）"
                value={resolutions[row.row_key]}
                showSearch
                filterOption={false}
                searchValue={searchKeywordByRow[row.row_key] || ''}
                onSearch={(value) => handleManualSearch(row.row_key, row.song_name, value)}
                notFoundContent={searchingRows[row.row_key] ? '搜索中...' : '无匹配结果'}
                options={sortedOptions.map((candidate) => ({
                  value: candidate.track_id,
                  label: buildCandidateLabel(candidate),
                }))}
                onChange={(value) => {
                  setResolutions((prev) => ({ ...prev, [row.row_key]: value }));
                }}
              />
              <Button
                icon={<SearchOutlined />}
                title="一键用本行导入曲名搜索"
                onClick={() => handleManualSearch(row.row_key, row.song_name, row.song_name)}
              >
                曲名搜
              </Button>
            </Space.Compact>
          );
        }

        if (!row.candidates || row.candidates.length === 0) {
          return <Text type="secondary">{row.message || '—'}</Text>;
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
      render: (status: MusicSourceImportItem['status']) => statusTag(status),
    },
    { title: '说明', dataIndex: 'message', key: 'message', render: (value: string | undefined) => value || '—' },
  ];

  return (
    <Modal
      title={(
        <Space>
          <ImportOutlined style={{ color: '#1677ff' }} />
          <span>批量导入 Music Source</span>
        </Space>
      )}
      open={visible}
      onCancel={handleClose}
      width={1080}
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
              <Text strong>匹配规则：song_name + song_number；多结果时可用 album_name 消歧</Text>
              <div>未唯一命中时，可在下拉框输入关键词搜索全库曲目后手动选择。提交时若 category/path 不存在，会自动按顺序创建。</div>
            </>
          )}
        />

        <Upload
          accept=".json,application/json"
          maxCount={1}
          fileList={uploadList}
          beforeUpload={(nextFile) => {
            setFile(nextFile);
            setEntries([]);
            setParseWarning(null);
            setPreview(null);
            setResult(null);
            setResolutions({});
            return false;
          }}
          onRemove={() => {
            setFile(null);
            setEntries([]);
            setParseWarning(null);
            setPreview(null);
            setResult(null);
            setResolutions({});
          }}
        >
          <Button icon={<UploadOutlined />}>选择导入 JSON 文件</Button>
        </Upload>

        <Select<MusicSourceConflictMode>
          value={conflictMode}
          options={conflictOptions as unknown as Array<{ value: MusicSourceConflictMode; label: string }>}
          onChange={(value: MusicSourceConflictMode) => setConflictMode(value)}
          style={{ width: 280 }}
        />

        {parseWarning ? <Alert type="warning" showIcon message={parseWarning} /> : null}

        {preview ? (
          <Alert
            type={unresolvedManualCount > 0 ? 'warning' : 'success'}
            showIcon
            description={(
              <>
                <Text strong>
                  {`预览结果：共 ${preview.summary.total} 条，自动匹配 ${preview.summary.matched} 条，需人工匹配 ${preview.summary.needs_manual} 条，未找到 ${preview.summary.not_found} 条，无效 ${preview.summary.invalid} 条`}
                </Text>
                <div>
                  {unresolvedManualCount > 0
                    ? `还有 ${unresolvedManualCount} 条未完成人工匹配（不影响提交，提交后会保留为 needs_manual / not_found）。`
                    : '已可直接执行导入。'}
                </div>
              </>
            )}
          />
        ) : null}

        {preview ? (
          <Table
            rowKey={(row) => row.row_key}
            dataSource={sortedPreviewItems}
            columns={previewColumns}
            pagination={{ pageSize: 8 }}
            size="small"
            scroll={{ x: 980 }}
          />
        ) : null}

        {result ? (
          <>
            <Result
              status={result.summary.error > 0 || result.summary.needs_manual > 0 ? 'warning' : 'success'}
              title={`导入完成：成功 ${result.summary.imported} / ${result.summary.total}`}
              subTitle={`跳过 ${result.summary.skipped}，需人工 ${result.summary.needs_manual}，未找到 ${result.summary.not_found}，无效 ${result.summary.invalid}，错误 ${result.summary.error}`}
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
        ) : null}
      </div>
    </Modal>
  );
};

export default MusicSourceImportModal;




