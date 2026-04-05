import React, { useEffect, useMemo, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { Layout, Card, Button, Space, Image, Tag, Skeleton, Descriptions, message, Tooltip, Typography, Grid } from 'antd';
import { ArrowLeftOutlined, PlayCircleOutlined, DownloadOutlined, HeartOutlined, HeartFilled, PlusOutlined } from '@ant-design/icons';
import axios from 'axios';
import { Track, TrackMusicSourceItem } from '../types';
import { trackService, DOWNLOAD_ENABLED } from '../services/trackService';
import { usePlayerStore } from '../store/playerStore';
import LyricsDisplay from '../components/LyricsDisplay';
import CreditsDisplay from '../components/CreditsDisplay';
import MusicSourcesDisplay from '../components/MusicSourcesDisplay';
import { getTagGroups, getTags, getTrackTags, Tag as TagType, TagGroup } from '../services/tagService';
import { MUSIC_ICON_PLACEHOLDER } from '../utils/imageUtils';
import { buildTagPathLookup, getTagPathLabel } from '../utils/tagPath';
import favoriteService from '../services/favoriteService';
import playlistService from '../services/playlistService';
import PlaylistPickerModal from '../components/PlaylistPickerModal';
import { useDebugUserFeatures } from '../utils/debugFeature';
import './TrackDetail.css';

const { Content } = Layout;
const { useBreakpoint } = Grid;
const API_BASE_URL = import.meta.env.VITE_API_URL || `${window.location.origin}/api`;

interface Credit {
  id: number;
  credit_key: string;
  credit_value: string;
  display_order: number;
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
  const tagPathLookup = useMemo(
    () => buildTagPathLookup(allTags.length > 0 ? allTags : tags, tagGroups),
    [allTags, tags, tagGroups]
  );

  const { progress, playTrackOnly, seek } = usePlayerStore();
  const currentTrack = usePlayerStore((state) => state.currentTrack);
  const screens = useBreakpoint();
  const isMobile = !screens.md;
  const canUseDebugFeatures = useDebugUserFeatures();
  const titleCn = (track?.title_cn && track.title_cn.trim()) || track?.title || '';
  const titleEn = (track?.title_en && track.title_en.trim()) || '';
  const albumTitleCn = (track?.album_title_cn && track.album_title_cn.trim()) || (track?.album_title || '');
  const albumTitleEn = (track?.album_title_en && track.album_title_en.trim()) || '';

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
      const data = await getTrackTags(parseInt(id!));
      setTags(data);
    } catch (error) {
      console.error('Failed to load tags:', error);
    }
  };

  const fetchTrackDetails = async () => {
    try {
      const data = await trackService.getTrackByIdPublic(parseInt(id!));
      setTrack(data);
    } catch (error: any) {
      message.error('加载曲目详情失败');
    } finally {
      setLoading(false);
    }
  };

  const fetchLyrics = async () => {
    try {
      const response = await axios.get(`${API_BASE_URL}/lyrics/${id}/lyrics`);
      if (response.data.success && response.data.data.lyrics) {
        setLyrics(response.data.data.lyrics);
      }
    } catch (error) {
      setLyrics(null);
    }
  };

  const fetchCredits = async () => {
    try {
      const response = await axios.get(`${API_BASE_URL}/credits/${id}/credits`);
      if (response.data.success) {
        setCredits(response.data.data.credits);
      }
    } catch (error) {
      console.error('获取制作人员信息失败:', error);
    }
  };

  const fetchMusicSources = async () => {
    try {
      const data = await trackService.getTrackMusicSourcesPublic(parseInt(id!));
      setMusicSources(data);
    } catch (error) {
      setMusicSources([]);
    }
  };

  const handlePlay = () => {
    if (track) {
      // Only add this single track to queue
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

  const handleOpenPlaylistModal = async () => {
    setPlaylistModalOpen(true);
  };

  const handleBack = () => {
    if (window.history.length > 1) {
      navigate(-1);
      return;
    }
    navigate('/');
  };

  const mobileActionBarClass = currentTrack
    ? 'track-mobile-action-bar with-player'
    : 'track-mobile-action-bar';

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

  if (loading) {
    return (
      <Layout style={{ minHeight: '100vh' }}>
        <Content style={{ padding: 24 }}>
          <Skeleton active avatar={{ size: 250, shape: 'square' }} paragraph={{ rows: 8 }} />
        </Content>
      </Layout>
    );
  }

  if (!track) {
    return (
      <Layout style={{ minHeight: '100vh' }}>
        <Content style={{ padding: 24 }}>
          <Card>
            <p>曲目未找到</p>
            <Button onClick={() => navigate('/')}>返回首页</Button>
          </Card>
        </Content>
      </Layout>
    );
  }

  return (
    <Layout className="track-detail-layout">
      <Content className="track-detail-content">
        <div className="track-detail-back-wrap">
          <Button
            icon={<ArrowLeftOutlined />}
            onClick={handleBack}
          >
            返回上一页
          </Button>
        </div>
        <Card className="track-info-card">
          <div className="track-info-container">
            {(() => {
              const coverSrc = track.cover_path || track.album_cover;
              const thumbSrc = coverSrc
                ? trackService.getCoverUrl(coverSrc, true)
                : null;
              const fullSrc = coverSrc
                ? trackService.getCoverUrl(coverSrc)
                : null;
              return (
                <Image
                  width={isMobile ? 200 : 250}
                  height={isMobile ? 200 : 250}
                  src={thumbSrc || MUSIC_ICON_PLACEHOLDER}
                  fallback={MUSIC_ICON_PLACEHOLDER}
                  className="track-cover-image"
                  preview={fullSrc ? { src: fullSrc } : false}
                />
              );
            })()}

            <div className="track-info-details">
              <h1>{titleCn}</h1>
              {titleEn && <Typography.Text type="secondary" className="track-title-en">{titleEn}</Typography.Text>}
              {albumTitleCn && (
                <h4>
                  专辑：
                  {track.album_id
                    ? <Link to={`/albums/${track.album_id}`}>{albumTitleCn}</Link>
                    : albumTitleCn}
                  {albumTitleEn && <Typography.Text type="secondary" className="track-album-en">{albumTitleEn}</Typography.Text>}
                </h4>
              )}

              <Space className="track-meta-tags" wrap>
                <Tag color="blue">FLAC</Tag>
                {track.sample_rate && track.bit_depth && (
                  <Tag color="green">
                    {(track.sample_rate / 1000).toFixed(1)}kHz / {track.bit_depth}bit
                  </Tag>
                )}
                {track.duration && (
                  <Tag>{Math.floor(track.duration / 60)}:{Math.floor(track.duration % 60).toString().padStart(2, '0')}</Tag>
                )}
                {tags.map(tag => (
                  <Tag key={tag.id} color={tag.color}>
                    {getTagPathLabel(tag, tagPathLookup)}
                  </Tag>
                ))}
              </Space>

              <Descriptions column={1} size="small" className="track-meta-descriptions">
                {track.track_number && (
                  <Descriptions.Item label="曲目编号">
                    {track.track_number}
                  </Descriptions.Item>
                )}
                {track.file_size && (
                  <Descriptions.Item label="文件大小">
                    {(track.file_size / (1024 * 1024)).toFixed(2)} MB
                  </Descriptions.Item>
                )}
                {track.release_date && (
                  <Descriptions.Item label="发行日期">
                    {new Date(track.release_date).toLocaleDateString('zh-CN')}
                  </Descriptions.Item>
                )}
                <Descriptions.Item label="喜爱人数">
                  {Number(track.favorite_count || 0)}
                </Descriptions.Item>
              </Descriptions>

              {track.notes && (
                <Card size="small" className="track-notes-card">
                  <Typography.Text type="secondary" className="track-notes-text">
                    📝 {track.notes}
                  </Typography.Text>
                </Card>
              )}

              <Space className="track-main-actions" wrap>
                <Button
                  type="primary"
                  icon={<PlayCircleOutlined />}
                  size="large"
                  onClick={handlePlay}
                >
                  播放
                </Button>
                <Tooltip title={!DOWNLOAD_ENABLED ? '服务器维护中，暂时关闭下载' : ''}>
                  <Button
                    icon={<DownloadOutlined />}
                    size="large"
                    onClick={handleDownload}
                    disabled={!DOWNLOAD_ENABLED}
                  >
                    下载
                  </Button>
                </Tooltip>
                {canUseDebugFeatures && (
                  <Button
                    icon={favorited ? <HeartFilled style={{ color: '#ff4d6a' }} /> : <HeartOutlined />}
                    size="large"
                    onClick={handleToggleFavorite}
                  >
                    {favorited ? '取消喜爱' : '喜爱'}
                  </Button>
                )}
                {canUseDebugFeatures && (
                  <Button
                    icon={<PlusOutlined />}
                    size="large"
                    onClick={handleOpenPlaylistModal}
                  >
                    收藏到歌单
                  </Button>
                )}
              </Space>
            </div>
          </div>
        </Card>

        {isMobile && (
          <div className={mobileActionBarClass}>
            <Button
              type="primary"
              icon={<PlayCircleOutlined />}
              onClick={handlePlay}
            >
              播放
            </Button>
            <Tooltip title={!DOWNLOAD_ENABLED ? '服务器维护中，暂时关闭下载' : ''}>
              <Button
                icon={<DownloadOutlined />}
                onClick={handleDownload}
                disabled={!DOWNLOAD_ENABLED}
              >
                下载
              </Button>
            </Tooltip>
            {canUseDebugFeatures && (
              <Button
                icon={favorited ? <HeartFilled style={{ color: '#ff4d6a' }} /> : <HeartOutlined />}
                onClick={handleToggleFavorite}
              >
                {favorited ? '取消喜爱' : '喜爱'}
              </Button>
            )}
            {canUseDebugFeatures && (
              <Button
                icon={<PlusOutlined />}
                onClick={handleOpenPlaylistModal}
              >
                收藏到歌单
              </Button>
            )}
          </div>
        )}

        <PlaylistPickerModal
          title="收藏到歌单"
          open={playlistModalOpen}
          onCancel={() => setPlaylistModalOpen(false)}
          onSubmit={handleAddToPlaylist}
        />

        {/* Lyrics Section */}
        {lyrics && (
          <LyricsDisplay
            lyricsContent={lyrics}
            currentTime={progress}
            onSeek={handleSeek}
          />
        )}

        {/* Credits Section */}
        {credits.length > 0 && (
          <CreditsDisplay credits={credits} />
        )}

        <MusicSourcesDisplay sources={musicSources} />
      </Content>
    </Layout>
  );
};

export default TrackDetail;



