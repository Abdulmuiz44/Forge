import type { Dispatch, SetStateAction } from 'react';
import { Globe, X, Play, Code, Layout, Terminal, RefreshCw, Zap } from 'lucide-react';
import { Button } from '@codra/ui';
import type { BrowserSessionState, BrowserActionKind } from '@codra/shared';

interface BrowserViewProps {
  browserSession: BrowserSessionState | null;
  launchBrowserSession: () => void;
  closeBrowserSession: () => void;
  browserAction: string;
  setBrowserAction: (val: string) => void;
  triggerBrowserAction: (kind?: BrowserActionKind, overrideValue?: string) => void;
  lastScreenshot: string | null;
  workspace: any | null;
  timeline: { timestamp: string; message: string; source: string }[];
  setTimeline: Dispatch<SetStateAction<{ timestamp: string; message: string; source: "system" | "browser" | "verifier" }[]>>;
}

export function BrowserView({
  browserSession,
  launchBrowserSession,
  closeBrowserSession,
  browserAction,
  setBrowserAction,
  triggerBrowserAction,
  lastScreenshot,
  workspace,
  timeline,
  setTimeline,
}: BrowserViewProps) {
  return (
    <div className="flex-1 flex flex-col pt-6 max-w-5xl mx-auto w-full px-8 pb-10">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-semibold flex items-center">
          <Globe className="w-6 h-6 mr-3 text-blue-400"/> Browser Runtime
        </h2>
        <div className="flex items-center space-x-3">
          {browserSession?.status === 'ready' || browserSession?.status === 'busy' || browserSession?.status === 'navigating' ? (
            <Button variant="outline" className="text-red-400 border-red-900/30 hover:bg-red-950/20" onClick={closeBrowserSession}>
              <X className="w-4 h-4 mr-2"/> Stop Session
            </Button>
          ) : (
            <Button className="bg-blue-600 hover:bg-blue-700 font-bold" onClick={launchBrowserSession} disabled={!workspace}>
              <Play className="w-4 h-4 mr-2"/> Launch Browser
            </Button>
          )}
          <div className={`px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider border ${
            browserSession?.status === 'ready' ? 'bg-green-950/20 border-green-900/30 text-green-400' :
            browserSession?.status === 'disconnected' ? 'bg-neutral-900 border-neutral-800 text-neutral-500' :
            'bg-blue-950/20 border-blue-900/30 text-blue-400 animate-pulse'
          }`}>
            {browserSession?.status ?? 'disconnected'}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6">
        {/* Toolbar */}
        <div className="bg-neutral-900 border border-neutral-800 p-2 rounded-xl flex items-center space-x-2 shadow-2xl">
          <div className="flex-1 flex items-center bg-black rounded-lg border border-neutral-800 px-4 py-2 focus-within:border-blue-500 transition-colors">
            <Globe className="w-4 h-4 text-neutral-600 mr-3" />
            <input 
              className="flex-1 bg-transparent text-sm text-neutral-200 outline-none font-mono"
              placeholder="Enter URL to navigate..." 
              value={browserAction} 
              onChange={e => setBrowserAction(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && triggerBrowserAction('open_url')}
            />
          </div>
          <Button onClick={() => triggerBrowserAction('open_url')} className="bg-blue-600 h-10 w-20 justify-center" disabled={!browserSession || browserSession.status === 'disconnected'}>
            Go
          </Button>
          <div className="h-6 w-px bg-neutral-800 mx-2" />
          <Button variant="outline" className="h-10 px-3" onClick={() => triggerBrowserAction('capture_screenshot')} disabled={!browserSession || browserSession.status === 'disconnected'}>
            <Code className="w-4 h-4" />
          </Button>
        </div>

        {/* Main View */}
        <div className="grid grid-cols-[1fr_300px] gap-6 h-[500px]">
          <div className="bg-black border border-neutral-800 rounded-2xl overflow-hidden relative group">
            {lastScreenshot ? (
              <img src={`data:image/png;base64,${lastScreenshot}`} className="w-full h-full object-contain" alt="Browser Viewport" />
            ) : (
              <div className="w-full h-full flex flex-col items-center justify-center text-neutral-700 bg-[radial-gradient(#111_1px,transparent_0)] [background-size:20px_20px]">
                <Zap className="w-12 h-12 mb-4 opacity-20" />
                <p className="text-sm font-medium opacity-40">No viewport data available</p>
                <p className="text-xs opacity-30 mt-2">Launch a session and navigate to a URL to see content</p>
              </div>
            )}
            
            {browserSession?.currentTarget && (
              <div className="absolute top-4 left-4 right-4 bg-black/80 backdrop-blur-md border border-neutral-800 p-3 rounded-lg flex items-center justify-between opacity-0 group-hover:opacity-100 transition-opacity">
                <div className="flex items-center overflow-hidden mr-4">
                  <Layout className="w-4 h-4 text-blue-500 mr-3 shrink-0" />
                  <div className="truncate">
                    <p className="text-[10px] font-bold text-neutral-500 uppercase leading-none mb-1">Current Page</p>
                    <p className="text-xs text-neutral-300 truncate font-medium">{browserSession.currentTarget.title || 'Untitled'}</p>
                  </div>
                </div>
                <div className="text-[10px] font-mono text-neutral-500 bg-neutral-900 px-2 py-1 rounded truncate max-w-[200px]">
                  {browserSession.currentTarget.url}
                </div>
              </div>
            )}
          </div>

          {/* Sidebar Log */}
          <div className="bg-neutral-900 border border-neutral-800 rounded-2xl flex flex-col overflow-hidden shadow-xl">
            <div className="px-4 py-3 border-b border-neutral-800 bg-black/20 flex items-center justify-between">
              <span className="text-[10px] font-bold text-neutral-500 uppercase tracking-widest flex items-center">
                <Terminal className="w-3 h-3 mr-2"/> Action Log
              </span>
              <Button 
                variant="ghost" 
                className="h-6 w-6 p-0 text-neutral-600" 
                onClick={() => setTimeline(prev => prev.filter(t => t.source !== 'browser'))}
              >
                <RefreshCw className="w-3 h-3"/>
              </Button>
            </div>
            <div className="flex-1 overflow-y-auto p-4 space-y-3 font-mono text-[11px] leading-relaxed">
              {timeline.filter(t => t.source === 'browser').length === 0 ? (
                <div className="h-full flex items-center justify-center text-neutral-700 italic">No events yet</div>
              ) : (
                timeline.filter(t => t.source === 'browser').map((item, i) => (
                  <div key={i} className={`pb-2 border-b border-neutral-800/50 ${
                    item.message.includes('ERROR') ? 'text-red-400' : 
                    item.message.includes('OK') ? 'text-green-400' : 
                    'text-neutral-500'
                  }`}>
                    {item.message}
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
