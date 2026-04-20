import { Server, Wifi, WifiOff, RefreshCw, Zap, Check } from 'lucide-react';
import { Button } from '@forge/ui';
import type { ProviderConfig, ProviderHealthResult, ProviderKind, ModelDescriptor } from '@forge/shared';

interface SettingsViewProps {
  providerHealth: ProviderHealthResult | null;
  settingsForm: { kind: ProviderKind; baseUrl: string; modelId: string; apiKey: string };
  setSettingsForm: (val: any) => void;
  availableModels: ModelDescriptor[];
  providerConfig: ProviderConfig | null;
  saveProviderSettings: () => void;
  runHealthCheck: () => void;
  isCheckingHealth: boolean;
  testPrompt: string;
  setTestPrompt: (val: string) => void;
  runTestGeneration: () => void;
  testResponse: string;
}

export function SettingsView({
  providerHealth,
  settingsForm,
  setSettingsForm,
  availableModels,
  providerConfig,
  saveProviderSettings,
  runHealthCheck,
  isCheckingHealth,
  testPrompt,
  setTestPrompt,
  runTestGeneration,
  testResponse,
}: SettingsViewProps) {
  return (
    <div className="flex-1 pt-10 max-w-3xl mx-auto w-full px-8 pb-10">
      <h2 className="text-3xl font-semibold mb-8 flex items-center border-b border-neutral-900 pb-4">
        <Server className="w-8 h-8 mr-4 text-blue-500"/> AI Provider Configuration
      </h2>

      {/* Health Banner */}
      {providerHealth && (
        <div className={`mb-6 p-4 rounded-xl border text-sm font-medium flex items-center ${
          providerHealth.reachable ? 'bg-green-950/20 border-green-900/30 text-green-400' : 'bg-red-950/20 border-red-900/30 text-red-400'
        }`}>
          {providerHealth.reachable ? <Wifi className="w-5 h-5 mr-3"/> : <WifiOff className="w-5 h-5 mr-3"/>}
          {providerHealth.message}
        </div>
      )}

      <div className="grid gap-6">
        <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-6">
          <h3 className="text-sm font-semibold text-neutral-400 uppercase tracking-widest mb-5">Connection Settings</h3>

          <div className="space-y-4">
            <div>
              <label className="block text-xs text-neutral-500 font-semibold mb-1.5">Provider Type</label>
              <select 
                value={settingsForm.kind} 
                onChange={e => setSettingsForm((prev: any) => ({ ...prev, kind: e.target.value as ProviderKind }))}
                className="w-full bg-black border border-neutral-800 rounded-lg px-3 py-2.5 text-sm text-neutral-200 outline-none focus:border-blue-500"
              >
                <option value="ollama">Ollama (Local)</option>
                <option value="openai_compatible">OpenAI Compatible</option>
                <option value="open_ai">OpenAI</option>
              </select>
            </div>

            <div>
              <label className="block text-xs text-neutral-500 font-semibold mb-1.5">Base URL</label>
              <input 
                value={settingsForm.baseUrl} 
                onChange={e => setSettingsForm((prev: any) => ({ ...prev, baseUrl: e.target.value }))}
                className="w-full bg-black border border-neutral-800 rounded-lg px-3 py-2.5 text-sm text-neutral-200 font-mono outline-none focus:border-blue-500" 
              />
            </div>

            <div>
              <label className="block text-xs text-neutral-500 font-semibold mb-1.5">Model ID</label>
              <div className="flex space-x-2">
                <input 
                  value={settingsForm.modelId} 
                  onChange={e => setSettingsForm((prev: any) => ({ ...prev, modelId: e.target.value }))}
                  className="flex-1 bg-black border border-neutral-800 rounded-lg px-3 py-2.5 text-sm text-neutral-200 font-mono outline-none focus:border-blue-500"
                  placeholder="e.g. llama3.2, gpt-4o, mistral" 
                />
                {availableModels.length > 0 && (
                  <select 
                    onChange={e => setSettingsForm((prev: any) => ({ ...prev, modelId: e.target.value }))} 
                    className="bg-neutral-800 border border-neutral-700 rounded-lg px-2 text-xs text-neutral-300"
                  >
                    <option value="">Select...</option>
                    {availableModels.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
                  </select>
                )}
              </div>
            </div>

            {settingsForm.kind !== 'ollama' && (
              <div>
                <label className="block text-xs text-neutral-500 font-semibold mb-1.5">
                  API Key {providerConfig?.apiKeySet && <span className="text-green-500 ml-2">(saved)</span>}
                </label>
                <input 
                  value={settingsForm.apiKey} 
                  onChange={e => setSettingsForm((prev: any) => ({ ...prev, apiKey: e.target.value }))}
                  type="password" 
                  placeholder={providerConfig?.apiKeySet ? "••••••• (update to change)" : "Enter API key"}
                  className="w-full bg-black border border-neutral-800 rounded-lg px-3 py-2.5 text-sm text-neutral-200 outline-none focus:border-blue-500" 
                />
              </div>
            )}
          </div>

          <div className="flex space-x-3 mt-6">
            <Button onClick={saveProviderSettings} className="bg-blue-600 hover:bg-blue-700 font-bold flex-1 justify-center">
              <Check className="w-4 h-4 mr-2"/> Save Configuration
            </Button>
            <Button 
              onClick={runHealthCheck} 
              disabled={isCheckingHealth} 
              className="bg-neutral-800 hover:bg-neutral-700 font-medium whitespace-nowrap px-4"
            >
              <RefreshCw className={`w-4 h-4 mr-2 ${isCheckingHealth ? 'animate-spin' : ''}`}/> Test Connection
            </Button>
          </div>
        </div>

        {/* Test Generation */}
        <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-6">
          <h3 className="text-sm font-semibold text-neutral-400 uppercase tracking-widest mb-5">Test Generation</h3>
          <textarea 
            value={testPrompt} 
            onChange={e => setTestPrompt(e.target.value)}
            placeholder="Type a test prompt to verify your model responds..."
            className="w-full bg-black border border-neutral-800 rounded-lg px-3 py-2.5 text-sm text-neutral-200 outline-none focus:border-blue-500 resize-none font-mono" 
            rows={3} 
          />
          <Button onClick={runTestGeneration} disabled={!testPrompt} className="mt-3 bg-purple-600 hover:bg-purple-700 font-bold w-full justify-center">
            <Zap className="w-4 h-4 mr-2"/> Generate
          </Button>
          {testResponse && (
            <div className="mt-4 bg-black border border-neutral-800 rounded-lg p-4 text-xs font-mono text-blue-300 leading-relaxed whitespace-pre-wrap max-h-[300px] overflow-y-auto">
              {testResponse}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
