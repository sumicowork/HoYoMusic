import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Button, Collapse, Image, Skeleton, Tag, Tooltip, message } from 'antd';
import { ArrowLeftOutlined, DownloadOutlined, MoreOutlined, PlayCircleOutlined } from '@ant-design/icons';
import { Track } from '../types';
import { trackService, DOWNLOAD_ENABLED } from '../services/trackService';
import { albumService } from '../services/albumService';
import { usePlayerStore } from '../store/playerStore';
import { MUSIC_ICON_PLACEHOLDER } from '../utils/imageUtils';
import { useDominantColor } from '../utils/useDominantColor';
import './AlbumDetail.css';

interface Album {
  id: number;
  title: string;
  title_cn?: string | null;
  title_en?: string | null;
  cover_path: string;
  release_date: string;
  track_count: number;
  total_duration: number;
  notes?: string | null;
}

interface Disc {
  id: number;
  disc_number: number;
  disc_title: string | null;
}

const AlbumDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [album, setAlbum] = useState<Album | null>(null);
  const [tracks, setTracks] = useState<Track[]>([]);
  const [discs, setDiscs] = useState<Disc[]>([]);
  const [loading, setLoading] = useState(true);
  const albumTitleCn = (album?.title_cn && album.title_cn.trim()) || album?.title || '';
  const albumTitleEn = (album?.title_en && album.title_en.trim()) || '';

  const { play, playTrackOnly, setPlaylist } = usePlayerStore();
  const coverThumbSrc = album?.cover_path ? trackService.getCoverUrl(album.cover_path, true) : null;
  const coverFullSrc = album?.cover_path ? trackService.getCoverUrl(album.cover_path) : null;
  const dominantColor = useDominantColor(coverThumbSrc || coverFullSrc);

  useEffect(() => {
    if (id) {
      fetchAlbumDetails();
    }
  }, [id]);

  const fetchAlbumDetails = async () => {
    try {
      const data = await albumService.getAlbumById(parseInt(id!));
      setAlbum(data.album);
      setTracks(data.tracks);
      setDiscs(data.discs || []);
    } catch (error: any) {
      message.error('加载专辑详情失败');
    } finally {
      setLoading(false);
    }
  };

  const handlePlay = (track: Track) => {
    playTrackOnly(track);
  };

  const handlePlayAll = () => {
    if (tracks.length > 0) {
      setPlaylist(tracks);
      play(tracks[0]);
    }
  };

  const handleDownload = (track: Track) => {
    window.open(trackService.getDownloadUrlPublic(track.id), '_blank');
  };

  const handleDownloadAlbum = () => {
    const apiBase = import.meta.env.VITE_API_URL || `${window.location.origin}/api`;
    window.open(`${apiBase}/albums/${id}/download`, '_blank');
  };

  const formatDuration = (seconds: number) => {
    if (!seconds) return '--';
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const formatTotalDuration = (seconds: number) => {
    if (!seconds) return '--';
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    if (hours > 0) {
      return `${hours} hour${hours > 1 ? 's' : ''} ${minutes} min`;
    }
    return `${minutes} minutes`;
  };

  const discGroups = useMemo(() => {
    if (discs.length === 0) return null;
    const groups: { disc: Disc; tracks: Track[] }[] = [];

    for (const disc of [...discs].sort((a, b) => a.disc_number - b.disc_number)) {
      const discTracks = tracks.filter((track) => track.disc_id === disc.id);
      if (discTracks.length > 0) {
        groups.push({ disc, tracks: discTracks });
      }
    }

    const unassigned = tracks.filter((track) => !track.disc_id);
    if (unassigned.length > 0 && groups.length > 0) {
      groups.push({ disc: { id: 0, disc_number: 0, disc_title: '其他曲目' }, tracks: unassigned });
    }

    return groups.length > 0 ? groups : null;
  }, [tracks, discs]);

  const findBpmTag = (track: Track): string | null => {
    const sourceTags = Array.isArray(track.tags) ? track.tags : [];
    const bpmFromTag = sourceTags.find((item) => /\b\d{2,3}\s?bpm\b/i.test(item.name));
    if (bpmFromTag) {
      return bpmFromTag.name.replace(/\s+/g, ' ').trim();
    }
    const notesValue = (track.notes || '').match(/\b(\d{2,3})\s?bpm\b/i);
    return notesValue ? `${notesValue[1]} BPM` : null;
  };

  const specBadges = useMemo(() => {
    const result: string[] = ['FLAC'];
    const qualityTrack = tracks.find((item) => item.sample_rate && item.bit_depth);
    if (qualityTrack?.sample_rate && qualityTrack?.bit_depth) {
      result.push(`${(qualityTrack.sample_rate / 1000).toFixed(1)}kHz / ${qualityTrack.bit_depth}bit`);
    }
    const bpmTag = tracks.map(findBpmTag).find(Boolean);
    if (bpmTag) {
      result.push(bpmTag);
    }
    if (tracks.length > 0) {
      result.push(`${tracks.length} Tracks`);
    }
    return result;
  }, [tracks]);

  const renderTrackList = (list: Track[]) => (
    <div className="overflow-hidden rounded-2xl border border-white/10 bg-white/[0.05] backdrop-blur-md">
      {list.map((track, idx) => {
        const trackTitleCn = (track.title_cn && track.title_cn.trim()) || track.title;
        return (
          <div
            key={track.id}
            className="group grid grid-cols-[52px_minmax(0,1fr)_auto] items-center gap-2 border-b border-white/[0.06] px-2 py-2 transition-all duration-200 last:border-b-0 hover:bg-white/10 sm:grid-cols-[70px_minmax(0,1fr)_auto] sm:px-4 sm:py-3"
          >
            <button
              type="button"
              onClick={() => handlePlay(track)}
              className="h-11 w-11 rounded-full text-sm font-semibold text-white/70 transition-all hover:bg-white/10 hover:text-white focus:outline-none focus:ring-2 focus:ring-white/40"
              aria-label={`播放 ${trackTitleCn}`}
            >
              <span className="group-hover:hidden">{track.track_number || idx + 1}</span>
              <PlayCircleOutlined className="hidden text-base group-hover:inline" />
            </button>

            <div className="min-w-0">
              <button
                type="button"
                onClick={() => navigate(`/track/${track.id}`)}
                className="max-w-full truncate text-left text-base font-semibold text-white transition-colors hover:text-indigo-200"
              >
                {trackTitleCn}
              </button>
              {track.title_en && <p className="truncate text-xs text-white/60">{track.title_en}</p>}
              {track.notes && <p className="truncate text-xs text-white/45">{track.notes}</p>}
            </div>

            <div className="ml-2 flex items-center gap-1 sm:gap-2">
              <span className="hidden min-w-14 text-right text-xs text-white/60 sm:inline">{formatDuration(track.duration || 0)}</span>
              <Tooltip title={!DOWNLOAD_ENABLED ? '服务器维护中，暂时关闭下载' : ''}>
                <Button
                  type="text"
                  shape="circle"
                  icon={<DownloadOutlined />}
                  onClick={() => handleDownload(track)}
                  disabled={!DOWNLOAD_ENABLED}
                  className="h-11 w-11 !text-white/80 hover:!text-white"
                />
              </Tooltip>
              <Button
                type="text"
                shape="circle"
                icon={<MoreOutlined />}
                className="h-11 w-11 !text-white/80 hover:!text-white"
              />
            </div>
          </div>
        );
      })}
    </div>
  );
  const mobileDiscPanels = useMemo(() => {
    if (!discGroups) return null;

    return discGroups.map((group) => ({
      key: String(group.disc.id),
      label: (
        <div className="album-disc-header-mobile">
          <div className="album-disc-header-mobile-left">
            <span className="album-disc-number">Disc {group.disc.disc_number || '?'}</span>
            {group.disc.disc_title && <span className="album-disc-title">{group.disc.disc_title}</span>}
          </div>
          <Tag color="blue">{group.tracks.length} 首</Tag>
        </div>
      ),
      children: renderTrackList(group.tracks),
    }));
  }, [discGroups]);

  if (loading) {
    return (
      <div className="min-h-screen px-4 py-6 sm:px-6">
          <Skeleton active avatar={{ size: 250, shape: 'square' }} paragraph={{ rows: 6 }} />
      </div>
    );
  }

  if (!album) {
    return (
      <div className="min-h-screen px-4 py-6 sm:px-6">
          <Button icon={<ArrowLeftOutlined />} onClick={() => navigate('/albums')}>
            返回专辑列表
          </Button>
          <div className="mt-6 text-center text-white/80">专辑未找到</div>
      </div>
    );
  }

  const immersiveStyle: React.CSSProperties = {
    background: dominantColor
      ? `radial-gradient(circle at 18% 14%, rgba(${dominantColor}, 0.42), transparent 48%), radial-gradient(circle at 84% 10%, rgba(99, 102, 241, 0.26), transparent 42%), linear-gradient(165deg, rgba(8, 10, 22, 0.96) 0%, rgba(11, 15, 28, 0.9) 52%, rgba(7, 9, 18, 0.95) 100%)`
      : undefined,
  };

  return (
    <div className="album-detail-layout min-h-screen" style={immersiveStyle}>
      <div className="album-immersive-orb" aria-hidden="true" />

      <main className="album-detail-content relative mx-auto w-full max-w-6xl px-3 pb-24 pt-6 sm:px-6">
        <div className="album-detail-back-wrap mb-4">
          <Button icon={<ArrowLeftOutlined />} onClick={() => navigate('/albums')} className="h-11 rounded-xl px-4">
            返回专辑列表
          </Button>
        </div>

        <section className="album-hero-shell relative grid gap-6 overflow-hidden rounded-3xl border border-white/10 bg-white/[0.08] p-4 shadow-2xl backdrop-blur-md md:grid-cols-[320px_minmax(0,1fr)] md:p-8">
          <div className="relative mx-auto w-full max-w-[320px]">
            <div className="album-cover-glow" aria-hidden="true" />
            <Image
              width="100%"
              src={coverThumbSrc || MUSIC_ICON_PLACEHOLDER}
              fallback={MUSIC_ICON_PLACEHOLDER}
              className="album-cover-image overflow-hidden rounded-2xl"
              preview={coverFullSrc ? { src: coverFullSrc } : false}
            />
          </div>

          <div className="album-hero-info flex min-w-0 flex-col justify-center text-center md:text-left">
            <p className="text-xs uppercase tracking-[0.32em] text-white/55">Album</p>
            <h1 className="mt-2 text-3xl font-black tracking-tight text-white drop-shadow md:text-5xl">{albumTitleCn}</h1>
            {albumTitleEn && <p className="mt-2 text-sm text-white/65 md:text-base">{albumTitleEn}</p>}

            <div className="mt-5 grid grid-cols-1 gap-2 text-sm text-white/70 sm:grid-cols-3">
              <div className="rounded-xl border border-white/10 bg-black/20 px-3 py-2">总曲目: <span className="font-semibold text-white">{album.track_count || 0}</span></div>
              <div className="rounded-xl border border-white/10 bg-black/20 px-3 py-2">总时长: <span className="font-semibold text-white">{formatTotalDuration(album.total_duration)}</span></div>
              <div className="rounded-xl border border-white/10 bg-black/20 px-3 py-2">发行日期: <span className="font-semibold text-white">{album.release_date ? new Date(album.release_date).toLocaleDateString('zh-CN') : '--'}</span></div>
            </div>

            <div className="mt-5 flex flex-wrap justify-center gap-2 md:justify-start">
              {specBadges.map((spec) => (
                <span key={spec} className="rounded-full border border-cyan-200/35 bg-gradient-to-r from-cyan-300/15 to-indigo-300/15 px-3 py-1 text-xs font-semibold tracking-wide text-cyan-100">
                  {spec}
                </span>
              ))}
            </div>

            {album.notes && <p className="mt-4 rounded-xl border border-white/10 bg-black/20 p-3 text-sm text-white/75">{album.notes}</p>}

            <div className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-2 md:max-w-md">
              <Button
                type="primary"
                size="large"
                icon={<PlayCircleOutlined />}
                onClick={handlePlayAll}
                disabled={tracks.length === 0}
                className="h-12 rounded-xl border-0 bg-gradient-to-r from-indigo-500 to-violet-500 font-semibold"
              >
                播放全部
              </Button>

              <Tooltip title={!DOWNLOAD_ENABLED ? '服务器维护中，暂时关闭下载' : ''}>
                <Button
                  size="large"
                  icon={<DownloadOutlined />}
                  onClick={handleDownloadAlbum}
                  disabled={tracks.length === 0 || !DOWNLOAD_ENABLED}
                  className="h-12 rounded-xl border-white/20 bg-white/10 text-white hover:!border-white/40 hover:!bg-white/15"
                >
                  下载专辑
                </Button>
              </Tooltip>
            </div>
          </div>
        </section>

        <section className="album-track-shell mt-6 rounded-3xl border border-white/10 bg-white/[0.06] p-3 shadow-2xl backdrop-blur-md sm:p-5">
          <h2 className="mb-4 text-xl font-bold text-white sm:text-2xl">曲目列表</h2>

          {discGroups ? (
            <Collapse
              className="album-disc-collapse"
              bordered={false}
              defaultActiveKey={mobileDiscPanels?.[0] ? [mobileDiscPanels[0].key] : []}
              items={mobileDiscPanels || []}
            />
          ) : (
            renderTrackList(tracks)
          )}
        </section>
      </main>
    </div>
  );
};

export default AlbumDetail;

