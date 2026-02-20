import React, { useEffect, useState } from 'react';
import { Layout, Card, Row, Col, Spin, message } from 'antd';
import { useNavigate } from 'react-router-dom';
import { PlayCircleOutlined, AppstoreOutlined } from '@ant-design/icons';
import axios from 'axios';
import ThemeToggle from '../components/ThemeToggle';
import './Home.css';

const { Header, Content } = Layout;
const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000/api';

interface Game {
  id: number;
  name: string;
  name_en: string;
  description: string;
  cover_path: string;
  album_count: number;
  display_order: number;
}

const Home: React.FC = () => {
  const navigate = useNavigate();
  const [games, setGames] = useState<Game[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchGames();
  }, []);

  const fetchGames = async () => {
    try {
      const response = await axios.get(`${API_BASE_URL}/games`);
      if (response.data.success) {
        setGames(response.data.data.games);
      }
    } catch (error: any) {
      message.error('Failed to load games');
    } finally {
      setLoading(false);
    }
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
          <div style={{ textAlign: 'center', padding: 100 }}>
            <Spin size="large" />
          </div>
        ) : (
          <Row gutter={[32, 32]} justify="center">
            {games.map((game) => (
              <Col key={game.id} xs={24} sm={24} md={12} lg={8}>
                <Card
                  hoverable
                  className="game-card"
                  onClick={() => navigate(`/games/${game.id}`)}
                  cover={
                    <div className="game-cover">
                      {game.cover_path ? (
                        <img
                          src={game.cover_path}
                          alt={game.name}
                          style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                        />
                      ) : (
                        <div style={{
                          width: '100%',
                          height: '100%',
                          background: '#667eea',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          color: 'white',
                          fontSize: '24px'
                        }}>
                          {game.name}
                        </div>
                      )}
                      <div className="game-cover-overlay">
                        <PlayCircleOutlined className="play-icon" />
                      </div>
                      <div style={{
                        position: 'absolute',
                        bottom: '10px',
                        left: '50%',
                        transform: 'translateX(-50%)',
                        background: 'rgba(0, 0, 0, 0.7)',
                        color: 'white',
                        padding: '8px 16px',
                        borderRadius: '20px',
                        fontSize: '14px',
                        fontWeight: 500,
                        whiteSpace: 'nowrap'
                      }}>
                        <AppstoreOutlined /> {game.album_count || 0} 张专辑
                      </div>
                    </div>
                  }
                >
                </Card>
              </Col>
            ))}
          </Row>
        )}
      </Content>
    </Layout>
  );
};

export default Home;



