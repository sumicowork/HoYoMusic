import React from 'react';
import { Empty } from 'antd';
import { useNavigate } from 'react-router-dom';
import './CreditsDisplay.css';

interface Credit {
  id: number;
  credit_key: string;
  credit_value: string;
  display_order: number;
}

interface CreditsDisplayProps {
  credits: Credit[];
}

const CreditsDisplay: React.FC<CreditsDisplayProps> = ({ credits }) => {
  const navigate = useNavigate();

  const parsePeople = (value: string): string[] => String(value || '')
    .split(/\s*(?:\/|、|,|，|;|；|&|＆|\||｜|\+|＋)\s*/)
    .map((item) => item.trim())
    .filter(Boolean);

  const groupedCredits = React.useMemo(() => {
    const groups = new Map<string, { id: number; role: string; displayOrder: number; people: string[] }>();

    for (const credit of [...credits].sort((a, b) => a.display_order - b.display_order || a.id - b.id)) {
      const role = String(credit.credit_key || '').trim() || '未标注';
      const roleKey = role.toLowerCase();
      const names = parsePeople(credit.credit_value);

      if (!groups.has(roleKey)) {
        groups.set(roleKey, {
          id: credit.id,
          role,
          displayOrder: credit.display_order,
          people: names,
        });
        continue;
      }

      const current = groups.get(roleKey)!;
      const seen = new Set(current.people.map((item) => item.toLowerCase()));
      for (const name of names) {
        const key = name.toLowerCase();
        if (!seen.has(key)) {
          seen.add(key);
          current.people.push(name);
        }
      }
    }

    return Array.from(groups.values()).sort((a, b) => a.displayOrder - b.displayOrder || a.id - b.id);
  }, [credits]);

  if (!credits || credits.length === 0) {
    return (
      <section className="credits-card mt-5 rounded-3xl border border-white/20 bg-white/[0.12] p-5 shadow-2xl backdrop-blur-md">
        <h3 className="mb-4 text-xl font-bold text-[color:var(--text-primary)]">制作信息</h3>
        <Empty description="暂无制作信息" image={Empty.PRESENTED_IMAGE_SIMPLE} />
      </section>
    );
  }

  return (
    <section className="credits-card mt-5 rounded-3xl border border-white/20 bg-white/[0.12] p-5 shadow-2xl backdrop-blur-md">
      <h3 className="mb-4 text-xl font-bold text-[color:var(--text-primary)]">制作信息</h3>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {groupedCredits.map((credit) => {
          const people = credit.people;
          return (
            <article
              key={credit.id}
              className="rounded-2xl border border-white/20 bg-white/[0.14] p-4 transition-transform duration-200 hover:-translate-y-0.5"
            >
              <p className="text-[11px] uppercase tracking-[0.2em] text-[color:var(--text-tertiary)]">{credit.role}</p>
              <div className="mt-3 flex flex-wrap gap-2">
                {people.length > 0 ? (
                  people.map((name) => (
                    <button
                      key={`${credit.role}-${name}`}
                      type="button"
                      className="credit-link h-11 rounded-full border border-white/25 bg-white/[0.2] px-3 text-sm text-[color:var(--text-primary)] transition-colors hover:border-indigo-300/50 hover:text-indigo-600"
                      onClick={() => navigate(`/artists/${encodeURIComponent(name)}`)}
                    >
                      {name}
                    </button>
                  ))
                ) : (
                  <span className="text-sm text-[color:var(--text-secondary)]">-</span>
                )}
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
};

export default CreditsDisplay;

