import { useEffect, useState, useRef } from 'react'
import { ActionCard } from './components/ActionCard';
import { UserList } from './components/UserList';
import { Sidebar } from './components/Sidebar';
import { Topbar } from './components/Topbar';
import { Settings } from './components/Settings';
import { SetupPage } from './components/SetupPage'; // Import SetupPage
import { type PendingAction, type ChatUser } from './types';
import { AnimatePresence, motion } from 'framer-motion';
import { Bug } from 'lucide-react';
import { Power } from 'lucide-react';
import './styles/neo.css';

function App() {
  const [isSetupComplete, setIsSetupComplete] = useState<boolean | null>(null); // null = loading
  const [activeTab, setActiveTab] = useState<'actions' | 'users' | 'debug' | 'settings'>('actions');
  const [actions, setActions] = useState<PendingAction[]>([]);
  const [users, setUsers] = useState<ChatUser[]>([]);
  const [isShuttingDown, setIsShuttingDown] = useState(false);

  const [isTwitchConnected, setIsTwitchConnected] = useState(false);

  // Debug State
  const [debugUser, setDebugUser] = useState('TrollUser');
  const [debugMsg, setDebugMsg] = useState('This is a test message');
  const [debugReason, setDebugReason] = useState('Manual Flag');

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

  const fetchData = async () => {
    if (shutdownRef.current || isSetupComplete === false) return;
    try {
      const [actionRes, userRes, statusRes] = await Promise.all([
        fetch('/api/actions'),
        fetch('/api/users'),
        fetch('/api/twitch/status')
      ]);

      if (!actionRes.ok || !userRes.ok) throw new Error('Network response was not ok');

      const actionData = await actionRes.json();
      const userData = await userRes.json();
      const statusData = await statusRes.json(); // May fail if not implemented yet, so careful? No we implemented it.

      setActions(actionData);
      setUsers(userData);
      setIsTwitchConnected(statusData.connected);
    } catch (err) {
      if (!shutdownRef.current) {
        console.error("Failed to fetch data", err);
      }
    }
  };

  useEffect(() => {
    if (isSetupComplete) {
      fetchData();
      const interval = setInterval(fetchData, 2000);
      return () => clearInterval(interval);
    }
  }, [isSetupComplete]);

  if (isSetupComplete === null) {
    return <div className="min-h-screen bg-[#09090b] flex items-center justify-center text-white">Loading...</div>;
  }

  if (isSetupComplete === false) {
    return <SetupPage onComplete={() => setIsSetupComplete(true)} />;
  }

  const handleResolve = async (ids: string[], resolution: 'approved' | 'discarded', banDuration?: string) => {
    try {
      // Resolve all actions sequentially
      await Promise.all(ids.map(id =>
        fetch(`/api/actions/${id}/resolve`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ resolution, banDuration })
        })
      ));

      setActions(prev => prev.filter(a => !ids.includes(a.id)));
    } catch (err) {
      console.error('Failed to resolve actions', err);
    }
  };

  const handleDeleteUser = async (username: string) => {
    try {
      await fetch(`/api/users/${username}`, { method: 'DELETE' });
      // Refresh data
      setUsers(prev => prev.filter(u => u.username !== username));
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
      body: JSON.stringify({ username: debugUser, message: debugMsg })
    });
    alert('Message sent!');
  };

  const sendDebugFlag = async () => {
    await fetch('/api/debug/flag', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: debugUser, message: debugMsg, reason: debugReason })
    });
    alert('Flag created!');
    fetchData();
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

  // Group actions by username
  const groupedActions = actions.reduce((acc, action) => {
    if (!acc[action.username]) {
      acc[action.username] = [];
    }
    acc[action.username].push(action);
    return acc;
  }, {} as Record<string, PendingAction[]>);

  const actionGroups = Object.values(groupedActions);

  return (
    <div className="min-h-screen w-full bg-[#09090b] text-white font-inter flex relative overflow-hidden">
      <Sidebar activeTab={activeTab} setActiveTab={setActiveTab} />

      <div className="flex-1 flex flex-col md:ml-64 relative">
        <Topbar onShutdown={handleShutdown} isConnected={isTwitchConnected} />

        <main className="flex-1 p-8 pt-24 overflow-y-auto custom-scrollbar relative z-0">
          <AnimatePresence mode="wait">
            {activeTab === 'actions' && (
              <motion.div
                key="actions"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.2 }}
                className="max-w-5xl mx-auto space-y-8"
              >
                {actions.length === 0 ? (
                  <div className="bg-[#18181b] rounded-3xl p-16 border border-white/5 h-80 flex flex-col justify-center text-center shadow-2xl">
                    <h3 className="text-4xl font-black mb-6 text-white uppercase tracking-tight">All quiet in chat</h3>
                    <p className="text-zinc-500 text-xl font-medium tracking-wide">No flagged messages to review.</p>
                  </div>
                ) : (
                  <>
                    <div className="flex items-center justify-between mb-8 px-2">
                      <h2 className="text-2xl font-black text-white uppercase tracking-tight flex items-center gap-3">
                        <span className="w-2 h-8 bg-blue-500 rounded-full" />
                        Action Required
                      </h2>
                      <div className="bg-red-500 text-white px-5 py-2 rounded-full text-sm font-black uppercase tracking-widest shadow-[0_0_15px_rgba(239,68,68,0.5)]">
                        {actions.length} Pending ({actionGroups.length} Users)
                      </div>
                    </div>
                    <div className="space-y-6">
                      {actionGroups.map((group) => (
                        <ActionCard key={group[0].username} actions={group} onResolve={handleResolve} />
                      ))}
                    </div>
                  </>
                )}
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
                <UserList users={users} onDeleteUser={handleDeleteUser} />
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
                <Settings />
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
                  <div>
                    <label className="block text-xs uppercase text-zinc-500 mb-3 font-black tracking-widest ml-1">Fake Username</label>
                    <input
                      className="w-full bg-zinc-800 border-2 border-transparent rounded-xl p-5 text-white font-bold focus:border-zinc-600 focus:outline-none transition-all placeholder:text-zinc-600 shadow-inner"
                      value={debugUser}
                      onChange={e => setDebugUser(e.target.value)}
                      placeholder="Username..."
                    />
                  </div>
                  <div>
                    <label className="block text-xs uppercase text-zinc-500 mb-3 font-black tracking-widest ml-1">Message Content</label>
                    <textarea
                      className="w-full bg-zinc-800 border-2 border-transparent rounded-xl p-5 text-white font-bold h-40 focus:border-zinc-600 focus:outline-none transition-all resize-none placeholder:text-zinc-600 leading-relaxed shadow-inner"
                      value={debugMsg}
                      onChange={e => setDebugMsg(e.target.value)}
                      placeholder="Type a test message here..."
                    />
                  </div>
                  <div>
                    <label className="block text-xs uppercase text-zinc-500 mb-3 font-black tracking-widest ml-1">Flag/Ban Reason</label>
                    <input
                      className="w-full bg-zinc-800 border-2 border-transparent rounded-xl p-5 text-white font-bold focus:border-zinc-600 focus:outline-none transition-all placeholder:text-zinc-600 shadow-inner"
                      value={debugReason}
                      onChange={e => setDebugReason(e.target.value)}
                      placeholder="Reason..."
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-6 pt-6">
                    <button onClick={sendDebugMessage} className="w-full py-5 text-sm uppercase tracking-widest font-black text-white bg-zinc-700 hover:bg-zinc-600 rounded-xl transition-all shadow-lg hover:shadow-xl hover:-translate-y-1">
                      Simulate Chat
                    </button>
                    <button onClick={sendDebugFlag} className="w-full py-5 text-sm uppercase tracking-widest font-black text-white bg-zinc-700 hover:bg-zinc-600 rounded-xl transition-all shadow-lg hover:shadow-xl hover:-translate-y-1">
                      Force Flag
                    </button>
                  </div>
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
