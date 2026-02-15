import React from 'react';
import { Card, Descriptions, Empty } from 'antd';
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
            {credit.credit_value}
          </Descriptions.Item>
        ))}
      </Descriptions>
    </Card>
  );
};

export default CreditsDisplay;

