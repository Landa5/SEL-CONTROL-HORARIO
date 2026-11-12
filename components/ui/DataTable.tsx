'use client';

import React, { useState, useMemo, useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import {
    Search,
    Download,
    FileSpreadsheet,
    ArrowUpDown,
    ArrowUp,
    ArrowDown,
    ChevronLeft,
    ChevronRight,
    X,
    Calendar,
    Inbox
} from 'lucide-react';
import { downloadExcelWorkbook } from '@/lib/excel';

export interface DataTableColumn<T = any> {
    key: string;
    header: string;
    sortable?: boolean;
    align?: 'left' | 'center' | 'right';
    render?: (row: T) => React.ReactNode;
    exportValue?: (row: T) => string | number;
    getValue?: (row: T) => any;
}

export interface DataTableFilter {
    key: string;
    label: string;
    options: { value: string; label: string }[];
}

interface DataTableProps<T = any> {
    data: T[];
    columns: DataTableColumn<T>[];
    rowKey?: (row: T) => string | number;
    searchPlaceholder?: string;
    searchKeys?: string[];
    filters?: DataTableFilter[];
    dateField?: string;
    defaultPageSize?: number;
    exportFilename?: string;
    loading?: boolean;
    emptyMessage?: string;
    onRowClick?: (row: T) => void;
    syncUrl?: boolean;
    headerActions?: React.ReactNode;
}

export function DataTable<T extends Record<string, any>>({
    data,
    columns,
    searchPlaceholder = 'Buscar...',
    searchKeys = [],
    filters = [],
    dateField,
    defaultPageSize = 15,
    exportFilename = 'Exportacion_SEL',
    loading = false,
    emptyMessage = 'No se encontraron registros con los filtros actuales.',
    onRowClick,
    syncUrl = true,
    headerActions
}: DataTableProps<T>) {
    const router = useRouter();
    const pathname = usePathname();

    const [search, setSearch] = useState('');
    const [activeFilters, setActiveFilters] = useState<Record<string, string>>({});
    const [dateFrom, setDateFrom] = useState('');
    const [dateTo, setDateTo] = useState('');
    const [quickRange, setQuickRange] = useState<string>('');
    const [sortKey, setSortKey] = useState<string | null>(null);
    const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');
    const [page, setPage] = useState(1);
    const [pageSize, setPageSize] = useState(defaultPageSize);
    const [urlHydrated, setUrlHydrated] = useState(false);

    // Hydrate filters from URL query string on mount
    useEffect(() => {
        if (!syncUrl || typeof window === 'undefined') {
            setUrlHydrated(true);
            return;
        }
        const sp = new URLSearchParams(window.location.search);
        const qVal = sp.get('q');
        if (qVal) setSearch(qVal);

        const init: Record<string, string> = {};
        filters.forEach(f => {
            const v = sp.get(f.key);
            if (v) init[f.key] = v;
        });
        if (Object.keys(init).length > 0) setActiveFilters(init);

        const fromVal = sp.get('from');
        const toVal = sp.get('to');
        if (fromVal) setDateFrom(fromVal);
        if (toVal) setDateTo(toVal);
        setUrlHydrated(true);
    }, []);

    // Sync state changes to URL query string
    useEffect(() => {
        if (!syncUrl || !pathname || !urlHydrated || typeof window === 'undefined') return;
        const params = new URLSearchParams(window.location.search);
        if (search) params.set('q', search);
        else params.delete('q');

        filters.forEach(f => {
            const val = activeFilters[f.key];
            if (val && val !== 'ALL') params.set(f.key, val);
            else params.delete(f.key);
        });

        if (dateField) {
            if (dateFrom) params.set('from', dateFrom);
            else params.delete('from');
            if (dateTo) params.set('to', dateTo);
            else params.delete('to');
        }

        const qs = params.toString();
        const currentQs = window.location.search.replace(/^\?/, '');
        if (qs !== currentQs) {
            router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
        }
    }, [search, activeFilters, dateFrom, dateTo, urlHydrated]);

    const applyQuickDateRange = (preset: 'TODAY' | 'WEEK' | 'MONTH' | 'PREV_MONTH' | 'YEAR' | 'ALL') => {
        setQuickRange(preset);
        setPage(1);
        const now = new Date();
        const fmt = (d: Date) => d.toISOString().split('T')[0];

        if (preset === 'ALL') {
            setDateFrom('');
            setDateTo('');
            return;
        }
        if (preset === 'TODAY') {
            const s = fmt(now);
            setDateFrom(s);
            setDateTo(s);
            return;
        }
        if (preset === 'WEEK') {
            const day = now.getDay() || 7;
            const monday = new Date(now);
            monday.setDate(now.getDate() - day + 1);
            setDateFrom(fmt(monday));
            setDateTo(fmt(now));
            return;
        }
        if (preset === 'MONTH') {
            const first = new Date(now.getFullYear(), now.getMonth(), 1);
            const last = new Date(now.getFullYear(), now.getMonth() + 1, 0);
            setDateFrom(fmt(first));
            setDateTo(fmt(last));
            return;
        }
        if (preset === 'PREV_MONTH') {
            const first = new Date(now.getFullYear(), now.getMonth() - 1, 1);
            const last = new Date(now.getFullYear(), now.getMonth(), 0);
            setDateFrom(fmt(first));
            setDateTo(fmt(last));
            return;
        }
        if (preset === 'YEAR') {
            const first = new Date(now.getFullYear(), 0, 1);
            const last = new Date(now.getFullYear(), 11, 31);
            setDateFrom(fmt(first));
            setDateTo(fmt(last));
        }
    };

    // Filter + Search + Date Range + Sort
    const processedData = useMemo(() => {
        let list = Array.isArray(data) ? [...data] : [];

        // 1. Text search
        if (search.trim()) {
            const q = search.toLowerCase().trim();
            list = list.filter(row => {
                if (searchKeys.length > 0) {
                    return searchKeys.some(k => {
                        const val = k.split('.').reduce((acc, part) => acc?.[part], row as any);
                        return val !== null && val !== undefined && String(val).toLowerCase().includes(q);
                    });
                }
                return Object.values(row).some(
                    v => v !== null && v !== undefined && String(v).toLowerCase().includes(q)
                );
            });
        }

        // 2. Dropdown filters
        Object.entries(activeFilters).forEach(([k, val]) => {
            if (!val || val === 'ALL') return;
            list = list.filter(row => {
                const raw = k.split('.').reduce((acc, part) => acc?.[part], row as any);
                if (typeof raw === 'boolean') return String(raw) === val;
                return String(raw || '').toUpperCase() === val.toUpperCase();
            });
        });

        // 3. Date range filter
        if (dateField && (dateFrom || dateTo)) {
            const fromTs = dateFrom ? new Date(dateFrom + 'T00:00:00').getTime() : null;
            const toTs = dateTo ? new Date(dateTo + 'T23:59:59').getTime() : null;
            list = list.filter(row => {
                const rawDate = dateField.split('.').reduce((acc, part) => acc?.[part], row as any);
                if (!rawDate) return false;
                const ts = new Date(rawDate).getTime();
                if (fromTs && ts < fromTs) return false;
                if (toTs && ts > toTs) return false;
                return true;
            });
        }

        // 4. Sorting
        if (sortKey) {
            const col = columns.find(c => c.key === sortKey);
            list.sort((a, b) => {
                const valA = col?.getValue
                    ? col.getValue(a)
                    : sortKey.split('.').reduce((acc, part) => acc?.[part], a as any);
                const valB = col?.getValue
                    ? col.getValue(b)
                    : sortKey.split('.').reduce((acc, part) => acc?.[part], b as any);

                if (valA === valB) return 0;
                if (valA === null || valA === undefined) return 1;
                if (valB === null || valB === undefined) return -1;

                if (typeof valA === 'number' && typeof valB === 'number') {
                    return sortDir === 'asc' ? valA - valB : valB - valA;
                }
                return sortDir === 'asc'
                    ? String(valA).localeCompare(String(valB), 'es', { numeric: true })
                    : String(valB).localeCompare(String(valA), 'es', { numeric: true });
            });
        }

        return list;
    }, [data, search, searchKeys, activeFilters, dateField, dateFrom, dateTo, sortKey, sortDir, columns]);

    const totalPages = Math.max(1, Math.ceil(processedData.length / pageSize));
    const currentPage = Math.min(page, totalPages);
    const paginatedData = useMemo(() => {
        const start = (currentPage - 1) * pageSize;
        return processedData.slice(start, start + pageSize);
    }, [processedData, currentPage, pageSize]);

    const handleSort = (key: string) => {
        if (sortKey === key) {
            setSortDir(prev => (prev === 'asc' ? 'desc' : 'asc'));
        } else {
            setSortKey(key);
            setSortDir('asc');
        }
    };

    const clearAllFilters = () => {
        setSearch('');
        setActiveFilters({});
        setDateFrom('');
        setDateTo('');
        setQuickRange('');
        setPage(1);
    };

    const buildExportRows = () => {
        return processedData.map(row => {
            const obj: Record<string, string | number> = {};
            columns.forEach(col => {
                if (col.key === 'actions') return;
                if (col.exportValue) {
                    obj[col.header] = col.exportValue(row);
                } else if (col.getValue) {
                    const v = col.getValue(row);
                    obj[col.header] = v !== null && v !== undefined ? v : '';
                } else {
                    const raw = col.key.split('.').reduce((acc, part) => acc?.[part], row as any);
                    obj[col.header] =
                        typeof raw === 'object' && raw !== null ? JSON.stringify(raw) : (raw ?? '');
                }
            });
            return obj;
        });
    };

    const handleExportExcel = () => {
        const rows = buildExportRows();
        downloadExcelWorkbook(`${exportFilename}.xlsx`, [{ name: 'Datos', rows }]);
    };

    const handleExportCSV = () => {
        const rows = buildExportRows();
        if (rows.length === 0) return;
        const headers = Object.keys(rows[0]);
        const csvLines = [
            headers.join(';'),
            ...rows.map(r =>
                headers
                    .map(h => {
                        const val = String(r[h] ?? '').replace(/"/g, '""');
                        return `"${val}"`;
                    })
                    .join(';')
            )
        ];
        const blob = new Blob(['\uFEFF' + csvLines.join('\n')], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${exportFilename}.csv`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    };

    const hasActiveFilters =
        Boolean(search.trim()) ||
        Object.values(activeFilters).some(v => v && v !== 'ALL') ||
        Boolean(dateFrom) ||
        Boolean(dateTo);

    return (
        <div className="bg-white rounded-xl border border-slate-200 shadow-2xs overflow-hidden">
            {/* Toolbar */}
            <div className="p-4 border-b border-slate-100 bg-slate-50/50 space-y-3">
                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
                    {/* Search + Dropdown Filters */}
                    <div className="flex flex-wrap items-center gap-2 flex-1">
                        <div className="relative min-w-[220px] flex-1 max-w-sm">
                            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                            <input
                                type="text"
                                value={search}
                                onChange={e => {
                                    setSearch(e.target.value);
                                    setPage(1);
                                }}
                                placeholder={searchPlaceholder}
                                className="w-full pl-9 pr-8 py-2 text-xs font-medium bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                            />
                            {search && (
                                <button
                                    onClick={() => {
                                        setSearch('');
                                        setPage(1);
                                    }}
                                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                                >
                                    <X className="w-3.5 h-3.5" />
                                </button>
                            )}
                        </div>

                        {filters.map(f => (
                            <select
                                key={f.key}
                                value={activeFilters[f.key] || 'ALL'}
                                onChange={e => {
                                    setActiveFilters(prev => ({ ...prev, [f.key]: e.target.value }));
                                    setPage(1);
                                }}
                                className="px-3 py-2 text-xs font-semibold bg-white border border-slate-200 rounded-lg text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
                            >
                                <option value="ALL">{f.label}: Todos</option>
                                {f.options.map(opt => (
                                    <option key={opt.value} value={opt.value}>
                                        {opt.label}
                                    </option>
                                ))}
                            </select>
                        ))}

                        {hasActiveFilters && (
                            <button
                                onClick={clearAllFilters}
                                className="px-2.5 py-2 text-xs font-bold text-rose-600 hover:bg-rose-50 rounded-lg transition-colors flex items-center gap-1"
                            >
                                <X className="w-3.5 h-3.5" /> Limpiar filtros
                            </button>
                        )}
                    </div>

                    {/* Export & Custom Actions */}
                    <div className="flex flex-wrap items-center gap-2">
                        <button
                            onClick={handleExportCSV}
                            disabled={processedData.length === 0}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 disabled:opacity-50 transition-colors"
                        >
                            <Download className="w-3.5 h-3.5 text-slate-500" />
                            CSV
                        </button>
                        <button
                            onClick={handleExportExcel}
                            disabled={processedData.length === 0}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold border border-emerald-200 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 disabled:opacity-50 transition-colors"
                        >
                            <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600" />
                            Excel (.xlsx)
                        </button>
                        {headerActions}
                    </div>
                </div>

                {/* Date Range Bar & Quick Presets */}
                {dateField && (
                    <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-200/70">
                        <div className="flex flex-wrap items-center gap-1.5">
                            <span className="text-[11px] font-bold text-slate-500 flex items-center gap-1 mr-1">
                                <Calendar className="w-3.5 h-3.5 text-blue-600" /> Rango rápido:
                            </span>
                            {[
                                { id: 'TODAY', label: 'Hoy' },
                                { id: 'WEEK', label: 'Esta Semana' },
                                { id: 'MONTH', label: 'Este Mes' },
                                { id: 'PREV_MONTH', label: 'Mes Anterior' },
                                { id: 'YEAR', label: 'Este Año' },
                                { id: 'ALL', label: 'Todo' }
                            ].map(p => (
                                <button
                                    key={p.id}
                                    onClick={() => applyQuickDateRange(p.id as any)}
                                    className={`px-2.5 py-1 rounded-md text-[11px] font-bold transition-colors ${
                                        quickRange === p.id
                                            ? 'bg-blue-600 text-white'
                                            : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-100'
                                    }`}
                                >
                                    {p.label}
                                </button>
                            ))}
                        </div>
                        <div className="flex items-center gap-2 text-xs">
                            <input
                                type="date"
                                value={dateFrom}
                                onChange={e => {
                                    setDateFrom(e.target.value);
                                    setQuickRange('');
                                    setPage(1);
                                }}
                                className="px-2 py-1 border border-slate-200 rounded bg-white text-xs text-slate-700"
                            />
                            <span className="text-slate-400">a</span>
                            <input
                                type="date"
                                value={dateTo}
                                onChange={e => {
                                    setDateTo(e.target.value);
                                    setQuickRange('');
                                    setPage(1);
                                }}
                                className="px-2 py-1 border border-slate-200 rounded bg-white text-xs text-slate-700"
                            />
                        </div>
                    </div>
                )}
            </div>

            {/* Table Content */}
            <div className="overflow-x-auto">
                <table className="w-full text-sm text-left">
                    <thead className="bg-slate-50 text-slate-500 text-[11px] uppercase tracking-wider border-b border-slate-200">
                        <tr>
                            {columns.map(col => (
                                <th
                                    key={col.key}
                                    onClick={() => col.sortable && handleSort(col.key)}
                                    className={`px-4 py-3 font-bold select-none ${
                                        col.align === 'right'
                                            ? 'text-right'
                                            : col.align === 'center'
                                            ? 'text-center'
                                            : 'text-left'
                                    } ${col.sortable ? 'cursor-pointer hover:text-slate-900 hover:bg-slate-100/80' : ''}`}
                                >
                                    <span className="inline-flex items-center gap-1">
                                        {col.header}
                                        {col.sortable && (
                                            <span className="text-slate-400">
                                                {sortKey === col.key ? (
                                                    sortDir === 'asc' ? (
                                                        <ArrowUp className="w-3 h-3 text-blue-600" />
                                                    ) : (
                                                        <ArrowDown className="w-3 h-3 text-blue-600" />
                                                    )
                                                ) : (
                                                    <ArrowUpDown className="w-3 h-3 opacity-50" />
                                                )}
                                            </span>
                                        )}
                                    </span>
                                </th>
                            ))}
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                        {loading ? (
                            Array.from({ length: 5 }).map((_, i) => (
                                <tr key={i} className="animate-pulse">
                                    {columns.map(c => (
                                        <td key={c.key} className="px-4 py-3.5">
                                            <div className="h-4 bg-slate-100 rounded w-3/4" />
                                        </td>
                                    ))}
                                </tr>
                            ))
                        ) : paginatedData.length === 0 ? (
                            <tr>
                                <td colSpan={columns.length} className="px-6 py-12 text-center">
                                    <div className="flex flex-col items-center gap-2 text-slate-400">
                                        <Inbox className="w-8 h-8 stroke-1" />
                                        <p className="text-sm font-medium text-slate-500">{emptyMessage}</p>
                                        {hasActiveFilters && (
                                            <button
                                                onClick={clearAllFilters}
                                                className="mt-1 text-xs font-bold text-blue-600 hover:underline"
                                            >
                                                Restablecer todos los filtros
                                            </button>
                                        )}
                                    </div>
                                </td>
                            </tr>
                        ) : (
                            paginatedData.map((row, idx) => (
                                <tr
                                    key={row.id ?? idx}
                                    onClick={() => onRowClick && onRowClick(row)}
                                    className={`transition-colors ${
                                        onRowClick ? 'cursor-pointer hover:bg-blue-50/50' : 'hover:bg-slate-50/80'
                                    }`}
                                >
                                    {columns.map(col => (
                                        <td
                                            key={col.key}
                                            className={`px-4 py-3 ${
                                                col.align === 'right'
                                                    ? 'text-right'
                                                    : col.align === 'center'
                                                    ? 'text-center'
                                                    : 'text-left'
                                            }`}
                                        >
                                            {col.render
                                                ? col.render(row)
                                                : String(
                                                      col.key
                                                          .split('.')
                                                          .reduce((acc, part) => acc?.[part], row as any) ?? '-'
                                                  )}
                                        </td>
                                    ))}
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>

            {/* Pagination Footer */}
            <div className="px-4 py-3 bg-slate-50/70 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-600">
                <div className="flex items-center gap-3">
                    <span>
                        Mostrando{' '}
                        <strong className="text-slate-900">
                            {processedData.length === 0 ? 0 : (currentPage - 1) * pageSize + 1}
                        </strong>{' '}
                        a{' '}
                        <strong className="text-slate-900">
                            {Math.min(currentPage * pageSize, processedData.length)}
                        </strong>{' '}
                        de <strong className="text-slate-900">{processedData.length}</strong> registros
                    </span>
                    <select
                        value={pageSize}
                        onChange={e => {
                            setPageSize(Number(e.target.value));
                            setPage(1);
                        }}
                        className="px-2 py-1 border border-slate-200 rounded bg-white text-xs font-semibold"
                    >
                        {[10, 15, 25, 50, 100].map(sz => (
                            <option key={sz} value={sz}>
                                {sz} / pág.
                            </option>
                        ))}
                    </select>
                </div>

                <div className="flex items-center gap-1.5">
                    <button
                        onClick={() => setPage(p => Math.max(1, p - 1))}
                        disabled={currentPage <= 1}
                        className="p-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-100 disabled:opacity-40"
                    >
                        <ChevronLeft className="w-4 h-4" />
                    </button>
                    <span className="px-3 py-1 font-bold text-slate-700">
                        Página {currentPage} de {totalPages}
                    </span>
                    <button
                        onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                        disabled={currentPage >= totalPages}
                        className="p-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-100 disabled:opacity-40"
                    >
                        <ChevronRight className="w-4 h-4" />
                    </button>
                </div>
            </div>
        </div>
    );
}

export default DataTable;
