import React, { useEffect, useRef, useState } from 'react';
import {
  Button,
  Card,
  DatePicker,
  Drawer,
  Form,
  Grid,
  Image,
  Input,
  InputNumber,
  List,
  message,
  Modal,
  Popconfirm,
  Space,
  Table,
  Tag,
  Typography,
} from 'antd';
import {
  AppstoreOutlined,
  DeleteOutlined,
  DownloadOutlined,
  EditOutlined,
  FileTextOutlined,
  ImportOutlined,
  PlayCircleOutlined,
  SearchOutlined,
  TagsOutlined,
  TeamOutlined,
  UploadOutlined,
} from '@ant-design/icons';
import { Link } from 'react-router-dom';
import dayjs from 'dayjs';
import type { ColumnsType } from 'antd/es/table';
import type { TableRowSelection } from 'antd/es/table/interface';
import { trackService, type AdminTrackFilterOptions, type AdminTrackFilters, type SameAlbumDuplicateGroup } from '../services/trackService';
import type { Track } from '../types';
import { usePlayerStore } from '../store/playerStore';
import { MUSIC_ICON_PLACEHOLDER } from '../utils/imageUtils';
import AdminLayout from '../components/AdminLayout';
import BulkMoveAlbumModal from '../components/BulkMoveAlbumModal';
import BulkTagModal from '../components/BulkTagModal';
import CreditsEditor from '../components/CreditsEditor';
import CreditsImportModal from '../components/CreditsImportModal';
import LyricsBatchImportModal from '../components/LyricsBatchImportModal';
import LyricsEditor from '../components/LyricsEditor';
import TrackNotesImportModal from '../components/TrackNotesImportModal';
import TrackTagsManager from '../components/TrackTagsManager';
import UploadModal from '../components/UploadModal';
import './Admin.css';

const { useBreakpoint } = Grid;

const Admin: React.FC = () => {
  const screens = useBreakpoint();
  const isMobile = !screens.md;

  const [tracks, setTracks] = useState<Track[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchText, setSearchText] = useState('');
  const [filterOptions, setFilterOptions] = useState<AdminTrackFilterOptions>({ titles: [], albums: [], artists: [] });
  const [serverFilters, setServerFilters] = useState<AdminTrackFilters>({});
  const [columnFilters, setColumnFilters] = useState<Record<string, React.Key[] | null>>({});
  const [pagination, setPagination] = useState({ current: 1, pageSize: 20, total: 0 });

  const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([]);
  const [mobileActionTrack, setMobileActionTrack] = useState<Track | null>(null);

  const [uploadModalVisible, setUploadModalVisible] = useState(false);
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [editingTrack, setEditingTrack] = useState<Track | null>(null);
  const [lyricsEditorVisible, setLyricsEditorVisible] = useState(false);
  const [creditsEditorVisible, setCreditsEditorVisible] = useState(false);
  const [tagsManagerVisible, setTagsManagerVisible] = useState(false);
  const [currentTrackId, setCurrentTrackId] = useState<number | null>(null);
  const [currentTrackTitle, setCurrentTrackTitle] = useState('');

  const [bulkTagModalVisible, setBulkTagModalVisible] = useState(false);
  const [bulkMoveModalVisible, setBulkMoveModalVisible] = useState(false);
  const [creditsImportModalVisible, setCreditsImportModalVisible] = useState(false);
  const [lyricsImportModalVisible, setLyricsImportModalVisible] = useState(false);
  const [trackNotesImportModalVisible, setTrackNotesImportModalVisible] = useState(false);

  const [exportingTrackNotes, setExportingTrackNotes] = useState(false);
  const [duplicateModalVisible, setDuplicateModalVisible] = useState(false);
  const [duplicateScanLoading, setDuplicateScanLoading] = useState(false);
  const [duplicateGroups, setDuplicateGroups] = useState<SameAlbumDuplicateGroup[]>([]);

  const [noteDraftById, setNoteDraftById] = useState<Record<number, string>>({});
  const [savingNoteById, setSavingNoteById] = useState<Record<number, boolean>>({});
  const noteSaveSeqRef = useRef<Record<number, number>>({});

  const { playTrackOnly } = usePlayerStore();
  const [form] = Form.useForm();

  const fetchTracks = async (page = 1, search = searchText, pageSize = pagination.pageSize, filters: AdminTrackFilters = serverFilters) => {
    setLoading(true);
    try {
      const data = await trackService.getTracks(page, pageSize, search, filters);
      setTracks(data.tracks);
      setPagination({
        current: data.pagination.page,
        pageSize,
        total: data.pagination.total,
      });
    } catch (error: any) {
      message.error(error.message || '获取曲目列表失败');
    } finally {
      setLoading(false);
    }
  };

  const loadTrackFilterOptions = async () => {
    try {
      const options = await trackService.getTrackFilterOptions();
      setFilterOptions(options);
    } catch (error: any) {
      message.error(error.message || '获取筛选候选失败');
    }
  };

  useEffect(() => {
    void fetchTracks();
    void loadTrackFilterOptions();
  }, []);

  useEffect(() => {
    setNoteDraftById((prev) => {
      const next: Record<number, string> = {};
      tracks.forEach((track) => {
        next[track.id] = prev[track.id] ?? track.notes ?? '';
      });
      return next;
    });
  }, [tracks]);

  const getLyricsStatus = (track: Track): 'none' | 'has' | 'instrumental' => {
    if (track.lyrics_status === 'has' || track.lyrics_status === 'instrumental' || track.lyrics_status === 'none') return track.lyrics_status;
    const fromPath = typeof track.lyrics_path === 'string' && track.lyrics_path.trim().length > 0;
    const fromInline = typeof track.lyrics === 'string' && track.lyrics.trim().length > 0;
    return fromPath || fromInline ? 'has' : 'none';
  };

  const formatDuration = (seconds: number | null) => {
    if (!seconds) return '--:--';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const getUniqueFilters = (values: Array<string | null | undefined>) => {
    const unique = Array.from(new Set(values.map((item) => (item || '').trim()).filter(Boolean)));
    return unique.sort((a, b) => a.localeCompare(b, 'zh-CN')).map((value) => ({ text: value, value }));
  };

  const normalizeTableFilters = (filters: Record<string, React.Key[] | null>): AdminTrackFilters => {
    const title = filters.title?.[0] ? String(filters.title[0]) : undefined;
    const album = filters.album?.[0] ? String(filters.album[0]) : undefined;
    const durationBucketRaw = filters.duration?.[0] ? String(filters.duration[0]) : undefined;
    const durationBucket = durationBucketRaw === 'short' || durationBucketRaw === 'medium' || durationBucketRaw === 'long' ? durationBucketRaw : undefined;
    const lyricsRaw = filters.lyrics?.[0] ? String(filters.lyrics[0]) : undefined;
    const lyricsStatus = lyricsRaw === 'has' || lyricsRaw === 'instrumental' || lyricsRaw === 'none' ? lyricsRaw : undefined;
    const hasLyrics = lyricsRaw === 'has' ? true : lyricsRaw === 'none' ? false : undefined;
    return { title, album, durationBucket, hasLyrics, lyricsStatus };
  };

  const areServerFiltersEqual = (a: AdminTrackFilters, b: AdminTrackFilters) => (
    a.title === b.title
    && a.album === b.album
    && a.durationBucket === b.durationBucket
    && a.hasLyrics === b.hasLyrics
    && a.lyricsStatus === b.lyricsStatus
  );

  const handlePlay = (track: Track) => playTrackOnly(track);

  const handleDownload = (track: Track) => {
    window.open(trackService.getDownloadUrl(track.id), '_blank');
  };

  const handleEdit = (track: Track) => {
    setEditingTrack(track);
    form.setFieldsValue({
      title: track.title,
      album_title: track.album_title,
      release_date: track.release_date ? dayjs(track.release_date) : null,
      track_number: (track as any).track_number || null,
      notes: (track as any).notes || '',
    });
    setEditModalVisible(true);
  };

  const handleEditSave = async () => {
    try {
      const values = await form.validateFields();
      if (!editingTrack) return;
      await trackService.updateTrack(editingTrack.id, {
        title: values.title,
        artists: editingTrack.artists.map((artist) => artist.name),
        album_title: values.album_title || '',
        release_date: values.release_date ? values.release_date.format('YYYY-MM-DD') : undefined,
        track_number: values.track_number || undefined,
        notes: values.notes || null,
      });
      message.success('曲目信息已更新');
      setEditModalVisible(false);
      await fetchTracks(pagination.current);
      await loadTrackFilterOptions();
    } catch (error: any) {
      message.error(error.message || '更新失败');
    }
  };

  const handleDelete = (track: Track) => {
    Modal.confirm({
      title: '删除曲目',
      content: `确定要删除「${track.title}」吗？此操作不可撤销。`,
      okText: '删除',
      okType: 'danger',
      cancelText: '取消',
      onOk: async () => {
        try {
          await trackService.deleteTrack(track.id);
          message.success('曲目已删除');
          await fetchTracks(pagination.current);
          await loadTrackFilterOptions();
        } catch (error: any) {
          message.error(error.message || '删除失败');
        }
      },
    });
  };

  const handleBulkDelete = async () => {
    try {
      await trackService.bulkDeleteTracks(selectedRowKeys as number[]);
      message.success(`成功删除 ${selectedRowKeys.length} 首曲目`);
      setSelectedRowKeys([]);
      await fetchTracks(pagination.current);
      await loadTrackFilterOptions();
    } catch (error: any) {
      message.error(error.message || '批量删除失败');
    }
  };

  const handleNoteBlurSave = async (track: Track, rawValue: string) => {
    const normalizedValue = rawValue.trim();
    const nextNote = normalizedValue ? normalizedValue : null;
    const currentNote = track.notes ?? null;

    if ((currentNote ?? '') === (nextNote ?? '')) {
      setNoteDraftById((prev) => ({ ...prev, [track.id]: nextNote ?? '' }));
      return;
    }

    const previousNote = track.notes ?? null;
    const nextSeq = (noteSaveSeqRef.current[track.id] ?? 0) + 1;
    noteSaveSeqRef.current[track.id] = nextSeq;

    setSavingNoteById((prev) => ({ ...prev, [track.id]: true }));
    setNoteDraftById((prev) => ({ ...prev, [track.id]: nextNote ?? '' }));
    setTracks((prev) => prev.map((item) => (item.id === track.id ? { ...item, notes: nextNote } : item)));

    try {
      await trackService.updateTrack(track.id, {
        title: track.title,
        artists: track.artists.map((artist) => artist.name),
        notes: nextNote,
      });
    } catch (error: any) {
      if (noteSaveSeqRef.current[track.id] !== nextSeq) return;
      setTracks((prev) => prev.map((item) => (item.id === track.id ? { ...item, notes: previousNote } : item)));
      setNoteDraftById((prev) => ({ ...prev, [track.id]: previousNote ?? '' }));
      message.error(error.message || '备注保存失败');
    } finally {
      if (noteSaveSeqRef.current[track.id] === nextSeq) {
        setSavingNoteById((prev) => ({ ...prev, [track.id]: false }));
      }
    }
  };

  const handleScanDuplicates = async () => {
    setDuplicateScanLoading(true);
    try {
      const groups = await trackService.getSameAlbumDuplicateTracks();
      setDuplicateGroups(groups);
      setDuplicateModalVisible(true);
      if (groups.length === 0) message.success('未发现同专辑同曲名重复项');
    } catch (error: any) {
      message.error(error.message || '重复检查失败');
    } finally {
      setDuplicateScanLoading(false);
    }
  };

  const handleExportTrackNotes = async () => {
    setExportingTrackNotes(true);
    try {
      const { blob, fileName } = await trackService.exportAllTrackNotes();
      const downloadUrl = window.URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = downloadUrl;
      anchor.download = fileName;
      document.body.appendChild(anchor);
      anchor.click();
      document.body.removeChild(anchor);
      window.URL.revokeObjectURL(downloadUrl);
      message.success('备注导出成功');
    } catch (error: any) {
      message.error(error.message || '导出备注失败');
    } finally {
      setExportingTrackNotes(false);
    }
  };

  const rowSelection: TableRowSelection<Track> = {
    selectedRowKeys,
    onChange: (keys) => setSelectedRowKeys(keys),
  };

  const columns: ColumnsType<Track> = [
    {
      title: '封面',
      dataIndex: 'cover_path',
      key: 'cover',
      width: 80,
      render: (coverPath, record) => {
        const coverSrc = coverPath || record.album_cover;
        const thumbSrc = coverSrc ? trackService.getCoverUrl(coverSrc, true) : undefined;
        const fullSrc = coverSrc ? trackService.getCoverUrl(coverSrc) : undefined;
        return (
          <Image
            width={50}
            height={50}
            src={thumbSrc}
            fallback={MUSIC_ICON_PLACEHOLDER}
            style={{ borderRadius: 4, objectFit: 'cover' }}
            preview={fullSrc ? { src: fullSrc } : false}
          />
        );
      },
    },
    {
      title: '标题',
      dataIndex: 'title',
      key: 'title',
      ellipsis: true,
      filters: getUniqueFilters(filterOptions.titles),
      filteredValue: columnFilters.title || null,
      filterMultiple: false,
      filterSearch: true,
      render: (title: string, record: Track) => <Link to={`/track/${record.id}`}>{title}</Link>,
    },
    {
      title: '专辑',
      dataIndex: 'album_title',
      key: 'album',
      ellipsis: true,
      responsive: ['sm'],
      filters: getUniqueFilters(filterOptions.albums),
      filteredValue: columnFilters.album || null,
      filterMultiple: false,
      filterSearch: true,
      render: (albumTitle: string, record: Track) => {
        if (!albumTitle) return '—';
        if (!record.album_id) return albumTitle;
        return <Link to={`/albums/${record.album_id}`}>{albumTitle}</Link>;
      },
    },
    {
      title: '备注',
      key: 'notes',
      width: 220,
      responsive: ['sm'],
      render: (_, record: Track) => (
        <Input
          value={noteDraftById[record.id] ?? record.notes ?? ''}
          placeholder="输入备注，失焦自动保存"
          allowClear
          maxLength={5000}
          size="small"
          disabled={savingNoteById[record.id]}
          onChange={(e) => setNoteDraftById((prev) => ({ ...prev, [record.id]: e.target.value }))}
          onBlur={(e) => { void handleNoteBlurSave(record, e.target.value); }}
        />
      ),
    },
    {
      title: '时长',
      dataIndex: 'duration',
      key: 'duration',
      width: 70,
      responsive: ['sm'],
      filters: [
        { text: '< 3 分钟', value: 'short' },
        { text: '3-5 分钟', value: 'medium' },
        { text: '> 5 分钟', value: 'long' },
      ],
      filteredValue: columnFilters.duration || null,
      filterMultiple: false,
      render: formatDuration,
    },
    {
      title: '歌词',
      key: 'lyrics',
      width: 92,
      filters: [
        { text: '有歌词', value: 'has' },
        { text: '无歌词', value: 'none' },
        { text: '纯音乐', value: 'instrumental' },
      ],
      filteredValue: columnFilters.lyrics || null,
      filterMultiple: false,
      render: (_, record) => {
        const status = getLyricsStatus(record);
        return (
          <Button
            icon={<FileTextOutlined />}
            className={`admin-lyrics-btn admin-lyrics-btn--${status}`}
            onClick={() => {
              setCurrentTrackId(record.id);
              setLyricsEditorVisible(true);
            }}
            size="small"
          >
            {status === 'instrumental' ? '纯音乐' : '歌词'}
          </Button>
        );
      },
    },
    {
      title: '艺术家',
      dataIndex: 'artist_names',
      key: 'artist',
      ellipsis: true,
      responsive: ['md'],
      filters: getUniqueFilters(filterOptions.artists || []),
      filteredValue: columnFilters.artist || null,
      filterMultiple: false,
      render: (artistNames: string) => artistNames || '—',
    },
    {
      title: '操作',
      key: 'actions',
      width: 230,
      render: (_, record) => (
        <Space wrap>
          <Button type="primary" icon={<PlayCircleOutlined />} onClick={() => handlePlay(record)} size="small">播放</Button>
          <Button icon={<EditOutlined />} onClick={() => handleEdit(record)} size="small">编辑</Button>
          <Button icon={<TeamOutlined />} onClick={() => { setCurrentTrackId(record.id); setCreditsEditorVisible(true); }} size="small">制作人员</Button>
          <Button icon={<TagsOutlined />} onClick={() => { setCurrentTrackId(record.id); setCurrentTrackTitle(record.title); setTagsManagerVisible(true); }} size="small">标签</Button>
          <Button icon={<DownloadOutlined />} onClick={() => handleDownload(record)} size="small" />
          <Button danger icon={<DeleteOutlined />} onClick={() => handleDelete(record)} size="small" />
        </Space>
      ),
    },
  ];

  const hasSelection = selectedRowKeys.length > 0;

  return (
    <AdminLayout>
      <Card
        title="曲目管理"
        extra={
          <Space wrap>
            <Input.Search
              placeholder="搜索曲名/专辑/艺术家..."
              allowClear
              style={{ width: 240 }}
              value={searchText}
              onChange={(event) => setSearchText(event.target.value)}
              onSearch={(value) => { setSearchText(value); void fetchTracks(1, value, pagination.pageSize, serverFilters); }}
              enterButton={<SearchOutlined />}
            />
            {hasSelection && (
              <>
                <Button icon={<TagsOutlined />} onClick={() => setBulkTagModalVisible(true)}>批量打标签 ({selectedRowKeys.length})</Button>
                <Button icon={<AppstoreOutlined />} onClick={() => setBulkMoveModalVisible(true)}>批量移动专辑 ({selectedRowKeys.length})</Button>
                <Popconfirm
                  title={`确定删除选中的 ${selectedRowKeys.length} 首曲目吗？`}
                  description="此操作不可撤销"
                  onConfirm={handleBulkDelete}
                  okText="删除"
                  cancelText="取消"
                  okType="danger"
                >
                  <Button danger>批量删除 ({selectedRowKeys.length})</Button>
                </Popconfirm>
              </>
            )}
            <Button type="primary" icon={<UploadOutlined />} onClick={() => setUploadModalVisible(true)}>上传音乐</Button>
            <Button icon={<TeamOutlined />} onClick={() => setCreditsImportModalVisible(true)}>批量导入 Credits</Button>
            <Button icon={<ImportOutlined />} onClick={() => setLyricsImportModalVisible(true)}>批量导入 LRC</Button>
            <Button icon={<ImportOutlined />} onClick={() => setTrackNotesImportModalVisible(true)}>批量导入备注</Button>
            <Button icon={<DownloadOutlined />} loading={exportingTrackNotes} onClick={handleExportTrackNotes}>导出所有备注</Button>
            <Button loading={duplicateScanLoading} onClick={handleScanDuplicates}>重复检查</Button>
          </Space>
        }
      >
        {isMobile ? (
          <List
            loading={loading}
            dataSource={tracks}
            pagination={{
              current: pagination.current,
              pageSize: pagination.pageSize,
              total: pagination.total,
              showSizeChanger: true,
              pageSizeOptions: ['10', '20', '50', '100'],
              onChange: (page, pageSize) => {
                void fetchTracks(page, searchText, pageSize || pagination.pageSize, serverFilters);
              },
            }}
            renderItem={(track) => {
              const selected = selectedRowKeys.includes(track.id);
              const coverSrc = track.cover_path || track.album_cover;
              const lyricsStatus = getLyricsStatus(track);
              return (
                <List.Item>
                  <Card style={{ width: '100%' }} bodyStyle={{ padding: 12 }}>
                    <Space align="start" style={{ width: '100%', justifyContent: 'space-between' }}>
                      <Space align="start">
                        <Button
                          size="small"
                          type={selected ? 'primary' : 'default'}
                          onClick={() => {
                            setSelectedRowKeys((prev) => (
                              prev.includes(track.id) ? prev.filter((key) => key !== track.id) : [...prev, track.id]
                            ));
                          }}
                        >
                          {selected ? '已选' : '选择'}
                        </Button>
                        <Image
                          width={48}
                          height={48}
                          src={coverSrc ? trackService.getCoverUrl(coverSrc, true) : undefined}
                          fallback={MUSIC_ICON_PLACEHOLDER}
                          style={{ borderRadius: 6, objectFit: 'cover' }}
                          preview={false}
                        />
                        <div>
                          <Typography.Text strong>{track.title}</Typography.Text>
                          <div style={{ color: 'var(--text-secondary)', fontSize: 12 }}>{track.artists?.map((artist) => artist.name).join(' / ') || '未知艺术家'}</div>
                          <Space size={6} wrap style={{ marginTop: 6 }}>
                            <Tag>{track.album_title || '未分配专辑'}</Tag>
                            <Tag>{formatDuration(track.duration ?? null)}</Tag>
                            <Tag color={lyricsStatus === 'has' ? 'green' : lyricsStatus === 'instrumental' ? 'blue' : 'red'}>
                              {lyricsStatus === 'has' ? '有歌词' : lyricsStatus === 'instrumental' ? '纯音乐' : '无歌词'}
                            </Tag>
                          </Space>
                        </div>
                      </Space>
                      <Button size="small" onClick={() => setMobileActionTrack(track)}>操作</Button>
                    </Space>
                  </Card>
                </List.Item>
              );
            }}
          />
        ) : (
          <Table
            columns={columns}
            dataSource={tracks}
            rowKey="id"
            loading={loading}
            rowSelection={rowSelection}
            pagination={{
              ...pagination,
              showSizeChanger: true,
              pageSizeOptions: ['10', '20', '50', '100'],
              showTotal: (total: number) => `共 ${total} 首曲目`,
            }}
            onChange={(nextPagination, filters) => {
              const nextColumnFilters = filters as Record<string, React.Key[] | null>;
              const nextServerFilters = normalizeTableFilters(nextColumnFilters);
              const filterChanged = !areServerFiltersEqual(serverFilters, nextServerFilters);
              setColumnFilters(nextColumnFilters);
              setServerFilters(nextServerFilters);
              const nextSize = nextPagination.pageSize || pagination.pageSize;
              const targetPage = filterChanged || nextPagination.pageSize !== pagination.pageSize ? 1 : (nextPagination.current || 1);
              void fetchTracks(targetPage, searchText, nextSize, nextServerFilters);
            }}
          />
        )}
      </Card>

      <Drawer
        title={mobileActionTrack ? `操作: ${mobileActionTrack.title}` : '操作'}
        open={!!mobileActionTrack}
        onClose={() => setMobileActionTrack(null)}
        placement="bottom"
        height={360}
      >
        {mobileActionTrack && (
          <Space direction="vertical" style={{ width: '100%' }}>
            <Button type="primary" icon={<PlayCircleOutlined />} onClick={() => handlePlay(mobileActionTrack)}>播放</Button>
            <Button icon={<EditOutlined />} onClick={() => handleEdit(mobileActionTrack)}>编辑</Button>
            <Button icon={<TeamOutlined />} onClick={() => { setCurrentTrackId(mobileActionTrack.id); setCreditsEditorVisible(true); }}>制作人员</Button>
            <Button icon={<TagsOutlined />} onClick={() => { setCurrentTrackId(mobileActionTrack.id); setCurrentTrackTitle(mobileActionTrack.title); setTagsManagerVisible(true); }}>标签</Button>
            <Button icon={<FileTextOutlined />} onClick={() => { setCurrentTrackId(mobileActionTrack.id); setLyricsEditorVisible(true); }}>歌词</Button>
            <Button icon={<DownloadOutlined />} onClick={() => handleDownload(mobileActionTrack)}>下载</Button>
            <Button danger icon={<DeleteOutlined />} onClick={() => handleDelete(mobileActionTrack)}>删除</Button>
          </Space>
        )}
      </Drawer>

      <Modal title="编辑曲目信息" open={editModalVisible} onOk={handleEditSave} onCancel={() => setEditModalVisible(false)} okText="保存" cancelText="取消">
        <Form form={form} layout="vertical">
          <Form.Item name="title" label="标题" rules={[{ required: true, message: '请输入标题' }]}><Input /></Form.Item>
          <Form.Item name="album_title" label="专辑"><Input /></Form.Item>
          <Form.Item name="release_date" label="发行日期"><DatePicker style={{ width: '100%' }} placeholder="选择发行日期" /></Form.Item>
          <Form.Item name="track_number" label="曲目编号"><InputNumber min={1} style={{ width: '100%' }} placeholder="曲目编号" /></Form.Item>
          <Form.Item name="notes" label="备注"><Input.TextArea rows={3} placeholder="曲目备注信息（可选）" maxLength={5000} showCount /></Form.Item>
        </Form>
      </Modal>

      {currentTrackId && (
        <LyricsEditor
          trackId={currentTrackId}
          visible={lyricsEditorVisible}
          onClose={() => setLyricsEditorVisible(false)}
          onSuccess={() => { message.success('歌词已更新'); void fetchTracks(pagination.current); }}
        />
      )}

      {currentTrackId && (
        <CreditsEditor
          trackId={currentTrackId}
          visible={creditsEditorVisible}
          onClose={() => setCreditsEditorVisible(false)}
          onSuccess={() => { message.success('制作人员信息已更新'); }}
        />
      )}

      {currentTrackId && (
        <TrackTagsManager
          trackId={currentTrackId}
          trackTitle={currentTrackTitle}
          visible={tagsManagerVisible}
          onClose={() => setTagsManagerVisible(false)}
          onTagsUpdated={() => { message.success('标签已更新'); void fetchTracks(pagination.current); }}
        />
      )}

      <UploadModal
        visible={uploadModalVisible}
        onClose={() => setUploadModalVisible(false)}
        onSuccess={() => {
          setUploadModalVisible(false);
          void fetchTracks(pagination.current);
          void loadTrackFilterOptions();
        }}
      />

      <CreditsImportModal
        visible={creditsImportModalVisible}
        onClose={() => setCreditsImportModalVisible(false)}
        onSuccess={() => { message.success('Credits 导入成功'); void fetchTracks(pagination.current); }}
      />

      <LyricsBatchImportModal
        visible={lyricsImportModalVisible}
        onClose={() => setLyricsImportModalVisible(false)}
        onSuccess={() => { message.success('LRC 导入成功'); void fetchTracks(pagination.current); }}
      />

      <TrackNotesImportModal
        visible={trackNotesImportModalVisible}
        onClose={() => setTrackNotesImportModalVisible(false)}
        onSuccess={() => { message.success('备注导入成功'); void fetchTracks(pagination.current); }}
      />

      <BulkTagModal
        visible={bulkTagModalVisible}
        trackIds={selectedRowKeys as number[]}
        onClose={() => setBulkTagModalVisible(false)}
        onSuccess={() => {
          message.success('批量标签操作成功');
          setBulkTagModalVisible(false);
          void fetchTracks(pagination.current);
        }}
      />

      <BulkMoveAlbumModal
        visible={bulkMoveModalVisible}
        trackIds={selectedRowKeys as number[]}
        onClose={() => setBulkMoveModalVisible(false)}
        onSuccess={() => {
          message.success('批量移动专辑成功');
          setBulkMoveModalVisible(false);
          void fetchTracks(pagination.current);
          void loadTrackFilterOptions();
        }}
      />

      <Modal
        title="同专辑同曲名重复检查"
        open={duplicateModalVisible}
        onCancel={() => setDuplicateModalVisible(false)}
        footer={<Button onClick={() => setDuplicateModalVisible(false)}>关闭</Button>}
        width={900}
      >
        <Table
          rowKey={(row) => `${row.album_id ?? 'none'}-${row.normalized_title}`}
          size="small"
          pagination={{ pageSize: 8 }}
          dataSource={duplicateGroups}
          columns={[
            { title: '专辑', dataIndex: 'album_title', key: 'album_title', width: 240 },
            { title: '曲名', dataIndex: 'display_title', key: 'display_title', width: 240 },
            { title: '重复数量', dataIndex: 'duplicate_count', key: 'duplicate_count', width: 100 },
            {
              title: '曲目ID/艺术家',
              key: 'tracks',
              render: (_, row) => row.tracks.map((t) => `#${t.id} ${t.artists.join('/') || '未知艺术家'}`).join(' | '),
            },
          ]}
        />
      </Modal>
    </AdminLayout>
  );
};

export default Admin;

