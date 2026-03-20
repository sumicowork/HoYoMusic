import React, { useEffect, useState } from 'react';
import { Table, Button, message, Space, Image, Modal, Form, Input, Select, DatePicker, Card, InputNumber, List, Popconfirm, Divider } from 'antd';
import {
  EditOutlined,
  PictureOutlined,
  AppstoreOutlined,
  CalendarOutlined,
  DatabaseOutlined,
  PlusOutlined,
  DeleteOutlined,
  DownloadOutlined,
} from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import type { TableRowSelection } from 'antd/es/table/interface';
import { albumService, Album } from '../services/albumService';
import { creditsService } from '../services/creditsService';
import { gameService, Game } from '../services/gameService';
import { discService, Disc } from '../services/discService';
import { Link, useNavigate } from 'react-router-dom';
import dayjs from 'dayjs';
import AlbumCoverUpload from '../components/AlbumCoverUpload';
import AdminLayout from '../components/AdminLayout';
import { getCoverUrl } from '../utils/imageUtils';
import { Track } from '../types';

const AlbumManagement: React.FC = () => {
  const [albums, setAlbums] = useState<Album[]>([]);
  const [games, setGames] = useState<Game[]>([]);
  const [loading, setLoading] = useState(false);
  const [pagination, setPagination] = useState({ current: 1, pageSize: 20, total: 0 });
  const [editingAlbum, setEditingAlbum] = useState<Album | null>(null);
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [coverUploadVisible, setCoverUploadVisible] = useState(false);
  const [selectedAlbumForCover, setSelectedAlbumForCover] = useState<Album | null>(null);
  const [form] = Form.useForm();
  const navigate = useNavigate();

  // Bulk game assignment
  const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([]);
  const [bulkGameModalVisible, setBulkGameModalVisible] = useState(false);
  const [bulkGameId, setBulkGameId] = useState<number | null>(null);
  const [exportingCredits, setExportingCredits] = useState(false);
  const [exportModalVisible, setExportModalVisible] = useState(false);
  const [exportAlbumIds, setExportAlbumIds] = useState<number[]>([]);
  const [exportAlbums, setExportAlbums] = useState<Album[]>([]);
  const [exportLoading, setExportLoading] = useState(false);
  const [exportSearchText, setExportSearchText] = useState('');
  const [exportPagination, setExportPagination] = useState({ current: 1, pageSize: 20, total: 0 });
  const [bpmDetectingAlbumId, setBpmDetectingAlbumId] = useState<number | null>(null);
  const [batchBpmRunning, setBatchBpmRunning] = useState(false);

  // Disc management
  const [discModalVisible, setDiscModalVisible] = useState(false);
  const [discAlbum, setDiscAlbum] = useState<Album | null>(null);
  const [discs, setDiscs] = useState<Disc[]>([]);
  const [discLoading, setDiscLoading] = useState(false);
  const [discForm] = Form.useForm();
  const [discTracks, setDiscTracks] = useState<Track[]>([]);
  const [discAssignments, setDiscAssignments] = useState<Record<number, number | null>>({});
  const [selectedDiscTrackKeys, setSelectedDiscTrackKeys] = useState<React.Key[]>([]);
  const [bulkTargetDiscId, setBulkTargetDiscId] = useState<number | null>(null);
  const [rangeStart, setRangeStart] = useState<number | null>(null);
  const [rangeEnd, setRangeEnd] = useState<number | null>(null);
  const [rangeTargetDiscId, setRangeTargetDiscId] = useState<number | null>(null);
  const [sequentialDiscCounts, setSequentialDiscCounts] = useState<Record<number, number>>({});
  const [releaseDateDraftById, setReleaseDateDraftById] = useState<Record<number, string>>({});
  const [savingReleaseDateById, setSavingReleaseDateById] = useState<Record<number, boolean>>({});


  const fetchAlbums = async (page = 1, pageSize?: number) => {
    const size = pageSize ?? pagination.pageSize;
    setLoading(true);
    try {
      const data = await albumService.getAlbums(page, size);
      setAlbums(data.albums);
      setPagination(prev => ({
        ...prev,
        current: data.pagination.page,
        total: data.pagination.total,
        pageSize: size,
      }));
    } catch (error: any) {
      message.error(error.message || '获取专辑列表失败');
    } finally {
      setLoading(false);
    }
  };

  const fetchGames = async () => {
    try {
      const data = await gameService.getGames();
      setGames(data);
    } catch (error: any) {
      message.error(error.message || '获取游戏列表失败');
    }
  };

  useEffect(() => {
    fetchAlbums();
    fetchGames();
  }, []);

  useEffect(() => {
    setReleaseDateDraftById((prev) => {
      const next: Record<number, string> = {};
      albums.forEach((album) => {
        const compact = album.release_date ? dayjs(album.release_date).format('YYYYMMDD') : '';
        next[album.id] = prev[album.id] ?? compact;
      });
      return next;
    });
  }, [albums]);

  const compactToIsoDate = (value: string): string | null => {
    const normalized = value.trim();
    if (!normalized) return null;
    if (!/^\d{8}$/.test(normalized)) return null;
    const iso = `${normalized.slice(0, 4)}-${normalized.slice(4, 6)}-${normalized.slice(6, 8)}`;
    return dayjs(iso, 'YYYY-MM-DD', true).isValid() ? iso : null;
  };

  const handleReleaseDateBlurSave = async (album: Album, rawValue: string) => {
    const trimmed = rawValue.trim();
    const currentIso = album.release_date ? dayjs(album.release_date).format('YYYY-MM-DD') : null;

    if (trimmed && !/^\d{8}$/.test(trimmed)) {
      message.error('发行日期请使用 YYYYMMDD 格式');
      setReleaseDateDraftById((prev) => ({ ...prev, [album.id]: album.release_date ? dayjs(album.release_date).format('YYYYMMDD') : '' }));
      return;
    }

    const nextIso = compactToIsoDate(trimmed);
    if (trimmed && !nextIso) {
      message.error('发行日期无效，请检查日期是否正确');
      setReleaseDateDraftById((prev) => ({ ...prev, [album.id]: album.release_date ? dayjs(album.release_date).format('YYYYMMDD') : '' }));
      return;
    }

    if (currentIso === nextIso) {
      setReleaseDateDraftById((prev) => ({ ...prev, [album.id]: nextIso ? dayjs(nextIso).format('YYYYMMDD') : '' }));
      return;
    }

    setSavingReleaseDateById((prev) => ({ ...prev, [album.id]: true }));
    try {
      await albumService.updateAlbum(album.id, {
        title: album.title,
        game_id: album.game_id || null,
        release_date: nextIso,
        notes: album.notes || null,
      });

      setAlbums((prev) => prev.map((item) => (item.id === album.id ? { ...item, release_date: nextIso || '' } : item)));
      setReleaseDateDraftById((prev) => ({ ...prev, [album.id]: nextIso ? dayjs(nextIso).format('YYYYMMDD') : '' }));
      message.success('发行日期已更新');
    } catch (error: any) {
      message.error(error.message || '发行日期更新失败');
      setReleaseDateDraftById((prev) => ({ ...prev, [album.id]: album.release_date ? dayjs(album.release_date).format('YYYYMMDD') : '' }));
    } finally {
      setSavingReleaseDateById((prev) => ({ ...prev, [album.id]: false }));
    }
  };

  const handleEdit = (album: Album) => {
    setEditingAlbum(album);
    form.setFieldsValue({
      title: album.title,
      game_id: album.game_id,
      release_date: album.release_date ? dayjs(album.release_date) : null,
      notes: album.notes || '',
    });
    setEditModalVisible(true);
  };

  const handleEditSave = async () => {
    try {
      const values = await form.validateFields();
      if (editingAlbum) {
        const updateData = {
          title: values.title,
          game_id: values.game_id || null,
          release_date: values.release_date ? values.release_date.format('YYYY-MM-DD') : null,
          notes: values.notes || null,
        };

        console.log('Updating album with data:', updateData);

        await albumService.updateAlbum(editingAlbum.id, updateData);
        message.success('专辑更新成功！');
        setEditModalVisible(false);
        fetchAlbums(pagination.current);
      }
    } catch (error: any) {
      console.error('Update error:', error);
      message.error(error.message || '更新失败，请重试');
    }
  };

  const handleUploadCover = (album: Album) => {
    setSelectedAlbumForCover(album);
    setCoverUploadVisible(true);
  };

  const handleCoverUploadSuccess = () => {
    message.success('封面更新成功！');
    setCoverUploadVisible(false);
    fetchAlbums(pagination.current);
  };

  const handleRescanDates = async (album: Album) => {
    try {
      const result = await albumService.rescanDates(album.id);
      message.success(result.message || `成功更新发行日期`);
      fetchAlbums(pagination.current);
    } catch (error: any) {
      message.error(error.message || '重新读取日期失败');
    }
  };

  const showBpmDetectResult = (result: Awaited<ReturnType<typeof albumService.detectBpm>>) => {
    const baseMsg = `BPM检测完成：共 ${result.total} 首，成功打标 ${result.tagged} 首`;
    if (result.failed > 0 || result.skipped > 0) {
      message.warning(`${baseMsg}，跳过 ${result.skipped} 首，失败 ${result.failed} 首`);
    } else {
      message.success(baseMsg);
    }

    if (result.low_confidence_tagged > 0) {
      const lowConfidenceRows = result.details
        .filter((row) => row.status === 'tagged' && row.low_confidence)
        .sort((a, b) => (a.confidence ?? 1) - (b.confidence ?? 1));

      Modal.info({
        title: `低置信度BPM（${lowConfidenceRows.length} 首）`,
        width: 680,
        okText: '知道了',
        content: (
          <div style={{ maxHeight: 360, overflow: 'auto' }}>
            <div style={{ marginBottom: 8, color: 'var(--text-secondary)' }}>
              建议人工复核以下曲目（置信度阈值 &lt; 0.55）。
            </div>
            {lowConfidenceRows.map((row) => (
              <div key={row.track_id} style={{ marginBottom: 6 }}>
                #{row.track_id} {row.title} - {row.tag} | 置信度 {(row.confidence ?? 0).toFixed(2)} | {row.method}
              </div>
            ))}
          </div>
        ),
      });
    }
  };

  const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

  const handleDetectBpm = async (album: Album) => {
    const progressMsgKey = `bpm-task-${album.id}`;
    try {
      setBpmDetectingAlbumId(album.id);
      let task = await albumService.createDetectBpmTask(album.id);

      const startedAt = Date.now();
      const maxWaitMs = 45 * 60 * 1000;
      const pollIntervalMs = 3000;

      while (task.status === 'running') {
        if (Date.now() - startedAt > maxWaitMs) {
          throw new Error('BPM检测任务等待超时，请稍后在后台重试');
        }

        message.open({
          key: progressMsgKey,
          type: 'loading',
          duration: 0,
          content: `BPM检测中：${task.processed}/${task.total || '?'}（成功 ${task.tagged}，跳过 ${task.skipped}，失败 ${task.failed}）`,
        });

        await sleep(pollIntervalMs);
        task = await albumService.getDetectBpmTask(album.id, task.task_id);
      }

      message.destroy(progressMsgKey);

      if (task.status === 'failed') {
        throw new Error(task.error || 'BPM检测任务失败');
      }

      if (!task.result) {
        throw new Error('BPM检测任务未返回结果');
      }

      showBpmDetectResult(task.result);
    } catch (error: any) {
      message.destroy(progressMsgKey);
      message.error(error.message || '批量BPM检测失败');
    } finally {
      setBpmDetectingAlbumId(null);
    }
  };

  const fetchAllAlbumsForBpm = async (): Promise<Album[]> => {
    const limit = 100;
    let page = 1;
    let totalPages = 1;
    const all: Album[] = [];

    while (page <= totalPages) {
      const data = await albumService.getAlbums(page, limit);
      all.push(...data.albums);
      totalPages = data.pagination?.totalPages || 1;
      page += 1;
    }

    return all;
  };

  const runSingleAlbumBpmTask = async (album: Album): Promise<void> => {
    let task = await albumService.createDetectBpmTask(album.id);
    const startedAt = Date.now();
    const maxWaitMs = 45 * 60 * 1000;
    const pollIntervalMs = 3000;

    while (task.status === 'running') {
      if (Date.now() - startedAt > maxWaitMs) {
        throw new Error('任务等待超时');
      }
      await sleep(pollIntervalMs);
      task = await albumService.getDetectBpmTask(album.id, task.task_id);
    }

    if (task.status === 'failed') {
      throw new Error(task.error || '任务失败');
    }
  };

  const handleBatchDetectBpm = async () => {
    if (batchBpmRunning) return;

    const confirmed = await new Promise<boolean>((resolve) => {
      Modal.confirm({
        title: '一键 BPM 检测',
        content: '将把全部专辑加入 BPM 检测队列，并按最多 2 个并行任务处理。是否继续？',
        okText: '开始检测',
        cancelText: '取消',
        onOk: () => resolve(true),
        onCancel: () => resolve(false),
      });
    });

    if (!confirmed) return;

    const progressMsgKey = 'bpm-batch-task';
    setBatchBpmRunning(true);

    try {
      const allAlbums = await fetchAllAlbumsForBpm();
      if (allAlbums.length === 0) {
        message.info('当前没有可检测的专辑');
        return;
      }

      const total = allAlbums.length;
      let done = 0;
      let success = 0;
      let failed = 0;
      const failedAlbums: Array<{ id: number; title: string; error: string }> = [];
      let cursor = 0;

      const updateProgress = () => {
        message.open({
          key: progressMsgKey,
          type: 'loading',
          duration: 0,
          content: `BPM批量检测中：${done}/${total}（成功 ${success}，失败 ${failed}）`,
        });
      };

      updateProgress();

      const worker = async () => {
        while (true) {
          const idx = cursor;
          cursor += 1;
          if (idx >= total) break;

          const album = allAlbums[idx];
          try {
            await runSingleAlbumBpmTask(album);
            success += 1;
          } catch (error: any) {
            failed += 1;
            failedAlbums.push({ id: album.id, title: album.title, error: error?.message || '未知错误' });
          } finally {
            done += 1;
            updateProgress();
          }
        }
      };

      await Promise.all([worker(), worker()]);
      message.destroy(progressMsgKey);

      if (failed === 0) {
        message.success(`BPM批量检测完成：${success}/${total} 全部成功`);
      } else {
        Modal.warning({
          title: `BPM批量检测完成：成功 ${success}，失败 ${failed}`,
          width: 760,
          content: (
            <div style={{ maxHeight: 320, overflowY: 'auto' }}>
              {failedAlbums.map((item) => (
                <div key={item.id} style={{ marginBottom: 6 }}>
                  #{item.id} {item.title}：{item.error}
                </div>
              ))}
            </div>
          ),
          okText: '知道了',
        });
      }

      fetchAlbums(pagination.current);
    } catch (error: any) {
      message.destroy(progressMsgKey);
      message.error(error.message || '一键BPM检测失败');
    } finally {
      setBatchBpmRunning(false);
    }
  };

  // ── Disc management ──────────────────────
  const handleManageDiscs = async (album: Album) => {
    setDiscAlbum(album);
    setDiscModalVisible(true);
    setDiscLoading(true);
    setSelectedDiscTrackKeys([]);
    setBulkTargetDiscId(null);
    setRangeStart(null);
    setRangeEnd(null);
    setRangeTargetDiscId(null);
    try {
      const [discData, albumDetail] = await Promise.all([
        discService.getDiscs(album.id),
        albumService.getAlbumById(album.id),
      ]);
      setDiscs(discData);
      const initialCounts: Record<number, number> = {};
      discData.forEach((disc) => {
        initialCounts[disc.id] = 0;
      });
      setSequentialDiscCounts(initialCounts);
      const tracks: Track[] = albumDetail.tracks || [];
      setDiscTracks(tracks);
      const map: Record<number, number | null> = {};
      tracks.forEach((t) => {
        map[t.id] = t.disc_id ?? null;
      });
      setDiscAssignments(map);
    } catch (error: any) {
      message.error('获取碟片列表失败');
    } finally {
      setDiscLoading(false);
    }
  };

  const handleAddDisc = async () => {
    try {
      const values = await discForm.validateFields();
      if (!discAlbum) return;
      await discService.createDisc(discAlbum.id, {
        disc_number: values.disc_number,
        disc_title: values.disc_title || undefined,
      });
      message.success('碟片创建成功');
      discForm.resetFields();
      const data = await discService.getDiscs(discAlbum.id);
      setDiscs(data);
      setSequentialDiscCounts((prev) => {
        const next: Record<number, number> = {};
        data.forEach((disc) => {
          next[disc.id] = prev[disc.id] ?? 0;
        });
        return next;
      });
    } catch (error: any) {
      message.error(error.message || '创建碟片失败');
    }
  };

  const handleDeleteDisc = async (discId: number) => {
    try {
      await discService.deleteDisc(discId);
      message.success('碟片已删除');
      if (discAlbum) {
        const data = await discService.getDiscs(discAlbum.id);
        setDiscs(data);
        setSequentialDiscCounts((prev) => {
          const next: Record<number, number> = {};
          data.forEach((disc) => {
            next[disc.id] = prev[disc.id] ?? 0;
          });
          return next;
        });
      }
    } catch (error: any) {
      message.error(error.message || '删除碟片失败');
    }
  };

  const handleApplyBulkDiscAssignment = async () => {
    if (selectedDiscTrackKeys.length === 0) {
      message.warning('请先勾选要批量分配的曲目');
      return;
    }
    if (!discAlbum) return;
    const selectedIds = selectedDiscTrackKeys.map(Number);
    try {
      await discService.bulkAssignTracks(
        discAlbum.id,
        selectedIds.map((trackId) => ({ track_id: trackId, disc_id: bulkTargetDiscId }))
      );
      setDiscAssignments((prev) => {
        const next = { ...prev };
        selectedIds.forEach((trackId) => {
          next[trackId] = bulkTargetDiscId;
        });
        return next;
      });
      message.success(`已批量更新 ${selectedIds.length} 首曲目`);
    } catch (error: any) {
      message.error(error.message || '批量分配失败');
    }
  };

  const handleApplyRangeDiscAssignment = async () => {
    if (rangeStart == null || rangeEnd == null) {
      message.warning('请先输入曲目号范围');
      return;
    }
    if (!discAlbum) return;
    const start = Math.min(rangeStart, rangeEnd);
    const end = Math.max(rangeStart, rangeEnd);
    const targetTracks = discTracks.filter(
      (t) => t.track_number != null && t.track_number >= start && t.track_number <= end
    );
    if (targetTracks.length === 0) {
      message.warning(`未找到曲目号在 ${start}-${end} 范围内的曲目`);
      return;
    }
    try {
      await discService.bulkAssignTracks(
        discAlbum.id,
        targetTracks.map((track) => ({ track_id: track.id, disc_id: rangeTargetDiscId }))
      );
      setDiscAssignments((prev) => {
        const next = { ...prev };
        targetTracks.forEach((track) => {
          next[track.id] = rangeTargetDiscId;
        });
        return next;
      });
      message.success(`已按曲目号范围 ${start}-${end} 更新 ${targetTracks.length} 首曲目`);
    } catch (error: any) {
      message.error(error.message || '范围分配失败');
    }
  };

  const handleApplySequentialDiscAssignment = async () => {
    const orderedDiscs = [...discs].sort((a, b) => a.disc_number - b.disc_number);
    if (orderedDiscs.length === 0) {
      message.warning('请先创建碟片');
      return;
    }

    const requestedTotal = orderedDiscs.reduce((sum, disc) => {
      const count = sequentialDiscCounts[disc.id] ?? 0;
      return sum + Math.max(0, Math.floor(count));
    }, 0);

    if (requestedTotal <= 0) {
      message.warning('请先输入每个分碟的曲目数');
      return;
    }

    const unassignedTracks = [...discTracks]
      .filter((track) => (discAssignments[track.id] ?? null) == null)
      .sort((a, b) => {
        const aNo = a.track_number ?? Number.MAX_SAFE_INTEGER;
        const bNo = b.track_number ?? Number.MAX_SAFE_INTEGER;
        if (aNo !== bNo) return aNo - bNo;
        return a.id - b.id;
      });

    if (unassignedTracks.length === 0) {
      message.warning('当前没有未分配曲目');
      return;
    }
    if (!discAlbum) return;

    const assignments: { track_id: number; disc_id: number | null }[] = [];
    let cursor = 0;
    for (const disc of orderedDiscs) {
      const need = Math.max(0, Math.floor(sequentialDiscCounts[disc.id] ?? 0));
      for (let i = 0; i < need && cursor < unassignedTracks.length; i += 1) {
        assignments.push({ track_id: unassignedTracks[cursor].id, disc_id: disc.id });
        cursor += 1;
      }
    }

    if (assignments.length === 0) {
      message.warning('没有可应用的分配');
      return;
    }

    try {
      await discService.bulkAssignTracks(discAlbum.id, assignments);
      setDiscAssignments((prev) => {
        const next = { ...prev };
        assignments.forEach(({ track_id, disc_id }) => {
          next[track_id] = disc_id;
        });
        return next;
      });

      if (cursor < requestedTotal) {
        message.warning(`仅分配了 ${cursor} 首（未分配曲目不足 ${requestedTotal} 首）`);
      } else {
        message.success(`已按分碟序号顺序分配 ${cursor} 首未分配曲目`);
      }
    } catch (error: any) {
      message.error(error.message || '顺序分配失败');
    }
  };

  const handleTrackDiscChange = async (trackId: number, discId: number | null) => {
    try {
      await discService.assignTrackToDisc(trackId, discId);
      setDiscAssignments((prev) => ({ ...prev, [trackId]: discId }));
    } catch (error: any) {
      message.error(error.message || '分碟修改失败');
    }
  };

  const discTrackRowSelection: TableRowSelection<Track> = {
    selectedRowKeys: selectedDiscTrackKeys,
    onChange: (keys) => setSelectedDiscTrackKeys(keys),
  };

  const columns: ColumnsType<Album> = [
    {
      title: '封面',
      dataIndex: 'cover_path',
      key: 'cover',
      width: 80,
      render: (coverPath) => (
        <Image
          width={50}
          height={50}
          src={getCoverUrl(coverPath, undefined, true)}
          style={{ borderRadius: 4, objectFit: 'cover' }}
          preview={coverPath ? { src: getCoverUrl(coverPath) } : false}
        />
      ),
    },
    {
      title: '标题',
      dataIndex: 'title',
      key: 'title',
      ellipsis: true,
      render: (title: string, record: Album) => <Link to={`/albums/${record.id}`}>{title}</Link>,
    },
    {
      title: '游戏',
      dataIndex: 'game_id',
      key: 'game_id',
      width: 150,
      render: (gameId) => {
        const game = games.find(g => g.id === gameId);
        return game ? game.name : '-';
      },
    },
    {
      title: '曲目数',
      dataIndex: 'track_count',
      key: 'track_count',
      width: 100,
      render: (count) => `${count || 0} 首`,
    },
    {
      title: '发行日期',
      dataIndex: 'release_date',
      key: 'release_date',
      width: 170,
      render: (_date, record) => (
        <Input
          size="small"
          maxLength={8}
          placeholder="YYYYMMDD"
          value={releaseDateDraftById[record.id] ?? (record.release_date ? dayjs(record.release_date).format('YYYYMMDD') : '')}
          disabled={savingReleaseDateById[record.id]}
          onChange={(e) => {
            const next = e.target.value.replace(/\D/g, '');
            setReleaseDateDraftById((prev) => ({ ...prev, [record.id]: next }));
          }}
          onBlur={(e) => {
            void handleReleaseDateBlurSave(record, e.target.value);
          }}
        />
      ),
    },
    {
      title: '操作',
      key: 'actions',
      width: 340,
      render: (_, record) => (
        <Space wrap>
          <Button
            icon={<EditOutlined />}
            onClick={() => handleEdit(record)}
            size="small"
          >
            编辑
          </Button>
          <Button
            icon={<PictureOutlined />}
            onClick={() => handleUploadCover(record)}
            size="small"
          >
            上传封面
          </Button>
          <Button
            icon={<DatabaseOutlined />}
            onClick={() => handleManageDiscs(record)}
            size="small"
          >
            碟片
          </Button>
          <Button
            icon={<CalendarOutlined />}
            onClick={() => handleRescanDates(record)}
            size="small"
          >
            重读日期
          </Button>
          <Button
            loading={bpmDetectingAlbumId === record.id}
            onClick={() => handleDetectBpm(record)}
            size="small"
          >
            BPM检测
          </Button>
          <Button
            onClick={() => navigate(`/albums/${record.id}`)}
            size="small"
          >
            查看
          </Button>
        </Space>
      ),
    },
  ];

  const rowSelection: TableRowSelection<Album> = {
    selectedRowKeys,
    onChange: (keys) => setSelectedRowKeys(keys),
  };

  const handleBulkSetGame = async () => {
    try {
      await albumService.bulkSetGame(selectedRowKeys as number[], bulkGameId);
      message.success(`成功设置 ${selectedRowKeys.length} 张专辑的游戏`);
      setBulkGameModalVisible(false);
      setSelectedRowKeys([]);
      setBulkGameId(null);
      fetchAlbums(pagination.current);
    } catch (error: any) {
      message.error(error.message || '批量设置游戏失败');
    }
  };

  const handleExportCredits = async () => {
    if (exportAlbumIds.length === 0) {
      message.warning('请先在弹窗中选择要导出的专辑');
      return;
    }

    setExportingCredits(true);
    try {
      const { blob, fileName } = await creditsService.exportCredits(exportAlbumIds);
      const downloadUrl = window.URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = downloadUrl;
      anchor.download = fileName;
      document.body.appendChild(anchor);
      anchor.click();
      document.body.removeChild(anchor);
      window.URL.revokeObjectURL(downloadUrl);
      message.success(`已导出 ${exportAlbumIds.length} 张专辑的 Credits`);
      setExportModalVisible(false);
      setExportAlbumIds([]);
    } catch (error: any) {
      message.error(error.message || '导出 Credits 失败');
    } finally {
      setExportingCredits(false);
    }
  };

  const fetchExportAlbums = async (page = 1, pageSize?: number, search?: string) => {
    const size = pageSize ?? exportPagination.pageSize;
    const keyword = search ?? exportSearchText;
    setExportLoading(true);
    try {
      const data = await albumService.getAlbums(page, size, keyword);
      setExportAlbums(data.albums);
      setExportPagination({
        current: data.pagination.page,
        pageSize: size,
        total: data.pagination.total,
      });
    } catch (error: any) {
      message.error(error.message || '获取可导出专辑失败');
    } finally {
      setExportLoading(false);
    }
  };

  const openExportModal = () => {
    setExportAlbumIds([]);
    setExportSearchText('');
    setExportModalVisible(true);
    fetchExportAlbums(1, exportPagination.pageSize, '');
  };

  const handleSelectExportCurrentPage = () => {
    const ids = exportAlbums.map((album) => album.id);
    setExportAlbumIds((prev) => Array.from(new Set([...prev, ...ids])));
  };

  const handleUnselectExportCurrentPage = () => {
    const currentPageIds = new Set(exportAlbums.map((album) => album.id));
    setExportAlbumIds((prev) => prev.filter((id) => !currentPageIds.has(id)));
  };

  const hasSelection = selectedRowKeys.length > 0;

  return (
    <AdminLayout>
      <Card
        title="专辑管理"
        extra={
          <Space>
            {hasSelection && (
              <Button
                icon={<AppstoreOutlined />}
                onClick={() => setBulkGameModalVisible(true)}
              >
                批量设置游戏 ({selectedRowKeys.length})
              </Button>
            )}
            <Button
              icon={<DownloadOutlined />}
              onClick={openExportModal}
            >
              导出 Credits
            </Button>
            <Button
              loading={batchBpmRunning}
              onClick={handleBatchDetectBpm}
            >
              一键BPM检测
            </Button>
          </Space>
        }
      >
        <Table
          columns={columns}
          dataSource={albums}
          rowKey="id"
          loading={loading}
          rowSelection={rowSelection}
          pagination={{
            ...pagination,
            showSizeChanger: true,
            pageSizeOptions: ['10', '20', '50', '100'],
            showTotal: (total: number) => `共 ${total} 张专辑`,
          }}
          onChange={(newPagination) => {
            const newSize = newPagination.pageSize || pagination.pageSize;
            const newPage = newPagination.pageSize !== pagination.pageSize ? 1 : (newPagination.current || 1);
            fetchAlbums(newPage, newSize);
          }}
        />
      </Card>

      {/* Edit Modal */}
      <Modal
        title="编辑专辑"
        open={editModalVisible}
        onOk={handleEditSave}
        onCancel={() => setEditModalVisible(false)}
        okText="保存"
        cancelText="取消"
        width={600}
      >
        <Form form={form} layout="vertical">
          <Form.Item name="title" label="标题" rules={[{ required: true, message: '请输入专辑标题' }]}>
            <Input />
          </Form.Item>
          <Form.Item name="game_id" label="游戏">
            <Select allowClear placeholder="选择游戏">
              {games.map(game => (
                <Select.Option key={game.id} value={game.id}>
                  {game.name}
                </Select.Option>
              ))}
            </Select>
          </Form.Item>
          <Form.Item name="release_date" label="发行日期">
            <DatePicker style={{ width: '100%' }} format="YYYYMMDD" placeholder="例如 20250101" />
          </Form.Item>
          <Form.Item name="notes" label="备注">
            <Input.TextArea rows={3} placeholder="专辑备注信息（可选）" maxLength={5000} showCount />
          </Form.Item>
        </Form>
      </Modal>

      {selectedAlbumForCover && (
        <AlbumCoverUpload
          visible={coverUploadVisible}
          albumId={selectedAlbumForCover.id}
          currentCover={selectedAlbumForCover.cover_path}
          onClose={() => {
            setCoverUploadVisible(false);
            setSelectedAlbumForCover(null);
          }}
          onSuccess={handleCoverUploadSuccess}
        />
      )}

      {/* Disc Management Modal */}
      <Modal
        title={discAlbum ? `碟片管理 - ${discAlbum.title}` : '碟片管理'}
        open={discModalVisible}
        onCancel={() => {
          setDiscModalVisible(false);
          setDiscAlbum(null);
          setDiscs([]);
          setDiscTracks([]);
          setDiscAssignments({});
          setSelectedDiscTrackKeys([]);
          setBulkTargetDiscId(null);
          setRangeStart(null);
          setRangeEnd(null);
          setRangeTargetDiscId(null);
          setSequentialDiscCounts({});
          discForm.resetFields();
        }}
        width={860}
        footer={[
          <Button key="close" onClick={() => setDiscModalVisible(false)}>
            关闭
          </Button>,
        ]}
      >
        <Form form={discForm} layout="inline" style={{ marginBottom: 12 }}>
          <Form.Item
            name="disc_number"
            label="碟号"
            rules={[{ required: true, message: '请输入碟号' }]}
          >
            <InputNumber min={1} style={{ width: 120 }} />
          </Form.Item>
          <Form.Item name="disc_title" label="碟片名称">
            <Input placeholder="例如：Disc 1 / Bonus" style={{ width: 280 }} />
          </Form.Item>
          <Form.Item>
            <Button type="dashed" icon={<PlusOutlined />} onClick={handleAddDisc}>
              添加碟片
            </Button>
          </Form.Item>
        </Form>

        <List
          bordered
          loading={discLoading}
          dataSource={discs}
          locale={{ emptyText: '暂无碟片，可先新增' }}
          style={{ marginBottom: 16 }}
          renderItem={(disc) => (
            <List.Item
              actions={[
                <Popconfirm
                  key="delete"
                  title="删除该碟片？"
                  description="已分配到该碟片的曲目会变为未分配"
                  onConfirm={() => handleDeleteDisc(disc.id)}
                  okText="删除"
                  cancelText="取消"
                >
                  <Button size="small" icon={<DeleteOutlined />} danger>
                    删除
                  </Button>
                </Popconfirm>,
              ]}
            >
              <Space>
                <strong>Disc {disc.disc_number}</strong>
                <span>{disc.disc_title || '未命名碟片'}</span>
              </Space>
            </List.Item>
          )}
        />

        <Divider style={{ margin: '12px 0' }} />

        <Space wrap style={{ marginBottom: 12 }}>
          <strong>批量选择分碟：</strong>
          <Select
            allowClear
            placeholder="选择目标碟片（清空=未分配）"
            style={{ width: 260 }}
            value={bulkTargetDiscId}
            onChange={(value) => setBulkTargetDiscId(value ?? null)}
          >
            {discs.map((disc) => (
              <Select.Option key={disc.id} value={disc.id}>
                Disc {disc.disc_number}{disc.disc_title ? ` - ${disc.disc_title}` : ''}
              </Select.Option>
            ))}
          </Select>
          <Button onClick={handleApplyBulkDiscAssignment} disabled={selectedDiscTrackKeys.length === 0}>
            对已选曲目应用
          </Button>
          <Button onClick={() => setSelectedDiscTrackKeys([])}>
            取消选择
          </Button>
          <span style={{ color: 'var(--text-secondary)' }}>已选 {selectedDiscTrackKeys.length} 首</span>
        </Space>

        <Space wrap style={{ marginBottom: 12 }}>
          <strong>按曲目号范围分碟：</strong>
          <InputNumber
            min={1}
            placeholder="起始"
            style={{ width: 92 }}
            value={rangeStart}
            onChange={(v) => setRangeStart(v ?? null)}
          />
          <span>至</span>
          <InputNumber
            min={1}
            placeholder="结束"
            style={{ width: 92 }}
            value={rangeEnd}
            onChange={(v) => setRangeEnd(v ?? null)}
          />
          <Select
            allowClear
            placeholder="选择目标碟片（清空=未分配）"
            style={{ width: 260 }}
            value={rangeTargetDiscId}
            onChange={(value) => setRangeTargetDiscId(value ?? null)}
          >
            {discs.map((disc) => (
              <Select.Option key={disc.id} value={disc.id}>
                Disc {disc.disc_number}{disc.disc_title ? ` - ${disc.disc_title}` : ''}
              </Select.Option>
            ))}
          </Select>
          <Button onClick={handleApplyRangeDiscAssignment}>
            应用范围分配
          </Button>
        </Space>

        <Space direction="vertical" style={{ width: '100%', marginBottom: 12 }} size={8}>
          <Space wrap>
            <strong>按分碟序号顺序分配未分配曲目：</strong>
            <Button onClick={handleApplySequentialDiscAssignment}>应用顺序分配</Button>
          </Space>
          <Space wrap>
            {[...discs]
              .sort((a, b) => a.disc_number - b.disc_number)
              .map((disc) => (
                <Space key={disc.id} size={6}>
                  <span>Disc {disc.disc_number}</span>
                  <InputNumber
                    min={0}
                    precision={0}
                    style={{ width: 100 }}
                    placeholder="首数"
                    value={sequentialDiscCounts[disc.id] ?? 0}
                    onChange={(v) => {
                      setSequentialDiscCounts((prev) => ({ ...prev, [disc.id]: v == null ? 0 : Number(v) }));
                    }}
                  />
                </Space>
              ))}
          </Space>
        </Space>

        <Table
          rowKey="id"
          size="small"
          pagination={false}
          rowSelection={discTrackRowSelection}
          dataSource={[...discTracks].sort((a, b) => (a.track_number || 9999) - (b.track_number || 9999))}
          columns={[
            { title: '#', dataIndex: 'track_number', width: 70, render: (v: number) => v || '-' },
            {
              title: '曲目',
              dataIndex: 'title',
              render: (title: string, record: Track) => <Link to={`/track/${record.id}`}>{title}</Link>,
            },
            {
              title: '分碟',
              width: 220,
              render: (_: any, record: Track) => (
                <Select
                  value={discAssignments[record.id] ?? null}
                  allowClear
                  placeholder="未分配"
                  style={{ width: '100%' }}
                  onChange={(value) => {
                    handleTrackDiscChange(record.id, value ?? null);
                  }}
                >
                  {discs.map((disc) => (
                    <Select.Option key={disc.id} value={disc.id}>
                      Disc {disc.disc_number}{disc.disc_title ? ` - ${disc.disc_title}` : ''}
                    </Select.Option>
                  ))}
                </Select>
              ),
            },
          ]}
        />
      </Modal>

      {/* Bulk Set Game Modal */}
      <Modal
        title={`批量设置游戏 (${selectedRowKeys.length} 张专辑)`}
        open={bulkGameModalVisible}
        onOk={handleBulkSetGame}
        onCancel={() => { setBulkGameModalVisible(false); setBulkGameId(null); }}
        okText="确定"
        cancelText="取消"
      >
        <Select
          allowClear
          placeholder="选择游戏（清空则取消关联）"
          style={{ width: '100%' }}
          value={bulkGameId}
          onChange={setBulkGameId}
        >
          {games.map(game => (
            <Select.Option key={game.id} value={game.id}>
              {game.name}
            </Select.Option>
          ))}
        </Select>
      </Modal>

      {/* Export Credits Modal */}
      <Modal
        title="导出 Credits"
        open={exportModalVisible}
        onOk={handleExportCredits}
        onCancel={() => {
          if (exportingCredits) return;
          setExportModalVisible(false);
          setExportAlbumIds([]);
        }}
        okText={exportingCredits ? '导出中...' : `导出 (${exportAlbumIds.length})`}
        cancelText="取消"
        okButtonProps={{ loading: exportingCredits }}
      >
        <Space direction="vertical" style={{ width: '100%' }} size={10}>
          <div style={{ color: 'var(--text-secondary)' }}>
            可搜索并跨页批量选择专辑，导出格式与 Credits 导入格式一致。
          </div>
          <Input.Search
            allowClear
            placeholder="搜索专辑标题"
            value={exportSearchText}
            onChange={(e) => setExportSearchText(e.target.value)}
            onSearch={(value) => {
              setExportSearchText(value);
              fetchExportAlbums(1, exportPagination.pageSize, value);
            }}
          />
          <Space wrap>
            <Button onClick={handleSelectExportCurrentPage} disabled={exportAlbums.length === 0}>全选当前页</Button>
            <Button onClick={handleUnselectExportCurrentPage} disabled={exportAlbums.length === 0}>取消当前页</Button>
            <Button onClick={() => setExportAlbumIds([])} disabled={exportAlbumIds.length === 0}>清空已选</Button>
            <span style={{ color: 'var(--text-secondary)' }}>已选 {exportAlbumIds.length} 张</span>
          </Space>
          <Table
            rowKey="id"
            size="small"
            loading={exportLoading}
            dataSource={exportAlbums}
            pagination={{
              ...exportPagination,
              showSizeChanger: true,
              pageSizeOptions: ['10', '20', '50', '100'],
              showTotal: (total: number) => `共 ${total} 张专辑`,
            }}
            onChange={(newPagination) => {
              const newSize = newPagination.pageSize || exportPagination.pageSize;
              const newPage = newPagination.pageSize !== exportPagination.pageSize ? 1 : (newPagination.current || 1);
              fetchExportAlbums(newPage, newSize, exportSearchText);
            }}
            rowSelection={{
              selectedRowKeys: exportAlbumIds,
              preserveSelectedRowKeys: true,
              onChange: (keys) => setExportAlbumIds(keys as number[]),
            }}
            columns={[
              {
                title: '专辑',
                dataIndex: 'title',
                key: 'title',
                ellipsis: true,
              },
              {
                title: '游戏',
                dataIndex: 'game_name',
                key: 'game_name',
                width: 180,
                render: (gameName: string | undefined) => gameName || '-',
              },
              {
                title: '曲目数',
                dataIndex: 'track_count',
                key: 'track_count',
                width: 100,
                render: (count: number | undefined) => count ?? 0,
              },
            ]}
          />
        </Space>
      </Modal>
    </AdminLayout>
  );
};

export default AlbumManagement;

