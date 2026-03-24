import React, { useEffect, useRef, useState } from 'react';
import {
  Table, Button, message, Space, Image, Modal, Form, Input, Card,
  DatePicker, InputNumber, Popconfirm
} from 'antd';
import {
  UploadOutlined,
  ImportOutlined,
  PlayCircleOutlined,
  DownloadOutlined,
  EditOutlined,
  DeleteOutlined,
  FileTextOutlined,
  TeamOutlined,
  TagsOutlined,
  AppstoreOutlined,
  SearchOutlined
} from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import type { TableRowSelection } from 'antd/es/table/interface';
import dayjs from 'dayjs';
import { Link } from 'react-router-dom';
import { Track } from '../types';
import { trackService, type AdminTrackFilters, type SameAlbumDuplicateGroup } from '../services/trackService';
import { usePlayerStore } from '../store/playerStore';
import { MUSIC_ICON_PLACEHOLDER } from '../utils/imageUtils';
import LyricsEditor from '../components/LyricsEditor';
import CreditsEditor from '../components/CreditsEditor';
import CreditsImportModal from '../components/CreditsImportModal';
import TrackTagsManager from '../components/TrackTagsManager';
import BulkTagModal from '../components/BulkTagModal';
import BulkMoveAlbumModal from '../components/BulkMoveAlbumModal';
import AdminLayout from '../components/AdminLayout';
import UploadModal from '../components/UploadModal';
import LyricsBatchImportModal from '../components/LyricsBatchImportModal';
import './Admin.css';

const Admin: React.FC = () => {
  const [tracks, setTracks] = useState<Track[]>([]);
  const [loading, setLoading] = useState(false);
  const [uploadModalVisible, setUploadModalVisible] = useState(false);
  const [pagination, setPagination] = useState({ current: 1, pageSize: 20, total: 0 });
  const [editingTrack, setEditingTrack] = useState<Track | null>(null);
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [lyricsEditorVisible, setLyricsEditorVisible] = useState(false);
  const [creditsEditorVisible, setCreditsEditorVisible] = useState(false);
  const [tagsManagerVisible, setTagsManagerVisible] = useState(false);
  const [currentTrackId, setCurrentTrackId] = useState<number | null>(null);
  const [currentTrackTitle, setCurrentTrackTitle] = useState<string>('');
  const [form] = Form.useForm();

  // Bulk operations state
  const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([]);
  const [bulkTagModalVisible, setBulkTagModalVisible] = useState(false);
  const [bulkMoveModalVisible, setBulkMoveModalVisible] = useState(false);
  const [creditsImportModalVisible, setCreditsImportModalVisible] = useState(false);
  const [lyricsImportModalVisible, setLyricsImportModalVisible] = useState(false);
  const [duplicateModalVisible, setDuplicateModalVisible] = useState(false);
  const [duplicateScanLoading, setDuplicateScanLoading] = useState(false);
  const [duplicateGroups, setDuplicateGroups] = useState<SameAlbumDuplicateGroup[]>([]);

  // Search state
  const [searchText, setSearchText] = useState('');
  const [columnFilters, setColumnFilters] = useState<Record<string, React.Key[] | null>>({});
  const [serverFilters, setServerFilters] = useState<AdminTrackFilters>({});
  const [filterOptions, setFilterOptions] = useState<{ titles: string[]; albums: string[] }>({ titles: [], albums: [] });
  const [noteDraftById, setNoteDraftById] = useState<Record<number, string>>({});
  const [savingNoteById, setSavingNoteById] = useState<Record<number, boolean>>({});
  const noteSaveSeqRef = useRef<Record<number, number>>({});

  const { playTrackOnly } = usePlayerStore();

  const fetchTracks = async (page = 1, search?: string, pageSize?: number, filters?: AdminTrackFilters) => {
    const searchVal = search !== undefined ? search : searchText;
    const size = pageSize ?? pagination.pageSize;
    const activeFilters = filters ?? serverFilters;
    setLoading(true);
    try {
      const data = await trackService.getTracks(page, size, searchVal, activeFilters);
      setTracks(data.tracks);
      setPagination(prev => ({
        ...prev,
        current: data.pagination.page,
        total: data.pagination.total,
        pageSize: size,
      }));
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
    fetchTracks();
    loadTrackFilterOptions();
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

  const handlePlay = (track: Track) => {
    playTrackOnly(track);
  };

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
      if (editingTrack) {
        await trackService.updateTrack(editingTrack.id, {
          title: values.title,
          // 艺术家不在前端展示/编辑，保持原有值
          artists: editingTrack.artists.map(a => a.name),
          album_title: values.album_title || '',
          release_date: values.release_date ? values.release_date.format('YYYY-MM-DD') : undefined,
          track_number: values.track_number || undefined,
          notes: values.notes || null,
        });
        message.success('曲目信息已更新');
        setEditModalVisible(false);
        fetchTracks(pagination.current);
        loadTrackFilterOptions();
      }
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
          fetchTracks(pagination.current);
          loadTrackFilterOptions();
        } catch (error: any) {
          message.error(error.message || '删除失败');
        }
      },
    });
  };

  const handleNoteBlurSave = async (track: Track, rawValue: string) => {
    const normalizedValue = rawValue.trim();
    const nextNote = normalizedValue ? normalizedValue : null;
    const currentNote = track.notes ?? null;

    if ((currentNote ?? '') === (nextNote ?? '')) {
      // 失焦时统一把草稿归一化，避免仅空格造成“未保存”错觉
      setNoteDraftById(prev => ({ ...prev, [track.id]: nextNote ?? '' }));
      return;
    }

    const previousNote = track.notes ?? null;
    const nextSeq = (noteSaveSeqRef.current[track.id] ?? 0) + 1;
    noteSaveSeqRef.current[track.id] = nextSeq;

    setSavingNoteById(prev => ({ ...prev, [track.id]: true }));
    setNoteDraftById(prev => ({ ...prev, [track.id]: nextNote ?? '' }));
    setTracks(prev => prev.map(item => (
      item.id === track.id ? { ...item, notes: nextNote } : item
    )));

    try {
      await trackService.updateTrack(track.id, {
        title: track.title,
        artists: track.artists.map(a => a.name),
        notes: nextNote,
      });
    } catch (error: any) {
      if (noteSaveSeqRef.current[track.id] !== nextSeq) {
        return;
      }
      setTracks(prev => prev.map(item => (
        item.id === track.id ? { ...item, notes: previousNote } : item
      )));
      setNoteDraftById(prev => ({ ...prev, [track.id]: previousNote ?? '' }));
      message.error(error.message || '备注保存失败');
    } finally {
      if (noteSaveSeqRef.current[track.id] === nextSeq) {
        setSavingNoteById(prev => ({ ...prev, [track.id]: false }));
      }
    }
  };

  const handleBulkDelete = async () => {
    try {
      await trackService.bulkDeleteTracks(selectedRowKeys as number[]);
      message.success(`成功删除 ${selectedRowKeys.length} 首曲目`);
      setSelectedRowKeys([]);
      fetchTracks(pagination.current);
      loadTrackFilterOptions();
    } catch (error: any) {
      message.error(error.message || '批量删除失败');
    }
  };

  const formatDuration = (seconds: number | null) => {
    if (!seconds) return '--:--';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const hasLyrics = (track: Track) => {
    const fromPath = typeof track.lyrics_path === 'string' && track.lyrics_path.trim().length > 0;
    const fromInline = typeof track.lyrics === 'string' && track.lyrics.trim().length > 0;
    return fromPath || fromInline;
  };

  const getUniqueFilters = (values: Array<string | null | undefined>) => {
    const unique = Array.from(new Set(values.map((item) => (item || '').trim()).filter(Boolean)));
    return unique
      .sort((a, b) => a.localeCompare(b, 'zh-CN'))
      .map((value) => ({ text: value, value }));
  };

  const normalizeTableFilters = (filters: Record<string, React.Key[] | null>): AdminTrackFilters => {
    const title = filters.title?.[0] ? String(filters.title[0]) : undefined;
    const album = filters.album?.[0] ? String(filters.album[0]) : undefined;
    const durationBucketRaw = filters.duration?.[0] ? String(filters.duration[0]) : undefined;
    const durationBucket = durationBucketRaw === 'short' || durationBucketRaw === 'medium' || durationBucketRaw === 'long'
      ? durationBucketRaw
      : undefined;
    const lyricsRaw = filters.lyrics?.[0] ? String(filters.lyrics[0]) : undefined;
    const hasLyrics = lyricsRaw === 'has' ? true : lyricsRaw === 'missing' ? false : undefined;

    return {
      title,
      album,
      durationBucket,
      hasLyrics,
    };
  };

  const areServerFiltersEqual = (a: AdminTrackFilters, b: AdminTrackFilters) => (
    a.title === b.title
    && a.album === b.album
    && a.durationBucket === b.durationBucket
    && a.hasLyrics === b.hasLyrics
  );

  const handleScanDuplicates = async () => {
    setDuplicateScanLoading(true);
    try {
      const groups = await trackService.getSameAlbumDuplicateTracks();
      setDuplicateGroups(groups);
      setDuplicateModalVisible(true);
      if (groups.length === 0) {
        message.success('未发现同专辑同曲名重复项');
      }
    } catch (error: any) {
      message.error(error.message || '重复检查失败');
    } finally {
      setDuplicateScanLoading(false);
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
        const thumbSrc = coverSrc
          ? trackService.getCoverUrl(coverSrc, true)
          : undefined;
        const fullSrc = coverSrc
          ? trackService.getCoverUrl(coverSrc)
          : undefined;
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
          onChange={(e) => {
            const value = e.target.value;
            setNoteDraftById(prev => ({ ...prev, [record.id]: value }));
          }}
          onBlur={(e) => {
            void handleNoteBlurSave(record, e.target.value);
          }}
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
        { text: '已写入', value: 'has' },
        { text: '未写入', value: 'missing' },
      ],
      filteredValue: columnFilters.lyrics || null,
      filterMultiple: false,
      render: (_, record) => {
        const written = hasLyrics(record);
        return (
          <Button
            icon={<FileTextOutlined />}
            className={`admin-lyrics-btn ${written ? 'admin-lyrics-btn--has' : 'admin-lyrics-btn--missing'}`}
            onClick={() => {
              setCurrentTrackId(record.id);
              setLyricsEditorVisible(true);
            }}
            size="small"
          >
            歌词
          </Button>
        );
      },
    },
    {
      title: '操作',
      key: 'actions',
      width: 230,
      render: (_, record) => (
        <Space wrap>
          <Button
            type="primary"
            icon={<PlayCircleOutlined />}
            onClick={() => handlePlay(record)}
            size="small"
          >
            播放
          </Button>
          <Button
            icon={<EditOutlined />}
            onClick={() => handleEdit(record)}
            size="small"
          >
            编辑
          </Button>
          <Button
            icon={<TeamOutlined />}
            onClick={() => {
              setCurrentTrackId(record.id);
              setCreditsEditorVisible(true);
            }}
            size="small"
          >
            制作人员
          </Button>
          <Button
            icon={<TagsOutlined />}
            onClick={() => {
              setCurrentTrackId(record.id);
              setCurrentTrackTitle(record.title);
              setTagsManagerVisible(true);
            }}
            size="small"
          >
            标签
          </Button>
          <Button
            icon={<DownloadOutlined />}
            onClick={() => handleDownload(record)}
            size="small"
          />
          <Button
            danger
            icon={<DeleteOutlined />}
            onClick={() => handleDelete(record)}
            size="small"
          />
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
          <Space>
            <Input.Search
              placeholder="搜索曲名/专辑/艺术家..."
              allowClear
              style={{ width: 240 }}
              value={searchText}
              onChange={e => setSearchText(e.target.value)}
              onSearch={(val) => { setSearchText(val); fetchTracks(1, val, undefined, serverFilters); }}
              enterButton={<SearchOutlined />}
            />
            {hasSelection && (
              <>
                <Button
                  icon={<TagsOutlined />}
                  onClick={() => setBulkTagModalVisible(true)}
                >
                  批量打标签 ({selectedRowKeys.length})
                </Button>
                <Button
                  icon={<AppstoreOutlined />}
                  onClick={() => setBulkMoveModalVisible(true)}
                >
                  批量移动专辑 ({selectedRowKeys.length})
                </Button>
                <Popconfirm
                  title={`确定删除选中的 ${selectedRowKeys.length} 首曲目吗？`}
                  description="此操作不可撤销"
                  onConfirm={handleBulkDelete}
                  okText="删除"
                  cancelText="取消"
                  okType="danger"
                >
                  <Button danger>
                    批量删除 ({selectedRowKeys.length})
                  </Button>
                </Popconfirm>
              </>
            )}
            <Button
              type="primary"
              icon={<UploadOutlined />}
              onClick={() => setUploadModalVisible(true)}
            >
              上传音乐
            </Button>
            <Button
              icon={<TeamOutlined />}
              onClick={() => setCreditsImportModalVisible(true)}
            >
              批量导入 Credits
            </Button>
            <Button
              icon={<ImportOutlined />}
              onClick={() => setLyricsImportModalVisible(true)}
            >
              批量导入 LRC
            </Button>
            <Button loading={duplicateScanLoading} onClick={handleScanDuplicates}>
              重复检查
            </Button>
          </Space>
        }
      >
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
          onChange={(newPagination, filters) => {
            const nextColumnFilters = filters as Record<string, React.Key[] | null>;
            const nextServerFilters = normalizeTableFilters(nextColumnFilters);
            const filterChanged = !areServerFiltersEqual(serverFilters, nextServerFilters);

            setColumnFilters(nextColumnFilters);
            setServerFilters(nextServerFilters);

            const newSize = newPagination.pageSize || pagination.pageSize;
            const shouldResetPage = filterChanged || newPagination.pageSize !== pagination.pageSize;
            const targetPage = shouldResetPage ? 1 : (newPagination.current || 1);
            fetchTracks(targetPage, undefined, newSize, nextServerFilters);
          }}
        />
      </Card>

      {/* Edit Modal */}
      <Modal
        title="编辑曲目信息"
        open={editModalVisible}
        onOk={handleEditSave}
        onCancel={() => setEditModalVisible(false)}
        okText="保存"
        cancelText="取消"
      >
        <Form form={form} layout="vertical">
          <Form.Item name="title" label="标题" rules={[{ required: true, message: '请输入标题' }]}>
            <Input />
          </Form.Item>
          <Form.Item name="album_title" label="专辑">
            <Input />
          </Form.Item>
          <Form.Item name="release_date" label="发行日期">
            <DatePicker style={{ width: '100%' }} placeholder="选择发行日期" />
          </Form.Item>
          <Form.Item name="track_number" label="曲目编号">
            <InputNumber min={1} style={{ width: '100%' }} placeholder="曲目编号" />
          </Form.Item>
          <Form.Item name="notes" label="备注">
            <Input.TextArea rows={3} placeholder="曲目备注信息（可选）" maxLength={5000} showCount />
          </Form.Item>
        </Form>
      </Modal>

      {/* Lyrics Editor */}
      {currentTrackId && (
        <LyricsEditor
          trackId={currentTrackId}
          visible={lyricsEditorVisible}
          onClose={() => setLyricsEditorVisible(false)}
          onSuccess={() => {
            message.success('歌词已更新');
          }}
        />
      )}

      {/* Credits Editor */}
      {currentTrackId && (
        <CreditsEditor
          trackId={currentTrackId}
          visible={creditsEditorVisible}
          onClose={() => setCreditsEditorVisible(false)}
          onSuccess={() => {
            message.success('制作人员信息已更新');
          }}
        />
      )}

      {/* Tags Manager */}
      {currentTrackId && (
        <TrackTagsManager
          trackId={currentTrackId}
          trackTitle={currentTrackTitle}
          visible={tagsManagerVisible}
          onClose={() => setTagsManagerVisible(false)}
          onTagsUpdated={() => {
            message.success('标签已更新');
            fetchTracks(pagination.current);
          }}
        />
      )}

      {/* Upload Modal */}
      <UploadModal
        visible={uploadModalVisible}
        onClose={() => setUploadModalVisible(false)}
        onSuccess={() => {
          setUploadModalVisible(false);
          fetchTracks(pagination.current);
          loadTrackFilterOptions();
        }}
      />

      {/* Credits Import Modal */}
      <CreditsImportModal
        visible={creditsImportModalVisible}
        onClose={() => setCreditsImportModalVisible(false)}
        onSuccess={() => {
          message.success('Credits 导入成功');
          fetchTracks(pagination.current);
        }}
      />

      <LyricsBatchImportModal
        visible={lyricsImportModalVisible}
        onClose={() => setLyricsImportModalVisible(false)}
        onSuccess={() => {
          message.success('LRC 导入成功');
          fetchTracks(pagination.current);
        }}
      />

      {/* Bulk Tag Modal */}
      <BulkTagModal
        visible={bulkTagModalVisible}
        trackIds={selectedRowKeys as number[]}
        onClose={() => setBulkTagModalVisible(false)}
        onSuccess={() => {
          message.success('批量标签操作成功');
          setBulkTagModalVisible(false);
          fetchTracks(pagination.current);
        }}
      />

      {/* Bulk Move Album Modal */}
      <BulkMoveAlbumModal
        visible={bulkMoveModalVisible}
        trackIds={selectedRowKeys as number[]}
        onClose={() => setBulkMoveModalVisible(false)}
        onSuccess={() => {
          message.success('批量移动专辑成功');
          setBulkMoveModalVisible(false);
          fetchTracks(pagination.current);
          loadTrackFilterOptions();
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

