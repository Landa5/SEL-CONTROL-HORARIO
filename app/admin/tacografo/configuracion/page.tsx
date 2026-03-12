'use client';

import React, { useState, useEffect } from 'react';
import { Settings, Save, FolderOpen, RefreshCw, CheckCircle } from 'lucide-react';

interface ConfigItem {
  key: string;
  value: string;
  label: string;
}

const CONFIG_DESCRIPTIONS: Record<string, string> = {
  input_folder: 'Ruta local de la carpeta desde donde se escanean automáticamente archivos de tacógrafo.',
  processed_folder: 'Carpeta donde se mueven los archivos procesados correctamente.',
  error_folder: 'Carpeta donde se mueven los archivos con errores.',
  allowed_extensions: 'Extensiones de archivo permitidas, separadas por comas.',
  timezone: 'Zona horaria para interpretación de horas del tacógrafo.',
  dedup_strategy: 'Estrategia de deduplicación de archivos (hash = por contenido, filename = por nombre).',
  keep_original_files: 'Conservar archivos originales tras la importación (true/false).',
  reprocess_policy: 'Política de reprocesado (manual = solo bajo demanda, auto = automático).',
};

export default function ConfiguracionPage() {
  const [configs, setConfigs] = useState<ConfigItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [scanResult, setScanResult] = useState<any>(null);
  const [saved, setSaved] = useState(false);
  const [modified, setModified] = useState<Record<string, string>>({});

  const fetchConfig = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/tacografo/config');
      if (res.ok) setConfigs(await res.json());
    } catch (e) { console.error(e); }
    setLoading(false);
  };

  useEffect(() => { fetchConfig(); }, []);

  const handleChange = (key: string, value: string) => {
    setModified(prev => ({ ...prev, [key]: value }));
    setSaved(false);
  };

  const getValue = (key: string): string => {
    return modified[key] !== undefined ? modified[key] : (configs.find(c => c.key === key)?.value || '');
  };

  const saveConfig = async () => {
    setSaving(true);
    try {
      const configsToSave = configs.map(c => ({
        key: c.key,
        value: modified[c.key] !== undefined ? modified[c.key] : c.value,
        label: c.label,
      }));
      const res = await fetch('/api/tacografo/config', {
        method: 'PUT', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ configs: configsToSave })
      });
      if (res.ok) {
        setConfigs(await res.json());
        setModified({});
        setSaved(true);
        setTimeout(() => setSaved(false), 3000);
      }
    } catch (e) { console.error(e); }
    setSaving(false);
  };

  const scanFolder = async () => {
    setScanning(true);
    setScanResult(null);
    try {
      const res = await fetch('/api/tacografo/scan-folder', { method: 'POST' });
      if (res.ok) setScanResult(await res.json());
    } catch (e) { console.error(e); }
    setScanning(false);
  };

  const hasChanges = Object.keys(modified).length > 0;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-gradient-to-br from-gray-600 to-gray-800 rounded-xl shadow-lg">
            <Settings className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Configuración</h1>
            <p className="text-sm text-gray-500">Ajustes del módulo de tacógrafo digital</p>
          </div>
        </div>
        <div className="flex gap-2">
          {saved && (
            <span className="flex items-center gap-1.5 text-green-600 text-sm font-medium animate-pulse">
              <CheckCircle className="w-4 h-4" />Guardado
            </span>
          )}
          <button onClick={saveConfig} disabled={saving || !hasChanges}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50 shadow transition-colors">
            {saving ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            Guardar cambios
          </button>
        </div>
      </div>

      {/* Config Form */}
      <div className="bg-white rounded-xl border shadow-sm">
        {loading ? (
          <div className="flex items-center justify-center h-32"><div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div></div>
        ) : (
          <div className="divide-y">
            {configs.map((config) => (
              <div key={config.key} className="px-6 py-5 flex items-start gap-6">
                <div className="flex-1 min-w-0">
                  <label className="font-bold text-gray-900 text-sm">{config.label || config.key}</label>
                  <p className="text-xs text-gray-500 mt-0.5">{CONFIG_DESCRIPTIONS[config.key] || config.key}</p>
                </div>
                <div className="w-80 shrink-0">
                  {config.key.includes('folder') ? (
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={getValue(config.key)}
                        onChange={(e) => handleChange(config.key, e.target.value)}
                        placeholder="/ruta/a/carpeta"
                        className="flex-1 px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      />
                      <button className="p-2 border rounded-lg hover:bg-gray-50" title="Explorar">
                        <FolderOpen className="w-4 h-4 text-gray-500" />
                      </button>
                    </div>
                  ) : config.key === 'keep_original_files' ? (
                    <select
                      value={getValue(config.key)}
                      onChange={(e) => handleChange(config.key, e.target.value)}
                      className="w-full px-3 py-2 border rounded-lg text-sm"
                    >
                      <option value="true">Sí</option>
                      <option value="false">No</option>
                    </select>
                  ) : config.key === 'dedup_strategy' ? (
                    <select
                      value={getValue(config.key)}
                      onChange={(e) => handleChange(config.key, e.target.value)}
                      className="w-full px-3 py-2 border rounded-lg text-sm"
                    >
                      <option value="hash">Hash (contenido)</option>
                      <option value="filename">Nombre de archivo</option>
                    </select>
                  ) : config.key === 'reprocess_policy' ? (
                    <select
                      value={getValue(config.key)}
                      onChange={(e) => handleChange(config.key, e.target.value)}
                      className="w-full px-3 py-2 border rounded-lg text-sm"
                    >
                      <option value="manual">Manual</option>
                      <option value="auto">Automático</option>
                    </select>
                  ) : (
                    <input
                      type="text"
                      value={getValue(config.key)}
                      onChange={(e) => handleChange(config.key, e.target.value)}
                      className="w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    />
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Scan Folder */}
      <div className="bg-white rounded-xl border shadow-sm p-6">
        <h2 className="text-lg font-bold text-gray-900 mb-4">Escaneo de Carpeta</h2>
        <p className="text-sm text-gray-500 mb-4">
          Escanea la carpeta de entrada configurada para buscar nuevos archivos de tacógrafo y procesarlos automáticamente.
        </p>
        <button onClick={scanFolder} disabled={scanning}
          className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 disabled:opacity-50 shadow transition-colors">
          {scanning ? <RefreshCw className="w-4 h-4 animate-spin" /> : <FolderOpen className="w-4 h-4" />}
          {scanning ? 'Escaneando...' : 'Escanear ahora'}
        </button>

        {scanResult && (
          <div className="mt-4 p-4 bg-gray-50 rounded-lg border">
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div><span className="text-gray-500">Archivos encontrados:</span> <span className="font-bold">{scanResult.found}</span></div>
              <div><span className="text-gray-500">Procesados:</span> <span className="font-bold text-green-700">{scanResult.processed}</span></div>
            </div>
            {scanResult.errors?.length > 0 && (
              <div className="mt-3 space-y-1">
                {scanResult.errors.map((err: string, i: number) => (
                  <p key={i} className="text-xs text-red-600 bg-red-50 px-3 py-1.5 rounded">{err}</p>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
