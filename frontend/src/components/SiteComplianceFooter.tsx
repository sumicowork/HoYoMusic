import React, { useEffect, useMemo, useState } from 'react';
import { Typography } from 'antd';
import { useLocation } from 'react-router-dom';
import { siteConfigService, DEFAULT_SITE_COMPLIANCE_CONFIG, type SiteComplianceConfig } from '../services/siteConfigService';
import './SiteComplianceFooter.css';

const { Text, Link } = Typography;

const ICP_LINK = 'https://beian.miit.gov.cn/';
const PUBLIC_SECURITY_LINK_BASE = 'https://www.beian.gov.cn/portal/registerSystemInfo';
const PUBLIC_SECURITY_LINK_FALLBACK = 'https://www.beian.gov.cn/';

const getPublicSecurityLink = (recordNumber: string): string => {
  const digits = recordNumber.replace(/\D/g, '');
  if (!digits) return PUBLIC_SECURITY_LINK_FALLBACK;
  return `${PUBLIC_SECURITY_LINK_BASE}?recordcode=${encodeURIComponent(digits)}`;
};

const SiteComplianceFooter: React.FC = () => {
  const location = useLocation();
  const [config, setConfig] = useState<SiteComplianceConfig>(DEFAULT_SITE_COMPLIANCE_CONFIG);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      try {
        const nextConfig = await siteConfigService.getPublicComplianceConfig();
        if (!cancelled) setConfig(nextConfig);
      } catch {
        // Keep footer silent if config cannot be loaded.
      }
    };

    load();

    return () => {
      cancelled = true;
    };
  }, []);

  const isAdminPage = location.pathname.startsWith('/admin');
  const icpNumber = config.icp_number.trim();
  const publicSecurityNumber = config.public_security_number.trim();

  const shouldShow = useMemo(() => {
    return config.enabled && !isAdminPage && (Boolean(icpNumber) || Boolean(publicSecurityNumber));
  }, [config.enabled, isAdminPage, icpNumber, publicSecurityNumber]);

  if (!shouldShow) return null;

  return (
    <footer className="site-compliance-footer" aria-label="备案信息">
      {icpNumber && (
        <Link href={ICP_LINK} target="_blank" rel="noopener noreferrer" className="site-compliance-footer__link">
          {icpNumber}
        </Link>
      )}

      {icpNumber && publicSecurityNumber && <Text type="secondary"> | </Text>}

      {publicSecurityNumber && (
        <Link
          href={getPublicSecurityLink(publicSecurityNumber)}
          target="_blank"
          rel="noopener noreferrer"
          className="site-compliance-footer__link"
        >
          {publicSecurityNumber}
        </Link>
      )}
    </footer>
  );
};

export default SiteComplianceFooter;


