import React, { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { Breadcrumb, Button, Image, Skeleton, Tag, Tooltip, message } from 'antd';
import { ArrowLeftOutlined, DownloadOutlined, HeartFilled, HeartOutlined, PlayCircleOutlined, PlusOutlined } from '@ant-design/icons';
import { Track, TrackMusicSourceItem } from '../types';
import { trackService, DOWNLOAD_ENABLED } from '../services/trackService';
import { usePlayerStore } from '../store/playerStore';
import LyricsDisplay from '../components/LyricsDisplay';
import CreditsDisplay from '../components/CreditsDisplay';
import MusicSourcesDisplay from '../components/MusicSourcesDisplay';
import { lyricsService } from '../services/lyricsService';
import { creditsService } from '../services/creditsService';
import { getTagGroups, getTags, getTrackTags, Tag as TagType, TagGroup } from '../services/tagService';
import { MUSIC_ICON_PLACEHOLDER } from '../utils/imageUtils';
import { formatDuration } from '../utils/format';
import { buildTagPathLookup, getTagPathLabel } from '../utils/tagPath';
import favoriteService from '../services/favoriteService';
import playlistService from '../services/playlistService';
import PlaylistPickerModal from '../components/PlaylistPickerModal';
import { useDebugUserFeatures } from '../utils/debugFeature';
import { useThemeStore } from '../store/themeStore';
import { useDominantColor } from '../utils/useDominantColor';
import './TrackDetail.css';

interface Credit {
  id: number;
  credit_key: string;
  credit_value: string;
  display_order: number;
  artist_id?: number | null;
  people?: { name: string; artist_id: number | null }[];
}

const TrackDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [track, setTrack] = useState<Track | null>(null);
  const [lyrics, setLyrics] = useState<string | null>(null);
  const [credits, setCredits] = useState<Credit[]>([]);
  const [allTags, setAllTags] = useState<TagType[]>([]);
  const [tagGroups, setTagGroups] = useState<TagGroup[]>([]);
  const [tags, setTags] = useState<TagType[]>([]);
  const [loading, setLoading] = useState(true);
  const [musicSources, setMusicSources] = useState<TrackMusicSourceItem[]>([]);
  const [favorited, setFavorited] = useState(false);
  const [playlistModalOpen, setPlaylistModalOpen] = useState(false);
  const [detailTab, setDetailTab] = useState<'lyrics' | 'credits' | 'sources'>('lyrics');
  const tagPathLookup = useMemo(
    () => buildTagPathLookup(allTags.length > 0 ? allTags : tags, tagGroups),
    [allTags, tags, tagGroups]
  );

  const { progress, playTrackOnly, seek } = usePlayerStore();
  const mode = useThemeStore((state) => state.mode);
  const isDark = mode === 'dark';
  const canUseDebugFeatures = useDebugUserFeatures();
  const titleCn = (track?.title_cn && track.title_cn.trim()) || track?.title || '';
  const titleEn = (track?.title_en && track.title_en.trim()) || '';
  const albumTitleCn = (track?.album_title_cn && track.album_title_cn.trim()) || (track?.album_title || '');
  const albumTitleEn = (track?.album_title_en && track.album_title_en.trim()) || '';

  const coverSrc = track?.cover_path || track?.album_cover || null;
  const coverThumbSrc = coverSrc ? trackService.getCoverUrl(coverSrc, true) : null;
  const coverFullSrc = coverSrc ? trackService.getCoverUrl(coverSrc) : null;
  const dominantColor = useDominantColor(coverThumbSrc || coverFullSrc);

  useEffect(() => {
    if (id) {
      fetchTrackDetails();
      fetchLyrics();
      fetchCredits();
      fetchMusicSources();
      fetchAllTags();
      fetchTagGroups();
      fetchTags();
    }
  }, [id]);

  useEffect(() => {
    if (!canUseDebugFeatures || !track?.id) {
      setFavorited(false);
      return;
    }

    let canceled = false;
    favoriteService.checkFavorites([track.id]).then((data) => {
      if (!canceled) {
        setFavorited(Boolean(data[track.id]));
      }
    }).catch(() => {
      if (!canceled) {
        setFavorited(false);
      }
    });

    return () => {
      canceled = true;
    };
  }, [track?.id, canUseDebugFeatures]);

  const fetchAllTags = async () => {
    try {
      const data = await getTags();
      setAllTags(data);
    } catch (error) {
      console.error('Failed to load all tags:', error);
    }
  };

  const fetchTagGroups = async () => {
    try {
      const data = await getTagGroups();
      setTagGroups(data);
    } catch (error) {
      console.error('Failed to load tag groups:', error);
    }
  };

  const fetchTags = async () => {
    try {
      const data = await getTrackTags(parseInt(id!, 10));
      setTags(data);
    } catch (error) {
      console.error('Failed to load tags:', error);
    }
  };

  const fetchTrackDetails = async () => {
    try {
      const data = await trackService.getTrackByIdPublic(parseInt(id!, 10));
      setTrack(data);
    } catch (error: any) {
      message.error('加载曲目详情失败');
    } finally {
      setLoading(false);
    }
  };

  const fetchLyrics = async () => {
    try {
      const lyricsData = await lyricsService.getLyrics(parseInt(id!, 10));
      setLyrics(lyricsData);
    } catch (error) {
      setLyrics(null);
    }
  };

  const fetchCredits = async () => {
    try {
      const creditsData = await creditsService.getCredits(parseInt(id!, 10));
      setCredits(creditsData);
    } catch (error) {
      console.error('获取制作人员信息失败:', error);
    }
  };

  const fetchMusicSources = async () => {
    try {
      const data = await trackService.getTrackMusicSourcesPublic(parseInt(id!, 10));
      setMusicSources(data);
    } catch (error) {
      setMusicSources([]);
    }
  };

  const handlePlay = () => {
    if (track) {
      playTrackOnly(track);
    }
  };

  const handleDownload = () => {
    if (track) {
      window.open(trackService.getDownloadUrlPublic(track.id), '_blank');
    }
  };

  const handleSeek = (time: number) => {
    seek(time);
    message.success(`已跳转到 ${Math.floor(time / 60)}:${Math.floor(time % 60).toString().padStart(2, '0')}`);
  };

  const handleToggleFavorite = async () => {
    if (!track) return;
    try {
      const result = await favoriteService.toggle(track.id);
      setFavorited(result.favorited);
      setTrack((prev) => prev ? {
        ...prev,
        favorite_count: Math.max(0, Number(prev.favorite_count || 0) + (result.favorited ? 1 : -1)),
      } : prev);
      message.success(result.favorited ? '已添加到收藏' : '已取消收藏');
    } catch (error: any) {
      const msg = error?.response?.data?.error?.message || '收藏操作失败';
      message.error(msg);
    }
  };

  const handleBack = () => {
    if (window.history.length > 1) {
      navigate(-1);
      return;
    }
    navigate('/');
  };

  const handleAddToPlaylist = async (playlistId: number) => {
    if (!track) {
      return;
    }
    try {
      await playlistService.addTrack(playlistId, track.id);
      message.success('已添加到歌单');
    } catch (error: any) {
      const msg = error?.response?.data?.error?.message || '添加到歌单失败';
      message.error(msg);
    }
  };

  const specCards = useMemo(() => {
    if (!track) return [];
    const cards: Array<{ label: string; value: string }> = [
      { label: '格式', value: track.file_path?.toLowerCase().endsWith('.mp3') ? 'MP3' : 'FLAC' },
      { label: '时长', value: formatDuration(track.duration) },
    ];

    if (track.sample_rate && track.bit_depth) {
      cards.push({ label: '规格', value: `${(track.sample_rate / 1000).toFixed(1)}kHz / ${track.bit_depth}bit` });
    }

    if (track.file_size) {
      cards.push({ label: '大小', value: `${(track.file_size / (1024 * 1024)).toFixed(2)} MB` });
    }

    return cards;
  }, [track]);

  if (loading) {
    return (
      <div className="min-h-screen px-4 py-6 sm:px-6">
        <Skeleton active avatar={{ size: 250, shape: 'square' }} paragraph={{ rows: 8 }} />
      </div>
    );
  }

  if (!track) {
    return (
      <div className="min-h-screen px-4 py-6 sm:px-6">
        <p className="text-white/85">曲目未找到</p>
        <Button onClick={() => navigate('/')} className="mt-4">返回首页</Button>
      </div>
    );
  }

  const immersiveStyle: React.CSSProperties = {
    background: isDark
      ? (
        dominantColor
          ? `radial-gradient(circle at 16% 16%, rgba(${dominantColor}, 0.42), transparent 46%), radial-gradient(circle at 84% 10%, rgba(129, 140, 248, 0.24), transparent 40%), linear-gradient(165deg, rgba(7, 10, 22, 0.95) 0%, rgba(10, 15, 30, 0.92) 56%, rgba(8, 10, 20, 0.96) 100%)`
          : 'linear-gradient(165deg, rgba(7, 10, 22, 0.95) 0%, rgba(10, 15, 30, 0.92) 56%, rgba(8, 10, 20, 0.96) 100%)'
      )
      : (
        dominantColor
          ? `radial-gradient(circle at 16% 16%, rgba(${dominantColor}, 0.2), transparent 46%), radial-gradient(circle at 84% 10%, rgba(129, 140, 248, 0.14), transparent 40%), linear-gradient(165deg, #eef3ff 0%, #f8f7ff 56%, #edf3ff 100%)`
          : 'linear-gradient(165deg, #eef3ff 0%, #f8f7ff 56%, #edf3ff 100%)'
      ),
  };

  return (
    <div className="track-detail-layout min-h-screen" style={immersiveStyle}>
      <div className="track-immersive-orb" aria-hidden="true" />

      <main className="track-detail-content relative mx-auto w-full max-w-6xl px-3 pb-24 pt-6 sm:px-6">
        <Breadcrumb
          className="mb-3"
          items={[
            { title: <Link to="/" className="text-[color:var(--text-secondary)] hover:text-[color:var(--text-primary)]">首页</Link> },
            ...(albumTitleCn ? [{ title: track.album_id ? <Link to={`/albums/${track.album_id}`} className="text-[color:var(--text-secondary)] hover:text-[color:var(--text-primary)]">{albumTitleCn}</Link> : <span className="text-[color:var(--text-tertiary)]">{albumTitleCn}</span> }] : []),
            { title: <span className="font-semibold text-[color:var(--text-primary)]">{titleCn || track.title}</span> },
          ]}
        />
        <div className="track-detail-back-wrap mb-4">
          <Button icon={<ArrowLeftOutlined />} onClick={handleBack} className="h-11 rounded-xl px-4">
            返回上一页
          </Button>
        </div>

        <section className="track-hero-panel grid gap-6 rounded-3xl border border-white/20 bg-white/[0.14] p-4 shadow-2xl backdrop-blur-md lg:grid-cols-[340px_minmax(0,1fr)] lg:p-8">
          <div className="track-cover-tilted relative mx-auto w-full max-w-[340px]">
            <div className="track-cover-glow" aria-hidden="true" />
            <Image
              width="100%"
              src={coverThumbSrc || MUSIC_ICON_PLACEHOLDER}
              fallback={MUSIC_ICON_PLACEHOLDER}
              preview={coverFullSrc ? { src: coverFullSrc } : false}
              className="track-cover-image overflow-hidden rounded-2xl"
            />
          </div>

          <div className="min-w-0 text-center lg:text-left">
            <p className="text-xs uppercase tracking-[0.32em] text-[color:var(--text-tertiary)]">Track</p>
            <h1 className="mt-2 text-3xl font-black tracking-tight text-[color:var(--text-primary)] md:text-5xl">{titleCn}</h1>
            {titleEn && <p className="mt-2 text-sm text-[color:var(--text-secondary)]">{titleEn}</p>}


            {albumTitleCn && (
              <p className="mt-3 text-sm text-[color:var(--text-secondary)]">
                专辑：
                {track.album_id ? (
                  <Link to={`/albums/${track.album_id}`} className="font-semibold text-[#2d2d2d] underline decoration-gray-300 underline-offset-2 hover:text-black hover:decoration-black">
                    {albumTitleCn}
                  </Link>
                ) : (
                  <span className="font-semibold text-[#2d2d2d]">{albumTitleCn}</span>
                )}
                {albumTitleEn && <span className="ml-2 text-[color:var(--text-tertiary)]">{albumTitleEn}</span>}
              </p>
            )}

            <div className="mt-5 grid grid-cols-2 gap-2 sm:grid-cols-3">
              {specCards.map((card) => (
                <div key={card.label} className="rounded-xl border border-white/20 bg-white/[0.15] px-3 py-3 text-left">
                  <p className="text-[11px] uppercase tracking-[0.18em] text-[color:var(--text-tertiary)]">{card.label}</p>
                  <p className="mt-1 truncate text-sm font-semibold text-[color:var(--text-primary)]">{card.value}</p>
                </div>
              ))}
            </div>

            <div className="mt-4 flex flex-wrap justify-center gap-2 lg:justify-start">
              {tags.map((tag) => (
                <Link key={tag.id} to={`/tags/${tag.id}`}>
                  <Tag
                    color={tag.color}
                    className="!m-0 cursor-pointer rounded-full !border-white/25 !bg-white/[0.24] !px-3 !py-1 !text-[color:var(--text-primary)] transition-colors hover:!bg-white/[0.4]"
                  >
                    {getTagPathLabel(tag, tagPathLookup)}
                  </Tag>
                </Link>
              ))}
            </div>

            {track.notes && (
              <p className="mt-4 rounded-xl border border-white/20 bg-white/[0.15] p-3 text-sm text-[color:var(--text-secondary)]">{track.notes}</p>
            )}

            <div className="mt-6 flex flex-wrap items-center justify-center gap-3 lg:justify-start">
              <Button
                type="primary"
                icon={<PlayCircleOutlined />}
                size="large"
                onClick={handlePlay}
                className="h-12 min-w-[148px] rounded-xl border-0 bg-[#16a34a] font-semibold text-white transition-all hover:bg-[#15803d]"
              >
                播放
              </Button>

              <Tooltip title={!DOWNLOAD_ENABLED ? '服务器维护中，暂时关闭下载' : ''}>
                <Button
                  icon={<DownloadOutlined />}
                  size="large"
                  onClick={handleDownload}
                  disabled={!DOWNLOAD_ENABLED}
                  shape="circle"
                  className="h-11 w-11 rounded-full border-white/30 bg-white/[0.15] text-[color:var(--text-primary)] hover:!border-white/55 hover:!bg-white/[0.2]"
                />
              </Tooltip>

              {canUseDebugFeatures && (
                <Button
                  icon={favorited ? <HeartFilled style={{ color: '#ff4d6a' }} /> : <HeartOutlined />}
                  size="large"
                  onClick={handleToggleFavorite}
                  shape="circle"
                  className="h-11 w-11 rounded-full border-white/30 bg-white/[0.15] text-[color:var(--text-primary)] hover:!border-white/55 hover:!bg-white/[0.2]"
                />
              )}

              {canUseDebugFeatures && (
                <Button
                  icon={<PlusOutlined />}
                  size="large"
                  onClick={() => setPlaylistModalOpen(true)}
                  className="h-11 rounded-xl border-white/30 bg-white/[0.15] px-4 text-[color:var(--text-primary)] hover:!border-white/55 hover:!bg-white/[0.2]"
                >
                  收藏到歌单
                </Button>
              )}
            </div>
          </div>
        </section>

        <PlaylistPickerModal
          title="收藏到歌单"
          open={playlistModalOpen}
          onCancel={() => setPlaylistModalOpen(false)}
          onSubmit={handleAddToPlaylist}
        />

        <section className="mt-6">
          <div className="mb-4 flex gap-1 rounded-2xl border border-white/20 bg-white/[0.12] p-1.5 backdrop-blur-md">
            {[
              { key: 'lyrics' as const, label: '歌词', disabled: !lyrics },
              { key: 'credits' as const, label: '制作信息', disabled: credits.length === 0 },
              { key: 'sources' as const, label: '音乐来源', disabled: musicSources.length === 0 },
            ].map((tab) => (
              <button
                key={tab.key}
                disabled={tab.disabled}
                onClick={() => setDetailTab(tab.key)}
                className={`flex-1 rounded-xl px-4 py-2.5 text-sm font-semibold transition-all duration-200 ${
                  detailTab === tab.key
                    ? 'bg-[#2d2d2d] text-white'
                    : tab.disabled
                      ? 'cursor-not-allowed text-[color:var(--text-tertiary)] opacity-50'
                      : 'text-[color:var(--text-secondary)] hover:bg-gray-100 hover:text-[#2d2d2d]'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
          {detailTab === 'lyrics' && lyrics && (
            <LyricsDisplay
              lyricsContent={lyrics}
              currentTime={progress}
              onSeek={handleSeek}
            />
          )}
          {detailTab === 'credits' && credits.length > 0 && (
            <CreditsDisplay credits={credits} />
          )}
          {detailTab === 'sources' && (
            <MusicSourcesDisplay sources={musicSources} />
          )}
        </section>
      </main>
    </div>
  );
};

export default TrackDetail;


