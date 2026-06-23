import { useCallback, useEffect, useState } from 'react';
import { AdvisorPage } from './app/pages/AdvisorPage';
import { LogActionPage } from './app/pages/LogActionPage';
import { DashboardPage } from './app/pages/DashboardPage';
import { PlannerPage } from './app/pages/PlannerPage';
import { SettingsPage } from './app/pages/SettingsPage';
import './app/kala.css';
import type { EnrichedAdvisorResponse } from './lib/intelligence/feedbackBridge';
import {
  bootstrapIntelligenceStore,
  persistActiveStore,
  type BootstrappedStore,
  type StoreBackend,
  buildActionLogEntry,
} from './lib/intelligence';
import type { ActionLogFormValues } from './app/components/ActionLogForm';

type Tab = 'advisor' | 'log' | 'intelligence' | 'planner' | 'settings';

function App() {
  const [boot, setBoot] = useState<BootstrappedStore | null>(null);
  const [bootError, setBootError] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>('advisor');
  const [logCount, setLogCount] = useState(0);
  const [currentAdvice, setCurrentAdvice] = useState<EnrichedAdvisorResponse | null>(null);
  const [profileVersion, setProfileVersion] = useState(0);

  useEffect(() => {
    let cancelled = false;
    void bootstrapIntelligenceStore()
      .then((result) => {
        if (cancelled) return;
        setBoot(result);
        setLogCount(result.store.getLogs(result.userId).length);
      })
      .catch((err) => {
        if (!cancelled) setBootError(err instanceof Error ? err.message : 'Failed to load store');
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const refreshLogCount = useCallback(() => {
    if (!boot) return;
    setLogCount(boot.store.getLogs(boot.userId).length);
  }, [boot]);

  const handleLogSubmit = useCallback(
    async (values: ActionLogFormValues) => {
      if (!currentAdvice || !boot) return;

      const entry = buildActionLogEntry({
        userId: boot.userId,
        advice: currentAdvice,
        summary: values.summary,
        domain: values.domain,
        tags: [values.domain],
        outcomeScore: values.outcomeScore,
        notes: values.notes || undefined,
        followedAdvisor: values.followedAdvisor,
      });

      boot.store.appendLog(entry);
      await persistActiveStore(boot.userId);
      refreshLogCount();
    },
    [currentAdvice, boot, refreshLogCount]
  );

  if (bootError) {
    return (
      <div className="kala-shell">
        <p className="kala-error">Storage init failed: {bootError}</p>
      </div>
    );
  }

  if (!boot) {
    return (
      <div className="kala-shell">
        <p className="kala-loading">Loading intelligence store…</p>
      </div>
    );
  }

  const backendLabel: Record<StoreBackend, string> = {
    sqlite: 'SQLite',
    memory: 'localStorage',
  };

  return (
    <div className="kala-shell">
      <nav className="kala-nav">
        <button
          type="button"
          className={`kala-nav__tab${tab === 'advisor' ? ' kala-nav__tab--active' : ''}`}
          onClick={() => setTab('advisor')}
        >
          Advisor
        </button>
        <button
          type="button"
          className={`kala-nav__tab${tab === 'log' ? ' kala-nav__tab--active' : ''}`}
          onClick={() => setTab('log')}
        >
          Log Action{logCount > 0 ? ` (${logCount})` : ''}
        </button>
        <button
          type="button"
          className={`kala-nav__tab${tab === 'intelligence' ? ' kala-nav__tab--active' : ''}`}
          onClick={() => setTab('intelligence')}
        >
          Intelligence
        </button>
        <button
          type="button"
          className={`kala-nav__tab${tab === 'planner' ? ' kala-nav__tab--active' : ''}`}
          onClick={() => setTab('planner')}
        >
          Planner
        </button>
        <button
          type="button"
          className={`kala-nav__tab${tab === 'settings' ? ' kala-nav__tab--active' : ''}`}
          onClick={() => setTab('settings')}
        >
          Settings
        </button>
        <span className="kala-muted" style={{ marginLeft: 'auto', fontSize: 12, alignSelf: 'center' }}>
          {backendLabel[boot.backend]}
        </span>
      </nav>

      {tab === 'advisor' && (
        <AdvisorPage
          key={profileVersion}
          store={boot.store}
          userId={boot.userId}
          logCount={logCount}
          onAdviceReady={setCurrentAdvice}
          onGoToLog={() => setTab('log')}
        />
      )}

      {tab === 'log' && (
        <LogActionPage
          advice={currentAdvice}
          onSubmit={(v) => void handleLogSubmit(v)}
          onBack={() => setTab('advisor')}
        />
      )}

      {tab === 'intelligence' && (
        <DashboardPage
          key={profileVersion}
          store={boot.store}
          userId={boot.userId}
          onGoToLog={() => setTab('log')}
        />
      )}

      {tab === 'planner' && (
        <PlannerPage key={profileVersion} store={boot.store} userId={boot.userId} />
      )}

      {tab === 'settings' && (
        <SettingsPage
          store={boot.store}
          userId={boot.userId}
          backend={boot.backend}
          onProfileSaved={() => {
            setProfileVersion((v) => v + 1);
            setLogCount(boot.store.getLogs(boot.userId).length);
          }}
        />
      )}
    </div>
  );
}

export default App;