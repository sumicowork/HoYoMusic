import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Input } from 'antd';
import { SearchOutlined } from '@ant-design/icons';

/**
 * Global search input. On submit (Enter / search icon) navigates to the
 * Search page with the query in the URL: /search?q=...
 */
export default function SearchBar() {
  const [value, setValue] = useState('');
  const navigate = useNavigate();

  const go = () => {
    const q = value.trim();
    if (q) navigate(`/search?q=${encodeURIComponent(q)}`);
  };

  return (
    <Input
      allowClear
      value={value}
      onChange={(e) => setValue(e.target.value)}
      onPressEnter={go}
      placeholder="搜索歌曲、艺术家…"
      prefix={
        <SearchOutlined
          className="cursor-pointer text-[var(--text-secondary)]"
          onClick={go}
        />
      }
      variant="filled"
      className="rounded-full"
      styles={{ input: { background: 'transparent' } }}
    />
  );
}
