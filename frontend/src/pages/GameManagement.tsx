import React, { useEffect, useState } from 'react';
import { Table, Select, message, Card, Image } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import axios from 'axios';
import AdminLayout from '../components/AdminLayout';
import { getCoverUrl } from '../utils/imageUtils';

const API_BASE_URL = import.meta.env.VITE_API_URL || `${window.location.origin}/api`;

interface Game {
  id: number;
  name: string;
  name_en: string;
  description?: string;
  cover_path: string;
  display_order: number;
  album_count: number;
  status: 'active' | 'maintenance' | 'unreleased';
}

const STATUS_OPTIONS = [
  { value: 'active',      label: '正常' },
  { value: 'maintenance', label: '维护中' },
  { value: 'unreleased',  label: '未发行' },
];

const GameManagement: React.FC = () => {
  const [games, setGames] = useState<Game[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchGames = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      const res = await axios.get(`${API_BASE_URL}/games`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.data.success) setGames(res.data.data.games);
    } catch {
      message.error('加载游戏列表失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchGames(); }, []);

  const handleStatusChange = async (game: Game, status: string) => {
    try {
      const token = localStorage.getItem('token');
      await axios.put(
        `${API_BASE_URL}/games/${game.id}`,
        { name: game.name, name_en: game.name_en, description: game.description, display_order: game.display_order, status },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      message.success(`「${game.name}」状态已更新`);
      setGames(prev => prev.map(g => g.id === game.id ? { ...g, status: status as Game['status'] } : g));
    } catch {
      message.error('更新失败');
    }
  };

  const columns: ColumnsType<Game> = [
    {
      title: '封面',
      dataIndex: 'cover_path',
      key: 'cover',
      width: 70,
      render: (cover) => cover
        ? <Image width={50} height={50} src={getCoverUrl(cover)} style={{ borderRadius: 4, objectFit: 'cover' }} />
        : <div style={{ width: 50, height: 50, background: '#667eea', borderRadius: 4 }} />,
    },
    {
      title: '游戏名称',
      dataIndex: 'name',
      key: 'name',
    },
    {
      title: '英文名',
      dataIndex: 'name_en',
      key: 'name_en',
    },
    {
      title: '专辑数',
      dataIndex: 'album_count',
      key: 'album_count',
      width: 80,
    },
    {
      title: '展示状态',
      key: 'status',
      width: 160,
      render: (_, record) => (
        <Select
          value={record.status || 'active'}
          options={STATUS_OPTIONS}
          style={{ width: 130 }}
          onChange={(val) => handleStatusChange(record, val)}
        />
      ),
    },
  ];

  return (
    <AdminLayout>
      <Card title="游戏管理">
        <Table
          columns={columns}
          dataSource={games}
          rowKey="id"
          loading={loading}
          pagination={false}
        />
      </Card>
    </AdminLayout>
  );
};

export default GameManagement;


