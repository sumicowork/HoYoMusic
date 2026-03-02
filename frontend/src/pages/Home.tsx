import React, { useEffect, useState } from 'react';
import { Layout, Card, Row, Col, Spin, message } from 'antd';
import { useNavigate } from 'react-router-dom';
import { PlayCircleOutlined, AppstoreOutlined } from '@ant-design/icons';
import { gameService, Game } from '../services/gameService';
import ThemeToggle from '../components/ThemeToggle';
import './Home.css';

const { Header, Content } = Layout;

// 单个游戏卡片，内部用 ResizeObserver 保持封面正方形
const GameCard: React.FC<{
  game: Game;
  status: 'maintenance' | 'unreleased' | 'active';
  onClick: () => void;
}> = ({ game, status, onClick }) => {
  const isDisabled = status !== 'active';

  return (
    <Card
      className={`game-card${isDisabled ? ' game-card-disabled' : ''}`}
      onClick={onClick}
      cover={
        <div className="game-cover">
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
      const games = await gameService.getGames();
      setGames(games);
    } catch {
      message.error('加载游戏列表失败');
    } finally {
      setLoading(false);
    }
  };

  const getGameStatus = (game: Game): 'maintenance' | 'unreleased' | 'active' => {
    return game.status || 'active';
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

        {loading ? (
          <div style={{ textAlign: 'center', padding: 100 }}><Spin size="large" /></div>
        ) : (
          <Row gutter={[32, 32]} justify="center">
            {games.map((game) => {
              const status = getGameStatus(game);
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
