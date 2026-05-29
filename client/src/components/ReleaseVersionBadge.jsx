import { useEffect, useMemo, useState } from 'react';
import { getClientReleaseInfo } from '../config/releaseInfo';
import { fetchRuntimeVersion } from '../services/version';

const shortenCommit = (commit = '') => (commit ? commit.slice(0, 7) : '');

const initialRuntimeInfo = {
  version: '…',
  commit: '',
  environment: '',
};

export default function ReleaseVersionBadge({ className = '' }) {
  const clientInfo = useMemo(() => getClientReleaseInfo(), []);
  const [runtimeInfo, setRuntimeInfo] = useState(initialRuntimeInfo);

  useEffect(() => {
    let isMounted = true;

    fetchRuntimeVersion()
      .then((info) => {
        if (!isMounted) return;
        setRuntimeInfo({
          version: info?.version || 'n/a',
          commit: info?.commit || '',
          environment: info?.environment || '',
        });
      })
      .catch(() => {
        if (!isMounted) return;
        setRuntimeInfo({
          version: 'n/a',
          commit: '',
          environment: '',
        });
      });

    return () => {
      isMounted = false;
    };
  }, []);

  const clientCommit = shortenCommit(clientInfo.commit);
  const runtimeCommit = shortenCommit(runtimeInfo.commit);
  const runtimeLabel = runtimeInfo.environment ? `${runtimeInfo.version} · ${runtimeInfo.environment}` : runtimeInfo.version;
  const title = `UI ${clientInfo.version}${clientCommit ? ` · ${clientCommit}` : ''} | API ${runtimeInfo.version}${runtimeCommit ? ` · ${runtimeCommit}` : ''}${runtimeInfo.environment ? ` · ${runtimeInfo.environment}` : ''}`;

  return (
    <div
      role="status"
      aria-label={title}
      title={title}
      className={`text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-400 ${className}`.trim()}
    >
      <span className="text-slate-500">UI</span> {clientInfo.version}
      {clientCommit ? ` · ${clientCommit}` : ''}
      {' · '}
      <span className="text-slate-500">API</span> {runtimeLabel}
      {runtimeCommit ? ` · ${runtimeCommit}` : ''}
    </div>
  );
}
