import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Layout, Card, Button, Space, Image, Tag, Skeleton, Descriptions, message, Tooltip } from 'antd';
import { ArrowLeftOutlined, PlayCircleOutlined, DownloadOutlined } from '@ant-design/icons';
import { IS_STATIC } from '../services/api';
import * as staticData from '../services/staticDataService';
import axios from 'axios';
import { Track } from '../types';
import { trackService, DOWNLOAD_ENABLED } from '../services/trackService';
import { usePlayerStore } from '../store/playerStore';
import LyricsDisplay from '../components/LyricsDisplay';
import CreditsDisplay from '../components/CreditsDisplay';
import { getTrackTags, Tag as TagType } from '../services/tagService';
import { MUSIC_ICON_PLACEHOLDER } from '../utils/imageUtils';
import './TrackDetail.css';

const { Content } = Layout;
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
  const [tags, setTags] = useState<TagType[]>([]);
  const [loading, setLoading] = useState(true);

  const { progress, playTrackOnly, seek } = usePlayerStore();

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
      message.error('加载曲目详情失败');
    } finally {
      setLoading(false);
    }
  };

  const fetchLyrics = async () => {
    try {
      if (IS_STATIC) {
        const lrc = await staticData.getLyrics(parseInt(id!));
        setLyrics(lrc);
      } else {
        const response = await axios.get(`${API_BASE_URL}/lyrics/${id}/lyrics`);
        if (response.data.success && response.data.data.lyrics) {
          setLyrics(response.data.data.lyrics);
        }
      }
    } catch (error) {
      setLyrics(null);
    }
  };

  const fetchCredits = async () => {
    try {
      if (IS_STATIC) {
        const c = await staticData.getCredits(parseInt(id!));
        setCredits(c);
      } else {
        const response = await axios.get(`${API_BASE_URL}/credits/${id}/credits`);
        if (response.data.success) {
          setCredits(response.data.data.credits);
        }
      }
    } catch (error) {
      console.error('获取制作人员信息失败:', error);
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
        <div style={{ marginBottom: 16 }}>
          <Button
            icon={<ArrowLeftOutlined />}
            onClick={() => navigate('/')}
          >
            返回首页
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
                  width={250}
                  height={250}
                  src={thumbSrc || MUSIC_ICON_PLACEHOLDER}
                  fallback={MUSIC_ICON_PLACEHOLDER}
                  style={{ borderRadius: 8 }}
                  preview={fullSrc ? { src: fullSrc } : false}
                />
              );
            })()}

            <div className="track-info-details">
              <h1>{track.title}</h1>
              {track.album_title && <h4>专辑：{track.album_title}</h4>}

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
              </Descriptions>

              <Space style={{ marginTop: 24 }}>
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
              </Space>
            </div>
          </div>
        </Card>

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
      </Content>
    </Layout>
  );
};

export default TrackDetail;



