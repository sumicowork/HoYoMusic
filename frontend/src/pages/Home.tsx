import React, { useEffect, useState } from 'react';
import { Layout, message, Skeleton } from 'antd';
import { useNavigate } from 'react-router-dom';

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
        <div className="rec-track-title">{track.title}</div>
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
  const isMobile = useIsMobile();
  const [games, setGames] = useState<Game[]>([]);
  const [loading, setLoading] = useState(true);
  const [albums, setAlbums] = useState<Album[]>([]);
  const [tracks, setTracks] = useState<Track[]>([]);
  const [topTracks, setTopTracks] = useState<Track[]>([]);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [gamesData, albumsData, tracksData, topData] = await Promise.all([
        gameService.getGames(),
        albumService.getRandomAlbums(12).catch(() => []),
        trackService.getRandomTracks(20).catch(() => []),
        trackService.getTopTracks(10).catch(() => []),
      ]);
      setGames(gamesData);
      setAlbums(albumsData);
      setTracks(tracksData);
      setTopTracks(topData);
    } catch {
      message.error('加载数据失败');
    } finally {
      setLoading(false);
    }
  };

  const getGameStatus = (game: Game): 'maintenance' | 'unreleased' | 'active' => {
    return game.status || 'active';
  };

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
