import { useCallback, useEffect, useState, useRef } from 'react'
import { UserList } from './components/UserList';
import { Sidebar, MobileNav, type TabId } from './components/Sidebar';
import { Topbar } from './components/Topbar';
import { SanctionLog } from './components/SanctionLog';
import { Settings } from './components/Settings';
import { SetupPage } from './components/SetupPage';
import { ModerationView } from './components/ModerationView';
import { useChatStream } from './hooks/useChatStream';
import { EMPTY_STATUS, PLATFORMS, type ActionEvent, type PendingAction, type ChatUser, type Platform, type SystemInfo, type SystemStatus } from './types';
import { PLATFORM_META } from './platformMeta';
import { AnimatePresence, motion } from 'framer-motion';
import { Bug } from 'lucide-react';
import { Power } from 'lucide-react';
import './styles/neo.css';

const DISMISSED_UPDATE_KEY = 'tw.dismissedUpdate';

function App() {
  const [isSetupComplete, setIsSetupComplete] = useState<boolean | null>(null); // null = loading
  const [activeTab, setActiveTab] = useState<TabId>('moderation');
  const [actions, setActions] = useState<PendingAction[]>([]);
  const [users, setUsers] = useState<ChatUser[]>([]);
  const [isShuttingDown, setIsShuttingDown] = useState(false);
  const [systemStatus, setSystemStatus] = useState<SystemStatus>(EMPTY_STATUS);
  const [systemInfo, setSystemInfo] = useState<SystemInfo | null>(null);
  const [dismissedUpdate, setDismissedUpdate] = useState<string | null>(() => {
    try {
      return localStorage.getItem(DISMISSED_UPDATE_KEY);
    } catch {
      return null;
    }
  });

  // Debug State
  const [debugUser, setDebugUser] = useState('TrollUser');
  const [debugMsg, setDebugMsg] = useState('This is a test message');
  const [debugReason, setDebugReason] = useState('Manual Flag');
  const [debugPlatform, setDebugPlatform] = useState<Platform>('twitch');

  const shutdownRef = useRef(false);

  // Check setup status first
  useEffect(() => {
    fetch('/api/setup/status')
      .then(res => res.json())
      .then(data => {
        setIsSetupComplete(data.isSetupComplete);
      })
      .catch(() => setIsSetupComplete(false)); // Assume false if fail
  }, []);

  // Version, data folder and update availability: cheap, refreshed occasionally (the update check itself runs server-side).
  useEffect(() => {
    if (isSetupComplete !== true) return;
    const load = () => fetch('/api/system/info').then(res => res.json()).then(setSystemInfo).catch(() => {});
    load();
    const timer = setInterval(load, 5 * 60 * 1000);
    return () => clearInterval(timer);
  }, [isSetupComplete]);

  // Action-queue changes arrive over the SSE stream, so the queue never waits for a poll.
  const handleActionEvent = useCallback((evt: ActionEvent) => {
    setActions(prev => {
      const others = prev.filter(a => a.id !== evt.action.id);
      return evt.type === 'resolved' ? others : [...others, evt.action].sort((a, b) => a.timestamp - b.timestamp);
    });
  }, []);

  const { messages, connected: streamConnected } = useChatStream({ enabled: isSetupComplete === true, onAction: handleActionEvent });

  const fetchData = useCallback(async () => {
    if (shutdownRef.current) return;
    try {
      const [actionRes, userRes, statusRes] = await Promise.all([
        fetch('/api/actions'),
        fetch('/api/users'),
        fetch('/api/status')
      ]);

      if (!actionRes.ok || !userRes.ok || !statusRes.ok) throw new Error('Network response was not ok');

      setActions(await actionRes.json());
      setUsers(await userRes.json());
      setSystemStatus(await statusRes.json());
    } catch (err) {
      if (!shutdownRef.current) {
        console.error("Failed to fetch data", err);
      }
    }
  }, []);

  useEffect(() => {
    if (isSetupComplete) {
      fetchData();
      const interval = setInterval(fetchData, 2000);
      return () => clearInterval(interval);
    }
  }, [isSetupComplete, fetchData]);

  if (isSetupComplete === null) {
    return <div className="min-h-screen bg-[#09090b] flex items-center justify-center text-white">Loading...</div>;
  }

  if (isSetupComplete === false) {
    return <SetupPage />;
  }

  const handleResolve = async (ids: string[], resolution: 'approved' | 'discarded', banDuration?: string) => {
    try {
      const results = await Promise.all(ids.map(id =>
        fetch(`/api/actions/${id}/resolve`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ resolution, banDuration })
        })
      ));

      const failed = results.filter(r => !r.ok);
      if (failed.length > 0) {
        const data = await failed[0].json().catch(() => ({}));
        alert(data.error || 'Failed to execute the action. It stays in the queue so you can retry.');
      }
      const resolvedIds = ids.filter((_, i) => results[i].ok);
      setActions(prev => prev.filter(a => !resolvedIds.includes(a.id)));
    } catch (err) {
      console.error('Failed to resolve actions', err);
    }
  };

  const handleHold = async (ids: string[]) => {
    await Promise.all(ids.map(id => fetch(`/api/actions/${id}/hold`, { method: 'POST' }).catch(() => undefined)));
    setActions(prev => prev.map(a => (ids.includes(a.id) ? { ...a, autoExecuteAt: undefined } : a)));
  };

  const handleQuickModerate = async (userKey: string, action: 'ban' | 'timeout') => {
    const user = users.find(u => u.key === userKey);
    const label = user ? `${user.displayName} (${PLATFORM_META[user.platform].label})` : userKey;
    if (!confirm(`${action === 'ban' ? 'Ban' : 'Timeout'} ${label}?`)) return;
    try {
      const res = await fetch(`/api/users/${encodeURIComponent(userKey)}/moderate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action })
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        alert(data.error || `Failed to ${action}`);
      }
    } catch (err) {
      console.error('Failed to moderate', err);
    }
  };

  const handleDeleteUser = async (key: string) => {
    try {
      await fetch(`/api/users/${encodeURIComponent(key)}`, { method: 'DELETE' });
      setUsers(prev => prev.filter(u => u.key !== key));
    } catch (err) {
      console.error('Failed to delete user', err);
    }
  };

  const handleShutdown = async () => {
    if (!confirm('Are you sure you want to stop the application?')) return;
    shutdownRef.current = true;
    setIsShuttingDown(true);
    try {
      await fetch('/api/shutdown', { method: 'POST' });
    } catch (e) {
      console.error('Shutdown failed', e);
    }
  };

  const sendDebugMessage = async () => {
    await fetch('/api/debug/message', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: debugUser, message: debugMsg, platform: debugPlatform })
    });
  };

  const sendDebugFlag = async () => {
    await fetch('/api/debug/flag', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: debugUser, message: debugMsg, reason: debugReason, platform: debugPlatform })
    });
  };

  if (isShuttingDown) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#09090b] text-white">
        <div className="text-center">
          <motion.div
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="text-center"
          >
            <Power size={64} className="mx-auto text-danger mb-4" />
            <h1 className="text-4xl font-bold text-danger mb-4">Application Stopped</h1>
            <p className="text-dim">You can safely close this tab now.</p>
          </motion.div>
        </div>
      </div>
    );
  }

  const update = systemInfo?.update && systemInfo.update.latestVersion !== dismissedUpdate ? systemInfo.update : null;
  const dismissUpdate = () => {
    if (!update) return;
    setDismissedUpdate(update.latestVersion);
    try {
      localStorage.setItem(DISMISSED_UPDATE_KEY, update.latestVersion);
    } catch {
      // private mode: the banner simply comes back on the next load
    }
  };
  const bannerCount = (systemStatus.ai.floodActive ? 1 : 0) + (update ? 1 : 0);
  const mainPadding = bannerCount === 0 ? 'pt-24' : bannerCount === 1 ? 'pt-32' : 'pt-40';

  const inputClass = "w-full bg-zinc-800 border-2 border-transparent rounded-xl p-5 text-white font-bold focus:border-zinc-600 focus:outline-none transition-all placeholder:text-zinc-600 shadow-inner";

  return (
    <div className="min-h-screen w-full bg-[#09090b] text-white font-inter flex relative overflow-hidden">
      <Sidebar activeTab={activeTab} setActiveTab={setActiveTab} version={systemInfo?.version} />
      <MobileNav activeTab={activeTab} setActiveTab={setActiveTab} />

      <div className="flex-1 flex flex-col md:ml-64 relative">
        <Topbar onShutdown={handleShutdown} status={systemStatus} update={update} onDismissUpdate={dismissUpdate} />

        <main className={`flex-1 p-4 md:p-8 pb-24 md:pb-8 overflow-y-auto custom-scrollbar relative z-0 ${mainPadding}`}>
          <AnimatePresence mode="wait">
            {activeTab === 'moderation' && (
              <motion.div
                key="moderation"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.2 }}
              >
                <ModerationView
                  messages={messages}
                  actions={actions}
                  platforms={systemStatus.platforms}
                  streamConnected={streamConnected}
                  onResolve={handleResolve}
                  onHold={handleHold}
                  onModerate={handleQuickModerate}
                  onOpenSettings={() => setActiveTab('settings')}
                />
              </motion.div>
            )}

            {activeTab === 'users' && (
              <motion.div
                key="users"
                initial={{ opacity: 0, x: 10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -10 }}
                transition={{ duration: 0.2 }}
                className="h-[calc(100vh-8rem)]"
              >
                <UserList users={users} platforms={systemStatus.platforms} onDeleteUser={handleDeleteUser} />
              </motion.div>
            )}

            {activeTab === 'log' && (
              <motion.div
                key="log"
                initial={{ opacity: 0, x: 10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -10 }}
                transition={{ duration: 0.2 }}
                className="h-[calc(100vh-8rem)]"
              >
                <SanctionLog platforms={systemStatus.platforms} onReverted={fetchData} />
              </motion.div>
            )}

            {activeTab === 'settings' && (
              <motion.div
                key="settings"
                initial={{ opacity: 0, scale: 0.98 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.98 }}
                transition={{ duration: 0.2 }}
              >
                <Settings status={systemStatus} info={systemInfo} onSaved={fetchData} />
              </motion.div>
            )}

            {activeTab === 'debug' && (
              <motion.div
                key="debug"
                initial={{ opacity: 0, scale: 0.98 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.98 }}
                transition={{ duration: 0.2 }}
                className="bg-[#18181b] rounded-3xl border border-white/10 p-12 max-w-3xl mx-auto shadow-2xl mt-8"
              >
                <h2 className="text-3xl font-black mb-10 flex items-center gap-5 text-white uppercase tracking-tight">
                  <div className="bg-zinc-800 p-4 rounded-xl">
                    <Bug className="text-zinc-400" size={32} />
                  </div>
                  Debug Console
                </h2>

                <div className="space-y-8">
                  <div className="grid grid-cols-3 gap-4">
                    <div className="col-span-2">
                      <label className="block text-xs uppercase text-zinc-500 mb-3 font-black tracking-widest ml-1">Fake Username</label>
                      <input className={inputClass} value={debugUser} onChange={e => setDebugUser(e.target.value)} placeholder="Username..." />
                    </div>
                    <div>
                      <label className="block text-xs uppercase text-zinc-500 mb-3 font-black tracking-widest ml-1">Platform</label>
                      <select className={`${inputClass} appearance-none`} value={debugPlatform} onChange={e => setDebugPlatform(e.target.value as Platform)}>
                        {PLATFORMS.map(p => <option key={p} value={p}>{PLATFORM_META[p].label}</option>)}
                      </select>
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs uppercase text-zinc-500 mb-3 font-black tracking-widest ml-1">Message Content</label>
                    <textarea
                      className={`${inputClass} h-40 resize-none leading-relaxed`}
                      value={debugMsg}
                      onChange={e => setDebugMsg(e.target.value)}
                      placeholder="Type a test message here..."
                    />
                  </div>
                  <div>
                    <label className="block text-xs uppercase text-zinc-500 mb-3 font-black tracking-widest ml-1">Flag/Ban Reason</label>
                    <input className={inputClass} value={debugReason} onChange={e => setDebugReason(e.target.value)} placeholder="Reason..." />
                  </div>

                  <div className="grid grid-cols-2 gap-6 pt-6">
                    <button onClick={sendDebugMessage} className="w-full py-5 text-sm uppercase tracking-widest font-black text-white bg-zinc-700 hover:bg-zinc-600 rounded-xl transition-all shadow-lg hover:shadow-xl hover:-translate-y-1">
                      Simulate Chat
                    </button>
                    <button onClick={sendDebugFlag} className="w-full py-5 text-sm uppercase tracking-widest font-black text-white bg-zinc-700 hover:bg-zinc-600 rounded-xl transition-all shadow-lg hover:shadow-xl hover:-translate-y-1">
                      Force Flag
                    </button>
                  </div>
                  <p className="text-xs text-zinc-500">Simulated messages go through the real AI pipeline; check the Moderation tab to see what happens to them.</p>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </main>
      </div>
    </div>
  )
}

export default App
