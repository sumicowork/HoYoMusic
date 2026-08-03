import React, { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { Button, Collapse, Grid, Image, Skeleton, Tag, Tooltip } from 'antd';
import { ArrowLeftOutlined, DownloadOutlined, PlayCircleOutlined } from '@ant-design/icons';
import { Track } from '../types';
import { trackService, DOWNLOAD_ENABLED } from '../services/trackService';
import { API_BASE_URL } from '../services/api';
import { albumService } from '../services/albumService';
import { usePlayerStore } from '../store/playerStore';
import { useThemeStore } from '../store/themeStore';
import { MUSIC_ICON_PLACEHOLDER } from '../utils/imageUtils';
import { formatDuration } from '../utils/format';
import { handleApiError } from '../utils/errorHandler';
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
  const mode = useThemeStore((state) => state.mode);
  const { md } = Grid.useBreakpoint();
  const isMobile = !md;
  const isDark = mode === 'dark';
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
      handleApiError(error, '加载专辑详情失败');
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
    window.open(`${API_BASE_URL}/albums/${id}/download`, '_blank');
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

  const specBadges = useMemo(() => {
    const result: string[] = ['FLAC'];
    const qualityTrack = tracks.find((item) => item.sample_rate && item.bit_depth);
    if (qualityTrack?.sample_rate && qualityTrack?.bit_depth) {
      result.push(`${(qualityTrack.sample_rate / 1000).toFixed(1)}kHz / ${qualityTrack.bit_depth}bit`);
    }
    if (tracks.length > 0) {
      result.push(`${tracks.length} Tracks`);
    }
    return result;
  }, [tracks]);

  const renderTrackList = (list: Track[]) => (
    <div className="overflow-hidden rounded-2xl border border-white/20 bg-white/[0.12] backdrop-blur-md">
      {list.map((track, idx) => {
        const trackTitleCn = (track.title_cn && track.title_cn.trim()) || track.title;
        return (
          <div
            key={track.id}
            className="group grid grid-cols-[52px_minmax(0,1fr)_auto] items-center gap-2 border-b border-white/[0.08] px-2 py-2 transition-all duration-200 last:border-b-0 hover:bg-white/10 sm:grid-cols-[70px_minmax(0,1fr)_auto] sm:px-4 sm:py-3"
          >
            {isMobile ? (
              <Button
                type="text"
                shape="circle"
                onClick={() => handlePlay(track)}
                className="!flex h-11 w-11 !items-center !justify-center rounded-full !border-0 !bg-transparent !p-0 text-base !text-[color:var(--text-secondary)] hover:!bg-white/10 hover:!text-[color:var(--text-primary)]"
                aria-label={`播放 ${trackTitleCn}`}
                icon={<PlayCircleOutlined />}
              />
            ) : (
              <Button
                type="text"
                shape="circle"
                onClick={() => handlePlay(track)}
                className="!flex h-11 w-11 !items-center !justify-center rounded-full !border-0 !bg-transparent !p-0 text-sm font-semibold !text-[color:var(--text-secondary)] transition-all hover:!bg-white/10 hover:!text-[color:var(--text-primary)]"
                aria-label={`播放 ${trackTitleCn}`}
                icon={<PlayCircleOutlined className="hidden text-base group-hover:inline" />}
              >
                <span className="group-hover:hidden">{track.track_number || idx + 1}</span>
              </Button>
            )}

            <div className="min-w-0">
              <Link
                to={`/track/${track.id}`}
                className="block max-w-full cursor-pointer truncate bg-transparent text-left text-base font-semibold text-[color:var(--text-primary)] no-underline transition-colors hover:text-[#2d2d2d] hover:underline"
              >
                {trackTitleCn}
              </Link>
              {track.title_en && <p className="truncate text-xs text-[color:var(--text-secondary)]">{track.title_en}</p>}
              {track.notes && <p className="truncate text-xs text-[color:var(--text-tertiary)]">{track.notes}</p>}
            </div>

            <div className="ml-2 flex items-center gap-1 sm:gap-2">
              <span className="hidden min-w-14 text-right text-xs text-[color:var(--text-secondary)] sm:inline">{formatDuration(track.duration || 0)}</span>
              <Tooltip title={!DOWNLOAD_ENABLED ? '服务器维护中，暂时关闭下载' : ''}>
                <Button
                  type="text"
                  shape="circle"
                  icon={<DownloadOutlined />}
                  onClick={() => handleDownload(track)}
                  disabled={!DOWNLOAD_ENABLED}
                  className="h-11 w-11 !text-[color:var(--text-secondary)] hover:!text-[color:var(--text-primary)]"
                />
              </Tooltip>
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
    background: isDark
      ? (
        dominantColor
          ? `radial-gradient(circle at 18% 14%, rgba(${dominantColor}, 0.42), transparent 48%), radial-gradient(circle at 84% 10%, rgba(99, 102, 241, 0.26), transparent 42%), linear-gradient(165deg, rgba(8, 10, 22, 0.96) 0%, rgba(11, 15, 28, 0.9) 52%, rgba(7, 9, 18, 0.95) 100%)`
          : 'linear-gradient(165deg, rgba(8, 10, 22, 0.96) 0%, rgba(11, 15, 28, 0.9) 52%, rgba(7, 9, 18, 0.95) 100%)'
      )
      : (
        dominantColor
          ? `radial-gradient(circle at 18% 14%, rgba(${dominantColor}, 0.22), transparent 48%), radial-gradient(circle at 84% 10%, rgba(99, 102, 241, 0.12), transparent 42%), linear-gradient(165deg, #eef3ff 0%, #f8f7ff 52%, #edf3ff 100%)`
          : 'linear-gradient(165deg, #eef3ff 0%, #f8f7ff 52%, #edf3ff 100%)'
      ),
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

        <section className="album-hero-shell relative grid gap-6 overflow-hidden rounded-3xl border border-white/20 bg-white/[0.14] p-4 shadow-2xl backdrop-blur-md md:grid-cols-[380px_minmax(0,1fr)] md:p-8">
          <div className="relative mx-auto w-full max-w-[380px]">
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
            <p className="text-xs uppercase tracking-[0.32em] text-[color:var(--text-tertiary)]">Album</p>
            <h1 className="mt-2 text-3xl font-black tracking-tight text-[color:var(--text-primary)] drop-shadow md:text-5xl">{albumTitleCn}</h1>
            {albumTitleEn && <p className="mt-2 text-sm text-[color:var(--text-secondary)] md:text-base">{albumTitleEn}</p>}

            <div className="mt-5 grid grid-cols-1 gap-2 text-sm text-[color:var(--text-secondary)] sm:grid-cols-3">
              <div className="rounded-xl border border-white/20 bg-white/[0.15] px-3 py-2">总曲目: <span className="font-semibold text-[color:var(--text-primary)]">{album.track_count || 0}</span></div>
              <div className="rounded-xl border border-white/20 bg-white/[0.15] px-3 py-2">总时长: <span className="font-semibold text-[color:var(--text-primary)]">{formatTotalDuration(album.total_duration)}</span></div>
              <div className="rounded-xl border border-white/20 bg-white/[0.15] px-3 py-2">发行日期: <span className="font-semibold text-[color:var(--text-primary)]">{album.release_date ? new Date(album.release_date).toLocaleDateString('zh-CN') : '--'}</span></div>
            </div>

            <div className="mt-5 flex flex-wrap justify-center gap-2 md:justify-start">
              {specBadges.map((spec) => (
                <span key={spec} className="rounded-full border border-slate-300/30 bg-white/20 px-3 py-1 text-xs font-semibold tracking-wide text-slate-700 dark:text-slate-200">
                  {spec}
                </span>
              ))}
            </div>

            {album.notes && <p className="mt-4 rounded-xl border border-white/20 bg-white/[0.14] p-3 text-sm text-[color:var(--text-secondary)]">{album.notes}</p>}

            <div className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-2 md:max-w-md">
              <Button
                type="primary"
                size="large"
                icon={<PlayCircleOutlined />}
                onClick={handlePlayAll}
                disabled={tracks.length === 0}
                className="h-12 rounded-xl border-0 bg-[#16a34a] font-semibold text-white transition-all hover:bg-[#15803d]"
              >
                播放全部
              </Button>

              <Tooltip title={!DOWNLOAD_ENABLED ? '服务器维护中，暂时关闭下载' : ''}>
                <Button
                  size="large"
                  icon={<DownloadOutlined />}
                  onClick={handleDownloadAlbum}
                  disabled={tracks.length === 0 || !DOWNLOAD_ENABLED}
                  className="h-12 rounded-xl border-white/30 bg-white/[0.14] text-[color:var(--text-primary)] hover:!border-white/55 hover:!bg-white/[0.2]"
                >
                  下载专辑
                </Button>
              </Tooltip>
            </div>
          </div>
        </section>

        <section className="album-track-shell mt-6 rounded-3xl border border-white/20 bg-white/[0.12] p-3 shadow-2xl backdrop-blur-md sm:p-5">
          <h2 className="mb-4 text-xl font-bold text-[color:var(--text-primary)] sm:text-2xl">曲目列表</h2>

          {discGroups ? (
            <>
              <div className="hidden md:block space-y-5">
                {discGroups.map((group) => (
                  <div key={group.disc.id}>
                    <div className="mb-2 flex items-center gap-2 text-sm text-[color:var(--text-secondary)]">
                      <span className="font-semibold text-[color:var(--text-primary)]">Disc {group.disc.disc_number || '?'}</span>
                      {group.disc.disc_title && <span className="text-[color:var(--text-tertiary)]">- {group.disc.disc_title}</span>}
                    </div>
                    {renderTrackList(group.tracks)}
                  </div>
                ))}
              </div>
              <div className="md:hidden">
                <Collapse
                  className="album-disc-collapse"
                  bordered={false}
                  defaultActiveKey={mobileDiscPanels?.[0] ? [mobileDiscPanels[0].key] : []}
                  items={mobileDiscPanels || []}
                />
              </div>
            </>
          ) : renderTrackList(tracks)}
        </section>
      </main>
    </div>
  );
};

export default AlbumDetail;

