import React, { useEffect, useMemo, useState } from 'react';
import { Modal, Button } from 'antd';
import { useLocation } from 'react-router-dom';
import { siteConfigService, DEFAULT_FIRST_VISIT_MODAL_CONFIG, type FirstVisitModalConfig } from '../services/siteConfigService';
import MarkdownContent from './MarkdownContent';

const FirstVisitModal: React.FC = () => {
  const location = useLocation();
  const [config, setConfig] = useState<FirstVisitModalConfig>(DEFAULT_FIRST_VISIT_MODAL_CONFIG);
  const [visible, setVisible] = useState(false);
  const [remainingSeconds, setRemainingSeconds] = useState(0);

  const ackKey = useMemo(() => `hoyomusic:first-visit-modal:ack:${config.version}`, [config.version]);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      try {
        const nextConfig = await siteConfigService.getPublicFirstVisitModal();
        if (cancelled) return;

        setConfig(nextConfig);
        const shouldSkip = location.pathname.startsWith('/admin') || !nextConfig.enabled;
        const alreadyAcked = localStorage.getItem(`hoyomusic:first-visit-modal:ack:${nextConfig.version}`) === '1';
        if (shouldSkip) {
          setVisible(false);
          return;
        }

        if (!alreadyAcked) {
          setRemainingSeconds(Math.max(5, nextConfig.min_stay_seconds));
          setVisible(true);
        }
      } catch {
        // Keep silent; popup should never block page rendering when config fetch fails.
      }
    };

    load();

    return () => {
      cancelled = true;
    };
  }, [location.pathname]);

  useEffect(() => {
    if (!visible || remainingSeconds <= 0) return;

    const timer = window.setInterval(() => {
      setRemainingSeconds((prev) => {
        if (prev <= 1) {
          window.clearInterval(timer);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => {
      window.clearInterval(timer);
    };
  }, [visible, remainingSeconds]);

  const handleConfirm = () => {
    if (remainingSeconds > 0) return;
    localStorage.setItem(ackKey, '1');
    setVisible(false);
  };

  return (
    <Modal
      open={visible}
      title={config.title}
      maskClosable={false}
      keyboard={false}
      closable={false}
      footer={(
        <Button type="primary" onClick={handleConfirm} disabled={remainingSeconds > 0}>
          {remainingSeconds > 0 ? `请稍候 ${remainingSeconds}s` : '我已知晓'}
        </Button>
      )}
    >
      <MarkdownContent content={config.content} />
    </Modal>
  );
};

export default FirstVisitModal;


