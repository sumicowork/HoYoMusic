import React, { useEffect, useState } from 'react';
import { Layout, message, Skeleton, Button, Modal, Radio, Select, Space, Typography, InputNumber } from 'antd';
import { Link, useNavigate } from 'react-router-dom';
import axios from 'axios';

// Detect mobile viewport
const useIsMobile = () => {
  const [isMobile, setIsMobile] = useState(() => window.innerWidth <= 768);
  useEffect(() => {
    const handler = () => setIsMobile(window.innerWidth <= 768);
    window.addEventListener('resize', handler, { passive: true });
    return () => window.removeEventListener('resize', handler);
  }, []);
  return isMobile;
};
import {
  PlayCircleOutlined,
  AppstoreOutlined,
  CustomerServiceOutlined,
  ClockCircleOutlined,
  FireOutlined,
} from '@ant-design/icons';
import { gameService, Game } from '../services/gameService';
import { albumService, Album } from '../services/albumService';
import { trackService } from '../services/trackService';
import { usePlayerStore } from '../store/playerStore';
import { Track } from '../types';
import { getCoverUrl, handleImageError } from '../utils/imageUtils';
import './Home.css';

const { Content } = Layout;
const { Text } = Typography;
const API_BASE_URL = import.meta.env.VITE_API_URL || `${window.location.origin}/api`;

type RandomPlayMode = 'all' | 'games' | 'artist';

interface ArtistOption {
  name: string;
  track_count?: number;
}

/* ─── 游戏卡片 ─── */
const GameCard: React.FC<{
  game: Game;
  status: 'maintenance' | 'unreleased' | 'active';
  index: number;
  onClick: () => void;
}> = ({ game, status, index, onClick }) => {
  const isDisabled = status !== 'active';

  return (
    <div
      className={`game-card card-stagger-enter${isDisabled ? ' game-card-disabled' : ''}`}
      style={{ '--i': index } as React.CSSProperties}
      onClick={onClick}
    >
      <div className="game-cover">
        {game.cover_path ? (
          <img src={getCoverUrl(game.cover_path)} alt={game.name} loading="lazy" onError={handleImageError} />
        ) : (
          <div className="game-cover-placeholder">{game.name}</div>
        )}

        {!isDisabled && (
          <div className="game-cover-overlay">
            <PlayCircleOutlined className="play-icon" />
          </div>
        )}

        {status === 'maintenance' && (
          <div className="game-status-banner game-status-maintenance">维护中</div>
        )}
        {status === 'unreleased' && (
          <div className="game-status-banner game-status-unreleased">未发行</div>
        )}

        <div className="game-card-label">
          <span className="game-card-name">{game.name}</span>
          <span className="game-card-count">
            <AppstoreOutlined /> {game.album_count || 0} 张专辑
          </span>
        </div>
      </div>
    </div>
  );
};

/* ─── 专辑轮播卡片 ─── */
const AlbumCarouselCard: React.FC<{ album: Album; onClick: () => void }> = ({ album, onClick }) => (
  <div className="carousel-album-card" onClick={onClick}>
    <div className="carousel-album-cover">
      <img
        src={getCoverUrl(album.cover_path, undefined, true)}
        alt={album.title}
        loading="lazy"
        onError={handleImageError}
      />
      <div className="carousel-album-overlay">
        <PlayCircleOutlined style={{ fontSize: 36, color: '#fff' }} />
      </div>
    </div>
    <div className="carousel-album-info">
      <div className="carousel-album-title">{album.title}</div>
      <div className="carousel-album-meta">
        {album.track_count || 0} 首 · {album.game_name || ''}
      </div>
    </div>
  </div>
);

/* ─── 歌曲推荐项 ─── */
const TrackItem: React.FC<{ track: Track; onPlay: () => void }> = ({ track, onPlay }) => {
  const formatDuration = (seconds: number | null) => {
    if (!seconds) return '--:--';
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  return (
    <div className="rec-track-item" onClick={onPlay}>
      <img
        className="rec-track-cover"
        src={getCoverUrl(track.cover_path || track.album_cover || null, undefined, true)}
        alt={track.title}
        loading="lazy"
        onError={handleImageError}
      />
      <div className="rec-track-info">
        <div className="rec-track-title">
          <Link
            to={`/track/${track.id}`}
            onClick={(event) => event.stopPropagation()}
          >
            {track.title}
          </Link>
        </div>
      </div>
      <span className="rec-track-duration">
        <ClockCircleOutlined /> {formatDuration(track.duration)}
      </span>
      <PlayCircleOutlined className="rec-track-play" />
    </div>
  );
};

/* ─── 主页组件 ─── */
const Home: React.FC = () => {
  const navigate = useNavigate();
  const { playTrackOnly, setPlaylist, play } = usePlayerStore();
  const isMobile = useIsMobile();
  const [games, setGames] = useState<Game[]>([]);
  const [loading, setLoading] = useState(true);
  const [albums, setAlbums] = useState<Album[]>([]);
  const [tracks, setTracks] = useState<Track[]>([]);
  const [topTracks, setTopTracks] = useState<Track[]>([]);
  const [artists, setArtists] = useState<ArtistOption[]>([]);
  const [randomModalOpen, setRandomModalOpen] = useState(false);
  const [randomPlayMode, setRandomPlayMode] = useState<RandomPlayMode>('all');
  const [selectedGameIds, setSelectedGameIds] = useState<number[]>([]);
  const [selectedArtist, setSelectedArtist] = useState<string | undefined>(undefined);
  const [randomCount, setRandomCount] = useState(1);
  const [randomPlaying, setRandomPlaying] = useState(false);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [gamesData, albumsData, tracksData, topData, artistsData] = await Promise.all([
        gameService.getGames(),
        albumService.getRandomAlbums(12).catch(() => []),
        trackService.getRandomTracks(20).catch(() => []),
        trackService.getTopTracks(10).catch(() => []),
        fetchArtists().catch(() => []),
      ]);
      setGames(gamesData);
      setAlbums(albumsData);
      setTracks(tracksData);
      setTopTracks(topData);
      setArtists(artistsData);
    } catch {
      message.error('加载数据失败');
    } finally {
      setLoading(false);
    }
  };

  const getGameStatus = (game: Game): 'maintenance' | 'unreleased' | 'active' => {
    return game.status || 'active';
  };

  const fetchArtists = async (): Promise<ArtistOption[]> => {

    const response = await axios.get(`${API_BASE_URL}/artists`, { params: { limit: 200 } });
    if (response.data?.success) {
      return response.data.data.artists || [];
    }
    return [];
  };

  const handleRandomPlay = async () => {
    try {
      setRandomPlaying(true);

      let candidateTracks: Track[] = [];

      if (randomPlayMode === 'all') {
        candidateTracks = await trackService.getRandomTracks(30);
      } else if (randomPlayMode === 'games') {
        if (selectedGameIds.length === 0) {
          message.warning('请至少选择一个游戏');
          return;
        }
        const result = await trackService.searchTracksPublic({
          game_ids: selectedGameIds,
          page: 1,
          limit: 100,
          sort_by: 'created_at',
          sort_dir: 'DESC',
        });
        candidateTracks = result.tracks;
      } else {
        if (!selectedArtist) {
          message.warning('请先选择一个创作者');
          return;
        }
        const result = await trackService.searchTracksPublic({
          artist: selectedArtist,
          page: 1,
          limit: 100,
          sort_by: 'created_at',
          sort_dir: 'DESC',
        });
        candidateTracks = result.tracks;
      }

      if (!candidateTracks || candidateTracks.length === 0) {
        message.warning('没有找到可播放的歌曲');
        return;
      }

      const count = Math.max(1, Math.min(50, Number(randomCount) || 1));
      const shuffled = [...candidateTracks].sort(() => Math.random() - 0.5);
      const pickedTracks = shuffled.slice(0, Math.min(count, shuffled.length));

      if (pickedTracks.length === 1) {
        playTrackOnly(pickedTracks[0]);
        message.success(`随机播放：${pickedTracks[0].title}`);
      } else {
        setPlaylist(pickedTracks);
        play(pickedTracks[0]);
        message.success(`随机播放 ${pickedTracks.length} 首歌曲`);
      }
      setRandomModalOpen(false);
    } catch {
      message.error('随机播放失败，请稍后重试');
    } finally {
      setRandomPlaying(false);
    }
  };

  const activeGames = games.filter((game) => getGameStatus(game) === 'active');

  return (
    <Layout className="home-layout">
      <Content className="home-content" style={{ background: 'transparent' }}>
        {loading ? (
          <div className="home-grid">
            <section className="home-games">
              <Skeleton active paragraph={{ rows: 0 }} style={{ marginBottom: 16 }} />
              <div className="games-grid">
                {Array.from({ length: 4 }).map((_, i) => (
                  <Skeleton.Node key={i} active style={{ width: '100%', height: 180, borderRadius: 12 }} />
                ))}
              </div>
            </section>
            <aside className="home-recommendations">
              <Skeleton active paragraph={{ rows: 4 }} />
              <Skeleton active paragraph={{ rows: 4 }} />
            </aside>
          </div>
        ) : (
          <div className="home-grid">
            {/* ─── 左侧：游戏卡片 ─── */}
            <section className="home-games">
              <h2 className="section-title home-section-title">
                <CustomerServiceOutlined /> 选择你的游戏
              </h2>
              <div className="games-grid">
                {games.map((game, idx) => {
                  const status = getGameStatus(game);
                  return (
                    <GameCard
                      key={game.id}
                      game={game}
                      status={status}
                      index={idx}
                      onClick={() => {
                        if (status === 'active') navigate(`/games/${game.id}`);
                      }}
                    />
                  );
                })}
              </div>
            </section>

            {/* ─── 右侧 ─── */}
            <aside className="home-recommendations">
              <div className="random-pick-actions">
                <Button type="primary" className="random-pick-btn" onClick={() => setRandomModalOpen(true)}>
                  随便听点什么！
                </Button>
              </div>

              {albums.length > 0 && (
                <section className="rec-section rec-albums">
                  <h2 className="section-title home-section-title">
                    <AppstoreOutlined /> 随机专辑
                  </h2>
                  <div className="carousel-marquee">
                    <div className="carousel-marquee-track">
                      {albums.map((album) => (
                        <AlbumCarouselCard
                          key={album.id}
                          album={album}
                          onClick={() => navigate(`/albums/${album.id}`)}
                        />
                      ))}
                      {/* Duplicate for seamless loop — desktop only */}
                      {!isMobile && albums.map((album) => (
                        <AlbumCarouselCard
                          key={`dup-${album.id}`}
                          album={album}
                          onClick={() => navigate(`/albums/${album.id}`)}
                        />
                      ))}
                    </div>
                  </div>
                </section>
              )}

              <Modal
                title="随便听点什么！"
                open={randomModalOpen}
                onCancel={() => setRandomModalOpen(false)}
                onOk={handleRandomPlay}
                okText="开始随机播放"
                cancelText="取消"
                confirmLoading={randomPlaying}
                destroyOnHidden
              >
                <Space direction="vertical" size={14} style={{ width: '100%' }}>
                  <Radio.Group
                    value={randomPlayMode}
                    onChange={(e) => setRandomPlayMode(e.target.value as RandomPlayMode)}
                    style={{ display: 'flex', flexDirection: 'column', gap: 8 }}
                  >
                    <Radio value="all">全部随机</Radio>
                    <Radio value="games">按游戏随机（可多选）</Radio>
                    <Radio value="artist">按创作者随机</Radio>
                  </Radio.Group>

                  {randomPlayMode === 'games' && (
                    <Select
                      mode="multiple"
                      placeholder="选择一个或多个游戏"
                      value={selectedGameIds}
                      onChange={(value) => setSelectedGameIds(value)}
                      options={activeGames.map((game) => ({ value: game.id, label: game.name }))}
                      style={{ width: '100%' }}
                    />
                  )}

                  <div>
                    <Text type="secondary" style={{ display: 'block', marginBottom: 8 }}>播放首数</Text>
                    <InputNumber
                      min={1}
                      max={50}
                      value={randomCount}
                      onChange={(value) => setRandomCount(Number(value) || 1)}
                      style={{ width: '100%' }}
                    />
                  </div>

                  {randomPlayMode === 'artist' && (
                    <Select
                      showSearch
                      placeholder="选择创作者"
                      value={selectedArtist}
                      onChange={(value) => setSelectedArtist(value)}
                      optionFilterProp="label"
                      options={artists.map((artist) => ({
                        value: artist.name,
                        label: artist.track_count ? `${artist.name} (${artist.track_count} 首)` : artist.name,
                      }))}
                      style={{ width: '100%' }}
                    />
                  )}

                  <Text type="secondary">将从符合条件的曲目中随机抽取指定首数并立即播放。</Text>
                </Space>
              </Modal>

              {/* 随机歌曲推荐 — 连续滚动 */}
              {tracks.length > 0 && (
                <section className="rec-section rec-tracks">
                  <h2 className="section-title home-section-title">
                    <PlayCircleOutlined /> 随机推荐
                  </h2>
                  <div className="track-marquee">
                    <div className="track-marquee-track">
                      {tracks.map((track) => (
                        <TrackItem
                          key={track.id}
                          track={track}
                          onPlay={() => playTrackOnly(track)}
                        />
                      ))}
                      {/* Duplicate for seamless loop — desktop only */}
                      {!isMobile && tracks.map((track) => (
                        <TrackItem
                          key={`dup-${track.id}`}
                          track={track}
                          onPlay={() => playTrackOnly(track)}
                        />
                      ))}
                    </div>
                  </div>
                </section>
              )}

              {/* 热门曲目 */}
              {topTracks.length > 0 && (
                <section className="rec-section rec-tracks">
                  <h2 className="section-title home-section-title">
                    <FireOutlined /> 热门曲目
                  </h2>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                    {topTracks.map((track) => (
                      <TrackItem
                        key={`top-${track.id}`}
                        track={track}
                        onPlay={() => playTrackOnly(track)}
                      />
                    ))}
                  </div>
                </section>
              )}
            </aside>
          </div>
        )}
      </Content>
    </Layout>
  );
};

export default Home;
