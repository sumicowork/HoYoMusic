import React, { useEffect, useState, useRef } from 'react';
import { Layout, Card, Row, Col, Spin, message } from 'antd';
import { useNavigate } from 'react-router-dom';
import { PlayCircleOutlined, AppstoreOutlined } from '@ant-design/icons';
import axios from 'axios';
import ThemeToggle from '../components/ThemeToggle';
import './Home.css';

const { Header, Content } = Layout;
const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000/api';

const MAINTENANCE_GAMES = ['原神', '崩坏：星穹铁道', '崩坏3', '未定事件簿'];
const UNRELEASED_GAMES = ['崩坏因缘精灵', '星布谷地'];

interface Game {
  id: number;
  name: string;
  name_en: string;
  description: string;
  cover_path: string;
  album_count: number;
  display_order: number;
}

// 单个游戏卡片，内部用 ResizeObserver 保持封面正方形
const GameCard: React.FC<{
  game: Game;
  status: 'maintenance' | 'unreleased' | 'active';
  onClick: () => void;
}> = ({ game, status, onClick }) => {
  const isDisabled = status !== 'active';
  const coverRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = coverRef.current;
    if (!el) return;
    const sync = () => { el.style.height = `${el.offsetWidth}px`; };
    const ro = new ResizeObserver(sync);
    ro.observe(el);
    sync();
    return () => ro.disconnect();
  }, []);

  return (
    <Card
      className={`game-card${isDisabled ? ' game-card-disabled' : ''}`}
      onClick={onClick}
      cover={
        <div className="game-cover" ref={coverRef}>
          {game.cover_path ? (
            <img src={game.cover_path} alt={game.name} />
          ) : (
            <div style={{
              position: 'absolute', inset: 0,
              background: '#667eea',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: 'white', fontSize: '24px'
            }}>
              {game.name}
            </div>
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

          <div style={{
            position: 'absolute', bottom: '10px', left: '50%',
            transform: 'translateX(-50%)',
            background: 'rgba(0,0,0,0.7)', color: 'white',
            padding: '8px 16px', borderRadius: '20px',
            fontSize: '14px', fontWeight: 500, whiteSpace: 'nowrap',
            zIndex: 3
          }}>
            <AppstoreOutlined /> {game.album_count || 0} 张专辑
          </div>
        </div>
      }
    >
    </Card>
  );
};

const Home: React.FC = () => {
  const navigate = useNavigate();
  const [games, setGames] = useState<Game[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => { fetchGames(); }, []);

  const fetchGames = async () => {
    try {
      const response = await axios.get(`${API_BASE_URL}/games`);
      if (response.data.success) setGames(response.data.data.games);
    } catch {
      message.error('Failed to load games');
    } finally {
      setLoading(false);
    }
  };

  const getGameStatus = (name: string): 'maintenance' | 'unreleased' | 'active' => {
    if (MAINTENANCE_GAMES.includes(name)) return 'maintenance';
    if (UNRELEASED_GAMES.includes(name)) return 'unreleased';
    return 'active';
  };

  return (
    <Layout className="home-layout">
      <Header className="home-header">
        <div className="header-content">
          <h1>🎵 HoYoMusic</h1>
          <ThemeToggle />
        </div>
      </Header>

      <Content className="home-content" style={{ background: 'transparent' }}>
        <div className="home-hero">
          <h1 className="hero-title">选择游戏</h1>
          <p className="hero-subtitle">选择一个游戏来探索它的音乐收藏</p>
        </div>

        {loading ? (
          <div style={{ textAlign: 'center', padding: 100 }}><Spin size="large" /></div>
        ) : (
          <Row gutter={[32, 32]} justify="center">
            {games.map((game) => {
              const status = getGameStatus(game.name);
              return (
                <Col key={game.id} xs={24} sm={24} md={12} lg={8}>
                  <GameCard
                    game={game}
                    status={status}
                    onClick={() => { if (status === 'active') navigate(`/games/${game.id}`); }}
                  />
                </Col>
              );
            })}
          </Row>
        )}
      </Content>
    </Layout>
  );
};

export default Home;
