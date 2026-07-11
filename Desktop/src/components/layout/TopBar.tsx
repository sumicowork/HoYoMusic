import SearchBar from './SearchBar';

interface TopBarProps {
  title: string;
}

/**
 * Sticky page header: route title on the left, global search on the right.
 */
export default function TopBar({ title }: TopBarProps) {
  return (
    <div className="flex h-full items-center justify-between px-6">
      <h1 className="truncate text-lg font-semibold text-[var(--text-primary)]">
        {title}
      </h1>
      <div className="w-72 max-w-[40vw]">
        <SearchBar />
      </div>
    </div>
  );
}
