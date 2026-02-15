import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Layout, Card, Button, Space, Image, Tag, Spin, Descriptions, message } from 'antd';
import { ArrowLeftOutlined, PlayCircleOutlined, DownloadOutlined } from '@ant-design/icons';
import axios from 'axios';
import { Track } from '../types';
import { trackService } from '../services/trackService';
import { usePlayerStore } from '../store/playerStore';
import LyricsDisplay from '../components/LyricsDisplay';
import CreditsDisplay from '../components/CreditsDisplay';
import { getTrackTags, Tag as TagType } from '../services/tagService';
import { MUSIC_ICON_PLACEHOLDER } from '../utils/imageUtils';
import './TrackDetail.css';

const { Header, Content } = Layout;
const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000/api';

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
  const [tags, setTags] = useState<TagType[]>([]);
  const [loading, setLoading] = useState(true);

  const { progress, playTrackOnly } = usePlayerStore();

  useEffect(() => {
    if (id) {
      fetchTrackDetails();
      fetchLyrics();
      fetchCredits();
      fetchTags();
    }
  }, [id]);

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
      message.error('Failed to load track details');
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
      // No lyrics available
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
      console.error('Failed to load credits:', error);
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

  if (loading) {
    return (
      <Layout style={{ minHeight: '100vh' }}>
        <Content style={{ display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
          <Spin size="large" />
        </Content>
      </Layout>
    );
  }

  if (!track) {
    return (
      <Layout style={{ minHeight: '100vh' }}>
        <Content style={{ padding: 24 }}>
          <Card>
            <p>Track not found</p>
            <Button onClick={() => navigate('/')}>Back to Library</Button>
          </Card>
        </Content>
      </Layout>
    );
  }

  return (
    <Layout className="track-detail-layout">
      <Header className="track-detail-header">
        <Button
          type="text"
          icon={<ArrowLeftOutlined />}
          onClick={() => navigate('/')}
          style={{ color: '#fff' }}
        >
          Back to Library
        </Button>
      </Header>

      <Content className="track-detail-content">
        <Card className="track-info-card">
          <div className="track-info-container">
            {track.cover_path && (
              <Image
                width={250}
                height={250}
                src={trackService.getCoverUrl(track.cover_path)}
                fallback={MUSIC_ICON_PLACEHOLDER}
                style={{ borderRadius: 8 }}
              />
            )}

            <div className="track-info-details">
              <h1>{track.title}</h1>
              <h3>{track.artists.map(a => a.name).join(', ')}</h3>
              {track.album_title && <h4>Album: {track.album_title}</h4>}

              <Space style={{ marginTop: 16, marginBottom: 24 }} wrap>
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
                    {tag.name}
                  </Tag>
                ))}
              </Space>

              <Descriptions column={1} size="small">
                {track.track_number && (
                  <Descriptions.Item label="Track Number">
                    {track.track_number}
                  </Descriptions.Item>
                )}
                {track.file_size && (
                  <Descriptions.Item label="File Size">
                    {(track.file_size / (1024 * 1024)).toFixed(2)} MB
                  </Descriptions.Item>
                )}
                {track.release_date && (
                  <Descriptions.Item label="Release Date">
                    {new Date(track.release_date).toLocaleDateString()}
                  </Descriptions.Item>
                )}
              </Descriptions>

              <Space style={{ marginTop: 24 }}>
                <Button
                  type="primary"
                  icon={<PlayCircleOutlined />}
                  size="large"
                  onClick={handlePlay}
                >
                  Play
                </Button>
                <Button
                  icon={<DownloadOutlined />}
                  size="large"
                  onClick={handleDownload}
                >
                  Download
                </Button>
              </Space>
            </div>
          </div>
        </Card>

        {/* Lyrics Section */}
        {lyrics && (
          <LyricsDisplay lyricsContent={lyrics} currentTime={progress} />
        )}

        {/* Credits Section */}
        {credits.length > 0 && (
          <CreditsDisplay credits={credits} />
        )}
      </Content>
    </Layout>
  );
};

export default TrackDetail;



