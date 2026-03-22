import { useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';

const STORAGE_KEY = 'hoyomusic_test_debug';

const TestDebugParamSync: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    const params = new URLSearchParams(location.search || '');
    const current = params.get('test_debug');

    if (current === '1') {
      sessionStorage.setItem(STORAGE_KEY, '1');
      return;
    }

    // Allow explicit opt-out by visiting any route with ?test_debug=0
    if (current === '0') {
      sessionStorage.removeItem(STORAGE_KEY);
      return;
    }

    const remembered = sessionStorage.getItem(STORAGE_KEY) === '1';
    if (!remembered) {
      return;
    }

    params.set('test_debug', '1');
    const nextSearch = `?${params.toString()}`;
    if (nextSearch !== location.search) {
      navigate(
        {
          pathname: location.pathname,
          search: nextSearch,
          hash: location.hash,
        },
        { replace: true }
      );
    }
  }, [location.pathname, location.search, location.hash, navigate]);

  return null;
};

export default TestDebugParamSync;

