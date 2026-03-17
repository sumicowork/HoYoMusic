import React from 'react';
import { Card, Descriptions, Empty } from 'antd';
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

  const isCreatorField = (key: string) => {
    const normalized = String(key || '').toLowerCase();
    return /(artist|vocal|composer|arranger|producer|lyric|歌|词|曲|编|作|制作|演唱|艺术家)/.test(normalized);
  };

  const renderCreatorLinks = (value: string) => {
    const parts = String(value || '')
      .split(/\s*[\/、,，;；&＆]\s*/)
      .map((item) => item.trim())
      .filter(Boolean);

    if (parts.length <= 1) {
      return (
        <span
          className="credit-link"
          onClick={() => navigate(`/artists/${encodeURIComponent(value)}`)}
        >
          {value}
        </span>
      );
    }

    return (
      <>
        {parts.map((name, index) => (
          <React.Fragment key={`${name}-${index}`}>
            <span
              className="credit-link"
              onClick={() => navigate(`/artists/${encodeURIComponent(name)}`)}
            >
              {name}
            </span>
            {index < parts.length - 1 ? ' / ' : ''}
          </React.Fragment>
        ))}
      </>
    );
  };

  if (!credits || credits.length === 0) {
    return (
      <Card className="credits-card">
        <Empty description="暂无制作信息" />
      </Card>
    );
  }

  return (
    <Card className="credits-card" title="制作信息">
      <Descriptions column={1} bordered>
        {credits.map((credit) => (
          <Descriptions.Item
            key={credit.id}
            label={credit.credit_key}
          >
            {isCreatorField(credit.credit_key)
              ? renderCreatorLinks(credit.credit_value)
              : credit.credit_value}
          </Descriptions.Item>
        ))}
      </Descriptions>
    </Card>
  );
};

export default CreditsDisplay;

