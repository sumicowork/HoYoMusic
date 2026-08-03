import React from 'react';
import type { ColumnsType } from 'antd/es/table';
import { Button, Image, Input, Popconfirm, Space, Typography } from 'antd';
import { DeleteOutlined, DownloadOutlined, EditOutlined, FileTextOutlined, PlayCircleOutlined, TagsOutlined, TeamOutlined } from '@ant-design/icons';
import { Link } from 'react-router-dom';
import type { Track } from '../../types';
import type { AdminTrackFilterOptions } from '../../services/trackService';
import { trackService } from '../../services/trackService';
import { MUSIC_ICON_PLACEHOLDER } from '../../utils/imageUtils';
import { formatDuration } from '../../utils/format';

export interface TrackColumnsContext {
  noteDraftById: Record<number, string>;
  savingNoteById: Record<number, boolean>;
  onNoteDraftChange: (id: number, value: string) => void;
  onNoteBlurSave: (track: Track, rawValue: string) => void;
  onClearTrackNotes: (track: Track) => void;
  getLyricsStatus: (track: Track) => 'none' | 'has' | 'instrumental';
  getTitleCn: (track: Track) => string;
  getTitleEn: (track: Track) => string;
  getAlbumTitleCn: (track: Track) => string;
  getAlbumTitleEn: (track: Track) => string;
  filterOptions: AdminTrackFilterOptions;
  columnFilters: Record<string, React.Key[] | null>;
  onPlay: (track: Track) => void;
  onEdit: (track: Track) => void;
  onDelete: (track: Track) => void;
  onDownload: (track: Track) => void;
  onOpenLyrics: (track: Track) => void;
  onOpenCredits: (track: Track) => void;
  onOpenTags: (track: Track) => void;
}

const getUniqueFilters = (values: Array<string | null | undefined>) => {
  const unique = Array.from(new Set(values.map((item) => (item || '').trim()).filter(Boolean)));
  return unique.sort((a, b) => a.localeCompare(b, 'zh-CN')).map((value) => ({ text: value, value }));
};

export const getTrackColumns = (ctx: TrackColumnsContext): ColumnsType<Track> => {
  const {
    noteDraftById, savingNoteById, onNoteDraftChange, onNoteBlurSave, onClearTrackNotes,
    getLyricsStatus, getTitleCn, getTitleEn, getAlbumTitleCn, getAlbumTitleEn,
    filterOptions, columnFilters,
    onPlay, onEdit, onDelete, onDownload, onOpenLyrics, onOpenCredits, onOpenTags,
  } = ctx;

  return [
    {
      title: '封面',
      dataIndex: 'cover_path',
      key: 'cover',
      width: 80,
      render: (coverPath: string, record: Track) => {
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
      render: (_title: string, record: Track) => (
        <Link to={`/track/${record.id}`}>
          <div>{getTitleCn(record)}</div>
          {getTitleEn(record) && <Typography.Text type="secondary" style={{ fontSize: 12 }}>{getTitleEn(record)}</Typography.Text>}
        </Link>
      ),
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
      render: (_albumTitle: string, record: Track) => {
        const titleCn = getAlbumTitleCn(record);
        const titleEn = getAlbumTitleEn(record);
        if (!titleCn) return '—';
        const content = (
          <div>
            <div>{titleCn}</div>
            {titleEn && <Typography.Text type="secondary" style={{ fontSize: 12 }}>{titleEn}</Typography.Text>}
          </div>
        );
        if (!record.album_id) return content;
        return <Link to={`/albums/${record.album_id}`}>{content}</Link>;
      },
    },
    {
      title: '备注',
      key: 'notes',
      width: 300,
      responsive: ['sm'],
      render: (_: unknown, record: Track) => (
        <Space.Compact style={{ width: '100%' }}>
          <Input
            value={noteDraftById[record.id] ?? record.notes ?? ''}
            placeholder="输入备注，失焦自动保存"
            allowClear
            maxLength={5000}
            size="small"
            disabled={savingNoteById[record.id]}
            onChange={(e) => onNoteDraftChange(record.id, e.target.value)}
            onBlur={(e) => { void onNoteBlurSave(record, e.target.value); }}
          />
          <Popconfirm
            title="清空备注"
            description="确定清空该曲目的备注吗？"
            okText="清空"
            cancelText="取消"
            onConfirm={() => { void onClearTrackNotes(record); }}
          >
            <Button size="small" disabled={savingNoteById[record.id] || !(record.notes && record.notes.trim())}>清空</Button>
          </Popconfirm>
        </Space.Compact>
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
      render: (_: unknown, record: Track) => {
        const status = getLyricsStatus(record);
        return (
          <Button
            icon={<FileTextOutlined />}
            className={`admin-lyrics-btn admin-lyrics-btn--${status}`}
            onClick={() => onOpenLyrics(record)}
            size="small"
          >
            {status === 'instrumental' ? '纯音乐' : '歌词'}
          </Button>
        );
      },
    },
    {
      title: '操作',
      key: 'actions',
      width: 230,
      render: (_: unknown, record: Track) => (
        <Space wrap>
          <Button type="primary" icon={<PlayCircleOutlined />} onClick={() => onPlay(record)} size="small">播放</Button>
          <Button icon={<EditOutlined />} onClick={() => onEdit(record)} size="small">编辑</Button>
          <Button icon={<TeamOutlined />} onClick={() => onOpenCredits(record)} size="small">制作人员</Button>
          <Button icon={<TagsOutlined />} onClick={() => onOpenTags(record)} size="small">标签</Button>
          <Button icon={<DownloadOutlined />} onClick={() => onDownload(record)} size="small" />
          <Button danger icon={<DeleteOutlined />} onClick={() => onDelete(record)} size="small" />
        </Space>
      ),
    },
  ];
};
