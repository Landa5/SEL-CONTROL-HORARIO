'use client';

import React, { useState, useEffect, useCallback } from 'react';
import {
  Monitor, Settings, Plus, History, Clock, Wifi, WifiOff,
  Check, X, Eye, Loader2, RefreshCw, ChevronRight, Zap,
  Sun, Moon, Calendar, AlertTriangle, Shield, Copy,
  Send, CheckCircle, XCircle, RotateCcw, Image as ImageIcon,
  Video, Fuel, MessageSquare, Tag, Palette, Save, Play
} from 'lucide-react';

// ============================================================
// Types
// ============================================================

interface VnnoxConfig {
  id: number;
  provider: string;
  baseUrl: string;
  appKey: string;
  hasSecret: boolean;
  defaultPlayerId?: string;
  isActive: boolean;
  lastConnectionCheckAt?: string;
  lastConnectionStatus?: string;
  screens?: DisplayScreen[];
}

interface DisplayScreen {
  id: number;
  playerId: string;
  playerName?: string;
  resolutionWidth?: number;
  resolutionHeight?: number;
  orientation: string;
  isOnline: boolean;
  lastSyncAt?: string;
}

interface VnnoxPlayer {
  playerId: string;
  playerName: string;
  width?: number;
  height?: number;
  status?: string;
}

interface DisplayDraft {
  id: number;
  screenId: number;
  type: string;
  status: string;
  priceDiesel?: number;
  priceGasolina?: number;
  priceDieselPlus?: number;
  priceAdBlue?: number;
  showAdBlue: boolean;
  promoTitle?: string;
  promoText?: string;
  messageText?: string;
  templateId?: string;
  previewImageUrl?: string;
  publishedAt?: string;
  approvedAt?: string;
  createdAt: string;
  updatedAt: string;
  screen?: DisplayScreen;
  _count?: { logs: number };
}

interface Template {
  id: string;
  name: string;
  description: string;
  preview?: string;
}

// ============================================================
// Main Component
// ============================================================

export default function VnnoxDashboardPage() {
  const [activeTab, setActiveTab] = useState('config');

  const tabs = [
    { id: 'config', label: 'Configuración', icon: Settings },
    { id: 'publish', label: 'Crear Publicación', icon: Plus },
    { id: 'history', label: 'Histórico', icon: History },
    { id: 'schedule', label: 'Programación', icon: Clock },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center shadow-lg">
              <Monitor className="w-5 h-5 text-white" />
            </div>
            Pantallas / VNNOX
          </h1>
          <p className="text-sm text-gray-500 mt-1">Gestión de contenido para pantallas de estación de servicio</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-gray-100 p-1 rounded-xl">
        {tabs.map(tab => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-all flex-1 justify-center ${
                isActive
                  ? 'bg-white text-blue-700 shadow-sm'
                  : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'
              }`}
            >
              <Icon className="w-4 h-4" />
              <span className="hidden sm:inline">{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* Tab Content */}
      {activeTab === 'config' && <ConfigTab />}
      {activeTab === 'publish' && <PublishTab />}
      {activeTab === 'history' && <HistoryTab />}
      {activeTab === 'schedule' && <ScheduleTab />}
    </div>
  );
}

// ============================================================
// Config Tab
// ============================================================

function ConfigTab() {
  const [config, setConfig] = useState<VnnoxConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);
  const [players, setPlayers] = useState<VnnoxPlayer[]>([]);
  const [loadingPlayers, setLoadingPlayers] = useState(false);

  // Form state
  const [formData, setFormData] = useState({
    baseUrl: 'https://open-eu.vnnox.com',
    appKey: '',
    appSecret: '',
    isActive: true,
  });

  const fetchConfig = useCallback(async () => {
    try {
      const res = await fetch('/api/vnnox/config');
      const data = await res.json();
      if (data.config) {
        setConfig(data.config);
        setFormData(prev => ({
          ...prev,
          baseUrl: data.config.baseUrl || prev.baseUrl,
          appKey: '', // Don't pre-fill — it's partially masked
          isActive: data.config.isActive ?? true,
        }));
      }
    } catch (err) {
      console.error('Error fetching config:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchConfig(); }, [fetchConfig]);

  const handleSave = async () => {
    setSaving(true);
    try {
      const body: any = { baseUrl: formData.baseUrl, isActive: formData.isActive };
      if (formData.appKey) body.appKey = formData.appKey;
      if (formData.appSecret) body.appSecret = formData.appSecret;

      const res = await fetch('/api/vnnox/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (data.config) {
        setConfig(data.config);
        setFormData(prev => ({ ...prev, appKey: '', appSecret: '' }));
      }
    } catch (err) {
      console.error('Error saving config:', err);
    } finally {
      setSaving(false);
    }
  };

  const handleTestConnection = async () => {
    setTesting(true);
    setTestResult(null);
    try {
      const res = await fetch('/api/vnnox/test-connection', { method: 'POST' });
      const data = await res.json();
      setTestResult({ success: data.success, message: data.message });
      if (data.success) fetchConfig(); // Refresh status
    } catch (err) {
      setTestResult({ success: false, message: 'Error de conexión' });
    } finally {
      setTesting(false);
    }
  };

  const handleFetchPlayers = async () => {
    setLoadingPlayers(true);
    try {
      const res = await fetch('/api/vnnox/players');
      const data = await res.json();
      setPlayers(data.players || []);
    } catch (err) {
      console.error('Error fetching players:', err);
    } finally {
      setLoadingPlayers(false);
    }
  };

  const handleSelectPlayer = async (playerId: string) => {
    try {
      const res = await fetch('/api/vnnox/players', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ playerId, setAsDefault: true }),
      });
      const data = await res.json();
      if (data.screen) {
        fetchConfig();
        handleFetchPlayers();
      }
    } catch (err) {
      console.error('Error selecting player:', err);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Status Card */}
      <div className="bg-white rounded-xl border shadow-sm p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold text-gray-900 flex items-center gap-2">
            <Shield className="w-5 h-5 text-blue-500" />
            Estado de la Conexión
          </h3>
          {config && (
            <span className={`px-3 py-1 rounded-full text-xs font-bold ${
              config.isActive ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'
            }`}>
              {config.isActive ? 'ACTIVO' : 'INACTIVO'}
            </span>
          )}
        </div>

        {config ? (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div>
              <p className="text-xs text-gray-400 uppercase font-bold">Provider</p>
              <p className="text-sm font-medium">{config.provider}</p>
            </div>
            <div>
              <p className="text-xs text-gray-400 uppercase font-bold">Base URL</p>
              <p className="text-sm font-mono text-gray-600 truncate">{config.baseUrl}</p>
            </div>
            <div>
              <p className="text-xs text-gray-400 uppercase font-bold">AppKey</p>
              <p className="text-sm font-mono text-gray-600">{config.appKey}</p>
            </div>
            <div>
              <p className="text-xs text-gray-400 uppercase font-bold">Última Comprobación</p>
              <p className="text-sm">
                {config.lastConnectionCheckAt
                  ? new Date(config.lastConnectionCheckAt).toLocaleString('es-ES')
                  : 'Nunca'}
                {config.lastConnectionStatus && (
                  <span className={`ml-2 text-xs font-bold ${
                    config.lastConnectionStatus === 'OK' ? 'text-green-600' : 'text-red-600'
                  }`}>
                    {config.lastConnectionStatus}
                  </span>
                )}
              </p>
            </div>
          </div>
        ) : (
          <p className="text-gray-400 text-sm">No hay configuración. Introduce las credenciales abajo.</p>
        )}
      </div>

      {/* Config Form */}
      <div className="bg-white rounded-xl border shadow-sm p-6">
        <h3 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
          <Settings className="w-5 h-5 text-gray-400" />
          Credenciales VNNOX
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Base URL</label>
            <input
              type="text"
              value={formData.baseUrl}
              onChange={e => setFormData(prev => ({ ...prev, baseUrl: e.target.value }))}
              className="w-full rounded-lg border px-3 py-2 text-sm font-mono text-gray-700 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              placeholder="https://open-eu.vnnox.com"
            />
          </div>
          <div className="flex items-end gap-2">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={formData.isActive}
                onChange={e => setFormData(prev => ({ ...prev, isActive: e.target.checked }))}
                className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
              />
              <span className="text-sm font-medium text-gray-700">Activo</span>
            </label>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              AppKey {config?.appKey && <span className="text-gray-400">(actual: {config.appKey})</span>}
            </label>
            <input
              type="text"
              value={formData.appKey}
              onChange={e => setFormData(prev => ({ ...prev, appKey: e.target.value }))}
              className="w-full rounded-lg border px-3 py-2 text-sm font-mono focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              placeholder={config ? 'Dejar vacío para mantener actual' : 'Tu AppKey de VNNOX'}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              AppSecret {config?.hasSecret && <span className="text-green-600 text-xs">✓ Guardado</span>}
            </label>
            <input
              type="password"
              value={formData.appSecret}
              onChange={e => setFormData(prev => ({ ...prev, appSecret: e.target.value }))}
              className="w-full rounded-lg border px-3 py-2 text-sm font-mono focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              placeholder={config?.hasSecret ? 'Dejar vacío para mantener actual' : 'Tu AppSecret de VNNOX'}
            />
          </div>
        </div>

        <div className="flex gap-3 mt-6">
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex items-center gap-2 px-5 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium text-sm disabled:opacity-50"
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            Guardar
          </button>
          <button
            onClick={handleTestConnection}
            disabled={testing || !config}
            className="flex items-center gap-2 px-5 py-2.5 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors font-medium text-sm disabled:opacity-50"
          >
            {testing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Zap className="w-4 h-4" />}
            Probar Conexión
          </button>
        </div>

        {testResult && (
          <div className={`mt-4 p-4 rounded-lg flex items-start gap-3 ${
            testResult.success ? 'bg-green-50 border border-green-200' : 'bg-red-50 border border-red-200'
          }`}>
            {testResult.success ? (
              <CheckCircle className="w-5 h-5 text-green-600 shrink-0 mt-0.5" />
            ) : (
              <XCircle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
            )}
            <p className={`text-sm ${testResult.success ? 'text-green-700' : 'text-red-700'}`}>
              {testResult.message}
            </p>
          </div>
        )}
      </div>

      {/* Players */}
      <div className="bg-white rounded-xl border shadow-sm p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold text-gray-900 flex items-center gap-2">
            <Monitor className="w-5 h-5 text-indigo-500" />
            Players Disponibles
          </h3>
          <button
            onClick={handleFetchPlayers}
            disabled={loadingPlayers || !config}
            className="flex items-center gap-2 px-3 py-1.5 bg-indigo-50 text-indigo-700 rounded-lg hover:bg-indigo-100 transition-colors text-sm font-medium disabled:opacity-50"
          >
            {loadingPlayers ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
            Actualizar
          </button>
        </div>

        {/* Saved screens */}
        {config?.screens && config.screens.length > 0 && (
          <div className="mb-4">
            <p className="text-xs font-bold text-gray-400 uppercase mb-2">Pantallas Guardadas</p>
            {config.screens.map(screen => (
              <div key={screen.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg mb-2">
                <div className="flex items-center gap-3">
                  {screen.isOnline ? (
                    <Wifi className="w-4 h-4 text-green-500" />
                  ) : (
                    <WifiOff className="w-4 h-4 text-red-400" />
                  )}
                  <div>
                    <p className="text-sm font-medium">{screen.playerName || screen.playerId}</p>
                    <p className="text-xs text-gray-400">
                      {screen.resolutionWidth && screen.resolutionHeight
                        ? `${screen.resolutionWidth}×${screen.resolutionHeight} — ${screen.orientation}`
                        : 'Resolución pendiente'}
                      {config.defaultPlayerId === screen.playerId && (
                        <span className="ml-2 text-blue-600 font-bold">★ Por defecto</span>
                      )}
                    </p>
                  </div>
                </div>
                <span className={`px-2 py-1 rounded text-xs font-bold ${
                  screen.isOnline ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-600'
                }`}>
                  {screen.isOnline ? 'ONLINE' : 'OFFLINE'}
                </span>
              </div>
            ))}
          </div>
        )}

        {/* Remote players */}
        {players.length > 0 && (
          <div>
            <p className="text-xs font-bold text-gray-400 uppercase mb-2">Players de VNNOX ({players.length})</p>
            <div className="space-y-2">
              {players.map(player => (
                <div key={player.playerId} className="flex items-center justify-between p-3 border rounded-lg hover:bg-gray-50 transition-colors">
                  <div className="flex items-center gap-3">
                    {player.status === 'ONLINE' ? (
                      <Wifi className="w-4 h-4 text-green-500" />
                    ) : (
                      <WifiOff className="w-4 h-4 text-gray-400" />
                    )}
                    <div>
                      <p className="text-sm font-medium">{player.playerName}</p>
                      <p className="text-xs text-gray-400">
                        ID: {player.playerId}
                        {player.width && player.height && ` — ${player.width}×${player.height}`}
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={() => handleSelectPlayer(player.playerId)}
                    className="flex items-center gap-1 px-3 py-1.5 bg-blue-50 text-blue-700 rounded-lg hover:bg-blue-100 transition-colors text-xs font-medium"
                  >
                    <Check className="w-3 h-3" />
                    Seleccionar
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {players.length === 0 && !loadingPlayers && (
          <p className="text-sm text-gray-400 text-center py-4">
            Pulsa &quot;Actualizar&quot; para cargar players desde VNNOX
          </p>
        )}
      </div>
    </div>
  );
}

// ============================================================
// Publish Tab
// ============================================================

function PublishTab() {
  const [templates, setTemplates] = useState<Template[]>([]);
  const [saving, setSaving] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [draftId, setDraftId] = useState<number | null>(null);
  const [actionStatus, setActionStatus] = useState<string | null>(null);

  const [form, setForm] = useState({
    priceDiesel: '',
    priceGasolina: '',
    priceDieselPlus: '',
    priceAdBlue: '',
    showAdBlue: false,
    promoTitle: '',
    promoText: '',
    messageText: '',
    templateId: 'default',
  });

  useEffect(() => {
    fetch('/api/vnnox/templates')
      .then(res => res.json())
      .then(data => setTemplates(data.templates || []))
      .catch(() => {});
  }, []);

  const handleSaveDraft = async () => {
    setSaving(true);
    setActionStatus(null);
    try {
      const res = await fetch('/api/vnnox/drafts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (data.draft) {
        setDraftId(data.draft.id);
        setActionStatus('Borrador guardado correctamente');
      } else {
        setActionStatus(data.error || 'Error al guardar');
      }
    } catch (err) {
      setActionStatus('Error de red');
    } finally {
      setSaving(false);
    }
  };

  const handleGeneratePreview = async () => {
    if (!draftId) {
      setActionStatus('Guarda el borrador primero');
      return;
    }
    setActionStatus(null);
    try {
      const res = await fetch(`/api/vnnox/drafts/${draftId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'generate-preview' }),
      });
      const data = await res.json();
      if (data.previewUrl) {
        setPreviewUrl(data.previewUrl);
        setActionStatus('Preview generado');
      } else {
        setActionStatus(data.error || 'Error al generar preview');
      }
    } catch (err) {
      setActionStatus('Error de red');
    }
  };

  const handleDraftAction = async (action: string) => {
    if (!draftId) return;
    setActionStatus(null);
    try {
      const res = await fetch(`/api/vnnox/drafts/${draftId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action }),
      });
      const data = await res.json();
      setActionStatus(data.message || data.error || `Acción ${action} completada`);
    } catch (err) {
      setActionStatus('Error de red');
    }
  };

  return (
    <div className="space-y-6">
      {/* Price Form */}
      <div className="bg-white rounded-xl border shadow-sm p-6">
        <h3 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
          <Fuel className="w-5 h-5 text-amber-500" />
          Precios de Combustible
        </h3>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <PriceInput label="Diésel" value={form.priceDiesel} color="amber"
            onChange={v => setForm(p => ({ ...p, priceDiesel: v }))} />
          <PriceInput label="Gasolina" value={form.priceGasolina} color="red"
            onChange={v => setForm(p => ({ ...p, priceGasolina: v }))} />
          <PriceInput label="Diésel+" value={form.priceDieselPlus} color="purple"
            onChange={v => setForm(p => ({ ...p, priceDieselPlus: v }))} />
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-sm font-medium text-gray-700">AdBlue</label>
              <label className="flex items-center gap-1 cursor-pointer">
                <input
                  type="checkbox"
                  checked={form.showAdBlue}
                  onChange={e => setForm(p => ({ ...p, showAdBlue: e.target.checked }))}
                  className="rounded border-gray-300 text-cyan-600 focus:ring-cyan-500 w-3.5 h-3.5"
                />
                <span className="text-xs text-gray-500">Mostrar</span>
              </label>
            </div>
            <input
              type="text"
              value={form.priceAdBlue}
              onChange={e => setForm(p => ({ ...p, priceAdBlue: e.target.value }))}
              disabled={!form.showAdBlue}
              className="w-full rounded-lg border px-3 py-2.5 text-lg font-bold text-center tabular-nums disabled:bg-gray-50 disabled:text-gray-300 focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500"
              placeholder="0.000"
            />
          </div>
        </div>
      </div>

      {/* Promo & Message */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-white rounded-xl border shadow-sm p-6">
          <h3 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <Tag className="w-5 h-5 text-orange-500" />
            Oferta / Promoción
          </h3>
          <div className="space-y-3">
            <input
              type="text"
              value={form.promoTitle}
              onChange={e => setForm(p => ({ ...p, promoTitle: e.target.value }))}
              className="w-full rounded-lg border px-3 py-2 text-sm focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
              placeholder="Título de la promoción..."
            />
            <textarea
              value={form.promoText}
              onChange={e => setForm(p => ({ ...p, promoText: e.target.value }))}
              className="w-full rounded-lg border px-3 py-2 text-sm h-24 resize-none focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
              placeholder="Descripción de la promoción..."
            />
          </div>
        </div>

        <div className="bg-white rounded-xl border shadow-sm p-6">
          <h3 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <MessageSquare className="w-5 h-5 text-blue-500" />
            Mensaje Adicional
          </h3>
          <textarea
            value={form.messageText}
            onChange={e => setForm(p => ({ ...p, messageText: e.target.value }))}
            className="w-full rounded-lg border px-3 py-2 text-sm h-32 resize-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            placeholder="Mensaje adicional para la pantalla..."
          />
        </div>
      </div>

      {/* Template Selector */}
      <div className="bg-white rounded-xl border shadow-sm p-6">
        <h3 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
          <Palette className="w-5 h-5 text-purple-500" />
          Plantilla
        </h3>
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          {templates.map(tpl => (
            <button
              key={tpl.id}
              onClick={() => setForm(p => ({ ...p, templateId: tpl.id }))}
              className={`p-2 rounded-lg border-2 transition-all ${
                form.templateId === tpl.id
                  ? 'border-blue-500 ring-2 ring-blue-200'
                  : 'border-gray-200 hover:border-gray-300'
              }`}
            >
              {tpl.preview && (
                <img src={tpl.preview} alt={tpl.name} className="w-full h-20 object-cover rounded mb-2" />
              )}
              <p className="text-xs font-medium text-gray-700 truncate">{tpl.name}</p>
            </button>
          ))}
        </div>
      </div>

      {/* Preview */}
      {previewUrl && (
        <div className="bg-white rounded-xl border shadow-sm p-6">
          <h3 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <Eye className="w-5 h-5 text-green-500" />
            Vista Previa
          </h3>
          <div className="bg-black rounded-lg p-2 max-w-3xl mx-auto">
            <img src={previewUrl} alt="Preview" className="w-full rounded" />
          </div>
        </div>
      )}

      {/* Actions */}
      <div className="bg-white rounded-xl border shadow-sm p-6">
        <div className="flex flex-wrap gap-3">
          <button
            onClick={handleSaveDraft}
            disabled={saving}
            className="flex items-center gap-2 px-5 py-2.5 bg-gray-700 text-white rounded-lg hover:bg-gray-800 transition-colors font-medium text-sm disabled:opacity-50"
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            Guardar Borrador
          </button>
          <button
            onClick={handleGeneratePreview}
            disabled={!draftId}
            className="flex items-center gap-2 px-5 py-2.5 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors font-medium text-sm disabled:opacity-50"
          >
            <Eye className="w-4 h-4" />
            Generar Preview
          </button>
          <button
            onClick={() => handleDraftAction('submit-approval')}
            disabled={!draftId}
            className="flex items-center gap-2 px-5 py-2.5 bg-orange-500 text-white rounded-lg hover:bg-orange-600 transition-colors font-medium text-sm disabled:opacity-50"
          >
            <Send className="w-4 h-4" />
            Enviar a Validación
          </button>
          <button
            onClick={() => handleDraftAction('approve')}
            disabled={!draftId}
            className="flex items-center gap-2 px-5 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium text-sm disabled:opacity-50"
          >
            <CheckCircle className="w-4 h-4" />
            Aprobar
          </button>
          <button
            onClick={() => handleDraftAction('publish')}
            disabled={!draftId}
            className="flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-green-600 to-emerald-600 text-white rounded-lg hover:from-green-700 hover:to-emerald-700 transition-colors font-medium text-sm disabled:opacity-50 shadow-lg"
          >
            <Play className="w-4 h-4" />
            Publicar Ahora
          </button>
        </div>

        {actionStatus && (
          <div className="mt-4 p-3 bg-blue-50 text-blue-700 rounded-lg text-sm">
            {actionStatus}
          </div>
        )}
      </div>
    </div>
  );
}

function PriceInput({ label, value, onChange, color }: {
  label: string; value: string; onChange: (v: string) => void; color: string;
}) {
  const colorMap: Record<string, string> = {
    amber: 'focus:ring-amber-500 focus:border-amber-500',
    red: 'focus:ring-red-500 focus:border-red-500',
    purple: 'focus:ring-purple-500 focus:border-purple-500',
    cyan: 'focus:ring-cyan-500 focus:border-cyan-500',
  };
  const borderColor: Record<string, string> = {
    amber: 'border-l-amber-400',
    red: 'border-l-red-400',
    purple: 'border-l-purple-400',
    cyan: 'border-l-cyan-400',
  };

  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>
      <input
        type="text"
        value={value}
        onChange={e => onChange(e.target.value)}
        className={`w-full rounded-lg border border-l-4 ${borderColor[color]} px-3 py-2.5 text-lg font-bold text-center tabular-nums ${colorMap[color]}`}
        placeholder="0.000"
        inputMode="decimal"
      />
      <p className="text-xs text-gray-400 mt-1 text-center">€/L</p>
    </div>
  );
}

// ============================================================
// History Tab
// ============================================================

function HistoryTab() {
  const [drafts, setDrafts] = useState<DisplayDraft[]>([]);
  const [loading, setLoading] = useState(true);
  const [total, setTotal] = useState(0);
  const [statusFilter, setStatusFilter] = useState('');
  const [republishing, setRepublishing] = useState<number | null>(null);

  const fetchDrafts = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (statusFilter) params.set('status', statusFilter);
      const res = await fetch(`/api/vnnox/drafts?${params}`);
      const data = await res.json();
      setDrafts(data.drafts || []);
      setTotal(data.total || 0);
    } catch (err) {
      console.error('Error fetching drafts:', err);
    } finally {
      setLoading(false);
    }
  }, [statusFilter]);

  useEffect(() => { fetchDrafts(); }, [fetchDrafts]);

  const statusColors: Record<string, string> = {
    DRAFT: 'bg-gray-100 text-gray-600',
    PENDING_APPROVAL: 'bg-yellow-100 text-yellow-700',
    APPROVED: 'bg-blue-100 text-blue-700',
    PUBLISHED: 'bg-green-100 text-green-700',
    FAILED: 'bg-red-100 text-red-700',
    ROLLED_BACK: 'bg-orange-100 text-orange-700',
  };

  const statusLabels: Record<string, string> = {
    DRAFT: 'Borrador',
    PENDING_APPROVAL: 'Pendiente',
    APPROVED: 'Aprobado',
    PUBLISHED: 'Publicado',
    FAILED: 'Error',
    ROLLED_BACK: 'Rollback',
  };

  const handleRepublish = async (draft: DisplayDraft) => {
    if (!confirm(`¿Re-publicar draft #${draft.id} con los mismos precios a la pantalla?`)) return;
    setRepublishing(draft.id);
    try {
      const res = await fetch(`/api/vnnox/drafts/${draft.id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'publish' }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        alert('✅ Re-publicado correctamente');
      } else {
        alert(`❌ Error: ${data.error || data.message || 'Error desconocido'}`);
      }
      fetchDrafts();
    } catch (err) {
      console.error('Error re-publishing:', err);
      alert('❌ Error de conexión');
    } finally {
      setRepublishing(null);
    }
  };

  const handleDuplicate = async (draft: DisplayDraft) => {
    try {
      const res = await fetch('/api/vnnox/drafts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          screenId: draft.screenId,
          priceDiesel: draft.priceDiesel,
          priceGasolina: draft.priceGasolina,
          priceDieselPlus: draft.priceDieselPlus,
          priceAdBlue: draft.priceAdBlue,
          showAdBlue: draft.showAdBlue,
          promoTitle: draft.promoTitle,
          promoText: draft.promoText,
          messageText: draft.messageText,
          templateId: draft.templateId,
        }),
      });
      if (res.ok) {
        alert('✅ Duplicado creado — ve a "Crear Publicación" para editarlo');
        fetchDrafts();
      }
    } catch (err) {
      console.error('Error duplicating:', err);
    }
  };

  const handleRollback = async (draftId: number) => {
    if (!confirm('¿Estás seguro de hacer rollback a la última publicación válida?')) return;
    try {
      await fetch(`/api/vnnox/drafts/${draftId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'rollback' }),
      });
      fetchDrafts();
    } catch (err) {
      console.error('Error rollback:', err);
    }
  };

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex gap-2 flex-wrap">
        {['', 'DRAFT', 'PENDING_APPROVAL', 'APPROVED', 'PUBLISHED', 'FAILED'].map(s => (
          <button
            key={s}
            onClick={() => setStatusFilter(s)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
              statusFilter === s
                ? 'bg-blue-600 text-white'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            {s ? statusLabels[s] || s : 'Todos'}
          </button>
        ))}
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border shadow-sm overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-6 h-6 animate-spin text-blue-500" />
          </div>
        ) : drafts.length === 0 ? (
          <div className="text-center py-20 text-gray-400">
            <History className="w-12 h-12 mx-auto mb-3 opacity-30" />
            <p>No hay publicaciones</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-gray-500 text-xs uppercase">
                <tr>
                  <th className="px-4 py-3 text-left">#</th>
                  <th className="px-4 py-3 text-left">Tipo</th>
                  <th className="px-4 py-3 text-left">Estado</th>
                  <th className="px-4 py-3 text-left">Precios</th>
                  <th className="px-4 py-3 text-left">Promo</th>
                  <th className="px-4 py-3 text-left">Fecha</th>
                  <th className="px-4 py-3 text-left">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {drafts.map(d => (
                  <tr key={d.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-3 font-mono text-gray-400">{d.id}</td>
                    <td className="px-4 py-3">
                      <span className="text-xs font-medium">{d.type}</span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-1 rounded-full text-xs font-bold ${statusColors[d.status] || 'bg-gray-100'}`}>
                        {statusLabels[d.status] || d.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-xs space-x-2">
                      {d.priceDiesel && <span>D:{d.priceDiesel.toFixed(3)}</span>}
                      {d.priceGasolina && <span>G:{d.priceGasolina.toFixed(3)}</span>}
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-500 max-w-[150px] truncate">
                      {d.promoTitle || '—'}
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-400">
                      {new Date(d.createdAt).toLocaleString('es-ES', {
                        day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit'
                      })}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex gap-1">
                        {/* Re-publicar */}
                        <button
                          onClick={() => handleRepublish(d)}
                          disabled={republishing === d.id}
                          title="Re-publicar (enviar de nuevo a pantalla)"
                          className="p-1.5 rounded hover:bg-green-50 text-green-600 disabled:opacity-50"
                        >
                          {republishing === d.id
                            ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            : <Send className="w-3.5 h-3.5" />
                          }
                        </button>
                        {/* Duplicar */}
                        <button
                          onClick={() => handleDuplicate(d)}
                          title="Duplicar (crear copia como borrador)"
                          className="p-1.5 rounded hover:bg-blue-50 text-blue-500"
                        >
                          <Copy className="w-3.5 h-3.5" />
                        </button>
                        {/* Rollback */}
                        {(d.status === 'PUBLISHED' || d.status === 'FAILED') && (
                          <button
                            onClick={() => handleRollback(d.id)}
                            title="Rollback"
                            className="p-1.5 rounded hover:bg-orange-50 text-orange-500"
                          >
                            <RotateCcw className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <p className="text-xs text-gray-400">Total: {total} publicaciones</p>
    </div>
  );
}

// ============================================================
// Schedule Tab
// ============================================================

function ScheduleTab() {
  const [presets, setPresets] = useState<Record<string, any>>({});
  const [selectedPreset, setSelectedPreset] = useState('');
  const [playerId, setPlayerId] = useState('');
  const [screens, setScreens] = useState<DisplayScreen[]>([]);
  const [applyResult, setApplyResult] = useState<string | null>(null);
  const [applying, setApplying] = useState(false);

  useEffect(() => {
    fetch('/api/vnnox/schedule')
      .then(res => res.json())
      .then(data => setPresets(data.presets || {}))
      .catch(() => {});

    fetch('/api/vnnox/config')
      .then(res => res.json())
      .then(data => {
        if (data.config?.screens) {
          setScreens(data.config.screens);
          if (data.config.defaultPlayerId) {
            setPlayerId(data.config.defaultPlayerId);
          }
        }
      })
      .catch(() => {});
  }, []);

  const handleApply = async (type: 'screen-status' | 'brightness') => {
    if (!playerId) {
      setApplyResult('Selecciona un player primero');
      return;
    }
    if (!selectedPreset) {
      setApplyResult('Selecciona un preset');
      return;
    }

    setApplying(true);
    setApplyResult(null);
    try {
      const res = await fetch('/api/vnnox/schedule', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type, playerId, presetId: selectedPreset }),
      });
      const data = await res.json();
      setApplyResult(data.message || data.error || 'Completado');
    } catch (err) {
      setApplyResult('Error de red');
    } finally {
      setApplying(false);
    }
  };

  const presetIcons: Record<string, any> = {
    dia: Sun,
    noche: Moon,
    fin_de_semana: Calendar,
    festivo: Calendar,
    '24h': Clock,
  };

  return (
    <div className="space-y-6">
      {/* Player selector */}
      <div className="bg-white rounded-xl border shadow-sm p-6">
        <h3 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
          <Monitor className="w-5 h-5 text-blue-500" />
          Player Seleccionado
        </h3>
        <select
          value={playerId}
          onChange={e => setPlayerId(e.target.value)}
          className="w-full md:w-auto rounded-lg border px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500"
        >
          <option value="">Seleccionar player...</option>
          {screens.map(s => (
            <option key={s.playerId} value={s.playerId}>
              {s.playerName || s.playerId} — {s.isOnline ? '🟢' : '🔴'}
            </option>
          ))}
        </select>
      </div>

      {/* Presets */}
      <div className="bg-white rounded-xl border shadow-sm p-6">
        <h3 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
          <Clock className="w-5 h-5 text-indigo-500" />
          Presets de Programación
        </h3>

        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          {Object.entries(presets).map(([key, preset]: [string, any]) => {
            const Icon = presetIcons[key] || Clock;
            return (
              <button
                key={key}
                onClick={() => setSelectedPreset(key)}
                className={`p-4 rounded-xl border-2 transition-all text-center ${
                  selectedPreset === key
                    ? 'border-indigo-500 bg-indigo-50 ring-2 ring-indigo-200'
                    : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                }`}
              >
                <Icon className={`w-6 h-6 mx-auto mb-2 ${
                  selectedPreset === key ? 'text-indigo-600' : 'text-gray-400'
                }`} />
                <p className="text-sm font-medium">{preset.label}</p>
                <p className="text-xs text-gray-400 mt-1">{preset.entries?.length} franjas</p>
              </button>
            );
          })}
        </div>

        {selectedPreset && presets[selectedPreset] && (
          <div className="mt-4 p-4 bg-gray-50 rounded-lg">
            <p className="text-xs font-bold text-gray-400 uppercase mb-2">Detalle del Preset</p>
            <div className="space-y-1">
              {presets[selectedPreset].entries?.map((entry: any, idx: number) => (
                <div key={idx} className="flex items-center gap-4 text-sm">
                  <span className="font-mono text-gray-600">{entry.startTime} — {entry.endTime}</span>
                  <span className={`px-2 py-0.5 rounded text-xs font-bold ${
                    entry.status === 'ON' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-600'
                  }`}>
                    {entry.status || 'ON'}
                  </span>
                  {entry.brightness !== undefined && (
                    <span className="text-xs text-gray-400">Brillo: {entry.brightness}%</span>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Apply */}
      <div className="bg-white rounded-xl border shadow-sm p-6">
        <div className="flex flex-wrap gap-3">
          <button
            onClick={() => handleApply('screen-status')}
            disabled={applying || !playerId || !selectedPreset}
            className="flex items-center gap-2 px-5 py-2.5 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors font-medium text-sm disabled:opacity-50"
          >
            {applying ? <Loader2 className="w-4 h-4 animate-spin" /> : <Monitor className="w-4 h-4" />}
            Aplicar Encendido/Apagado
          </button>
          <button
            onClick={() => handleApply('brightness')}
            disabled={applying || !playerId || !selectedPreset}
            className="flex items-center gap-2 px-5 py-2.5 bg-amber-600 text-white rounded-lg hover:bg-amber-700 transition-colors font-medium text-sm disabled:opacity-50"
          >
            {applying ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sun className="w-4 h-4" />}
            Aplicar Brillo
          </button>
        </div>

        {applyResult && (
          <div className="mt-4 p-3 bg-blue-50 text-blue-700 rounded-lg text-sm">
            {applyResult}
          </div>
        )}
      </div>
    </div>
  );
}
