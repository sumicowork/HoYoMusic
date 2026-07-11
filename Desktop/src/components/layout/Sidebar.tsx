import { NavLink } from 'react-router-dom';
import {
  HomeOutlined,
  PlaySquareOutlined,
  SearchOutlined,
  UnorderedListOutlined,
  CustomerServiceOutlined,
} from '@ant-design/icons';

interface NavItem {
  to: string;
  label: string;
  icon: React.ReactNode;
  /** Exact match only (used for the index route). */
  end?: boolean;
}

const navItems: NavItem[] = [
  { to: '/', label: '首页', icon: <HomeOutlined />, end: true },
  { to: '/library', label: '乐库', icon: <PlaySquareOutlined /> },
  { to: '/search', label: '搜索', icon: <SearchOutlined /> },
  { to: '/playlist', label: '歌单', icon: <UnorderedListOutlined /> },
];

/**
 * Left navigation rail. Brand mark on top, primary destinations below with an
 * active-state highlight driven by React Router's NavLink.
 */
export default function Sidebar() {
  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-2 px-5 py-4">
        <CustomerServiceOutlined className="text-xl text-[var(--accent)]" />
        <span className="text-base font-bold tracking-wide text-[var(--text-primary)]">
          HoYoMusic
        </span>
      </div>

      <nav className="flex flex-col gap-1 px-3">
        {navItems.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.end}
            className={({ isActive }) =>
              [
                'flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors',
                isActive
                  ? 'bg-[var(--accent)]/15 text-[var(--accent)]'
                  : 'text-[var(--text-secondary)] hover:bg-[var(--surface)] hover:text-[var(--text-primary)]',
              ].join(' ')
            }
          >
            <span className="text-[17px]">{item.icon}</span>
            {item.label}
          </NavLink>
        ))}
      </nav>

      <div className="mt-auto px-5 py-4 text-[11px] text-[var(--text-secondary)] opacity-60">
        桌面版 · Tauri
      </div>
    </div>
  );
}
