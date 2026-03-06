import React, { useEffect, useState, useRef, useCallback } from 'react';
import { Layout, Spin, message } from 'antd';
import { useNavigate } from 'react-router-dom';
import {
  PlayCircleOutlined,
  AppstoreOutlined,
  CustomerServiceOutlined,
  RightOutlined,
  LeftOutlined,
  ClockCircleOutlined,
} from '@ant-design/icons';
import { gameService, Game } from '../services/gameService';
import { albumService, Album } from '../services/albumService';
import { trackService } from '../services/trackService';
import { usePlayerStore } from '../store/playerStore';
import { Track } from '../types';
import ThemeToggle from '../components/ThemeToggle';
import { getCoverUrl, handleImageError } from '../utils/imageUtils';
import './Home.css';

const { Header, Content } = Layout;

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
          <img src={getCoverUrl(game.cover_path)} alt={game.name} onError={handleImageError} />
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
        onError={handleImageError}
      />
      <div className="carousel-album-overlay">
        <PlayCircleOutlined style={{ fontSize: 36, color: '#fff' }} />
      </div>
    </div>
    <div className="carousel-album-info">
      <div className="carousel-album-title">{album.title}</div>
      <div className="carousel-album-meta">
        {album.track_count || 0} 首 · {(album as any).game_name || ''}
      </div>
    </div>
  </div>
);

/* ─── 歌曲推荐项 ─── */
const TrackItem: React.FC<{ track: Track; index: number; onPlay: () => void }> = ({ track, index, onPlay }) => {
  const formatDuration = (seconds: number | null) => {
    if (!seconds) return '--:--';
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  return (
    <div className="rec-track-item" onClick={onPlay}>
      <span className="rec-track-index">{String(index + 1).padStart(2, '0')}</span>
      <img
        className="rec-track-cover"
        src={getCoverUrl(track.cover_path || track.album_cover || null, undefined, true)}
        alt={track.title}
        onError={handleImageError}
      />
      <div className="rec-track-info">
        <div className="rec-track-title">{track.title}</div>
        <div className="rec-track-artist">
          {track.artists?.map((a) => a.name).join(', ') || '未知艺术家'}
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
  const { playTrackOnly } = usePlayerStore();
  const [games, setGames] = useState<Game[]>([]);
  const [loading, setLoading] = useState(true);
  const [albums, setAlbums] = useState<Album[]>([]);
  const [tracks, setTracks] = useState<Track[]>([]);
  const [albumPage, setAlbumPage] = useState(0);
  const [trackPage, setTrackPage] = useState(0);
  const albumTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const trackTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const ALBUMS_PER_PAGE = 3;
  const TRACKS_PER_PAGE = 5;

  const totalAlbumPages = Math.max(1, Math.ceil(albums.length / ALBUMS_PER_PAGE));
  const totalTrackPages = Math.max(1, Math.ceil(tracks.length / TRACKS_PER_PAGE));

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [gamesData, albumsData, tracksData] = await Promise.all([
        gameService.getGames(),
        albumService.getRandomAlbums(12).catch(() => []),
        trackService.getRandomTracks(20).catch(() => []),
      ]);
      setGames(gamesData);
      setAlbums(albumsData);
      setTracks(tracksData);
    } catch {
      message.error('加载数据失败');
    } finally {
      setLoading(false);
    }
  };

  // Auto-scroll albums
  useEffect(() => {
    if (albums.length <= ALBUMS_PER_PAGE) return;
    albumTimerRef.current = setInterval(() => {
      setAlbumPage((p) => (p + 1) % totalAlbumPages);
    }, 5000);
    return () => { if (albumTimerRef.current) clearInterval(albumTimerRef.current); };
  }, [albums, totalAlbumPages]);

  // Auto-scroll tracks
  useEffect(() => {
    if (tracks.length <= TRACKS_PER_PAGE) return;
    trackTimerRef.current = setInterval(() => {
      setTrackPage((p) => (p + 1) % totalTrackPages);
    }, 8000);
    return () => { if (trackTimerRef.current) clearInterval(trackTimerRef.current); };
  }, [tracks, totalTrackPages]);

  const resetAlbumTimer = useCallback(() => {
    if (albumTimerRef.current) clearInterval(albumTimerRef.current);
    albumTimerRef.current = setInterval(() => {
      setAlbumPage((p) => (p + 1) % totalAlbumPages);
    }, 5000);
  }, [totalAlbumPages]);

  const resetTrackTimer = useCallback(() => {
    if (trackTimerRef.current) clearInterval(trackTimerRef.current);
    trackTimerRef.current = setInterval(() => {
      setTrackPage((p) => (p + 1) % totalTrackPages);
    }, 8000);
  }, [totalTrackPages]);

  const getGameStatus = (game: Game): 'maintenance' | 'unreleased' | 'active' => {
    return game.status || 'active';
  };

  const visibleAlbums = albums.slice(albumPage * ALBUMS_PER_PAGE, albumPage * ALBUMS_PER_PAGE + ALBUMS_PER_PAGE);
  const visibleTracks = tracks.slice(trackPage * TRACKS_PER_PAGE, trackPage * TRACKS_PER_PAGE + TRACKS_PER_PAGE);

  return (
    <Layout className="home-layout">
      <Header className="home-header">
        <div className="header-content">
          <h1 className="home-logo">🎵 HoYoMusic</h1>
          <ThemeToggle />
        </div>
      </Header>

      <Content className="home-content" style={{ background: 'transparent' }}>
        {loading ? (
          <div style={{ textAlign: 'center', padding: 100 }}>
            <Spin size="large" />
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
              {/* 随机专辑推荐 */}
              {albums.length > 0 && (
                <section className="rec-section rec-albums">
                  <div className="rec-header">
                    <h2 className="section-title home-section-title">
                      <AppstoreOutlined /> 随机专辑
                    </h2>
                    {totalAlbumPages > 1 && (
                      <div className="rec-nav">
                        <button
                          className="rec-nav-btn"
                          onClick={() => {
                            setAlbumPage((p) => (p - 1 + totalAlbumPages) % totalAlbumPages);
                            resetAlbumTimer();
                          }}
                        >
                          <LeftOutlined />
                        </button>
                        <span className="rec-nav-indicator">
                          {albumPage + 1}/{totalAlbumPages}
                        </span>
                        <button
                          className="rec-nav-btn"
                          onClick={() => {
                            setAlbumPage((p) => (p + 1) % totalAlbumPages);
                            resetAlbumTimer();
                          }}
                        >
                          <RightOutlined />
                        </button>
                      </div>
                    )}
                  </div>
                  <div className="carousel-albums-row">
                    {visibleAlbums.map((album) => (
                      <AlbumCarouselCard
                        key={album.id}
                        album={album}
                        onClick={() => navigate(`/albums/${album.id}`)}
                      />
                    ))}
                  </div>
                </section>
              )}

              {/* 随机歌曲推荐 */}
              {tracks.length > 0 && (
                <section className="rec-section rec-tracks">
                  <div className="rec-header">
                    <h2 className="section-title home-section-title">
                      <PlayCircleOutlined /> 随机推荐
                    </h2>
                    {totalTrackPages > 1 && (
                      <div className="rec-nav">
                        <button
                          className="rec-nav-btn"
                          onClick={() => {
                            setTrackPage((p) => (p - 1 + totalTrackPages) % totalTrackPages);
                            resetTrackTimer();
                          }}
                        >
                          <LeftOutlined />
                        </button>
                        <span className="rec-nav-indicator">
                          {trackPage + 1}/{totalTrackPages}
                        </span>
                        <button
                          className="rec-nav-btn"
                          onClick={() => {
                            setTrackPage((p) => (p + 1) % totalTrackPages);
                            resetTrackTimer();
                          }}
                        >
                          <RightOutlined />
                        </button>
                      </div>
                    )}
                  </div>
                  <div className="rec-tracks-list">
                    {visibleTracks.map((track, idx) => (
                      <TrackItem
                        key={track.id}
                        track={track}
                        index={trackPage * TRACKS_PER_PAGE + idx}
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
