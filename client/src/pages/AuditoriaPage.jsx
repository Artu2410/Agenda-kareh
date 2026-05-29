import { useCallback, useEffect, useMemo, useState } from 'react';
import { Download, FileText, Filter, RefreshCw, ShieldCheck } from 'lucide-react';
import api from '../services/api';

const formatDateTime = (value) => {
  if (!value) return 'Sin fecha';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Sin fecha';
  return date.toLocaleString('es-AR');
};

const AuditPage = () => {
  const [logs, setLogs] = useState([]);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({
    action: '',
    entityType: '',
    userId: '',
    dateFrom: '',
    dateTo: '',
  });

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      const [logsResponse, usersResponse] = await Promise.all([
        api.get('/audit', { params: { ...filters, limit: 300 } }),
        api.get('/users'),
      ]);

      setLogs(logsResponse.data || []);
      setUsers(usersResponse.data || []);
    } catch {
      return;
    } finally {
      setLoading(false);
    }
  }, [filters]);

  useEffect(() => {
    void fetchData();
  }, [fetchData]);

  const filteredLogs = useMemo(() => logs, [logs]);

  const exportCsv = () => {
    const headers = ['Fecha', 'Usuario', 'Rol', 'Acción', 'Entidad', 'ID Entidad', 'IP'];
    const rows = filteredLogs.map((log) => [
      formatDateTime(log.createdAt),
      log.user?.fullName || log.user?.email || 'Sistema',
      log.user?.role || '',
      log.action || '',
      log.entityType || '',
      log.entityId || '',
      log.ipAddress || '',
    ]);

    const csv = [headers, ...rows]
      .map((row) => row.map((cell) => `"${String(cell ?? '').replace(/"/g, '""')}"`).join(','))
      .join('\n');

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'auditoria-kareh.csv';
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="min-h-full bg-slate-50 p-4 sm:p-8">
      <div className="mx-auto max-w-7xl space-y-6">
        <header className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-[11px] font-black uppercase tracking-[0.28em] text-teal-600">Control</p>
            <h1 className="mt-2 text-3xl font-black text-slate-900">Auditoría médica</h1>
            <p className="mt-1 text-sm font-medium text-slate-500">
              Registro persistente de accesos, cambios clínicos y acciones administrativas.
            </p>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row">
            <button
              type="button"
              onClick={fetchData}
              className="inline-flex min-h-11 items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-2 font-bold text-slate-700"
            >
              <RefreshCw size={16} /> Recargar
            </button>
            <button
              type="button"
              onClick={exportCsv}
              className="inline-flex min-h-11 items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-2 font-bold text-slate-700"
            >
              <Download size={16} /> CSV
            </button>
            <button
              type="button"
              onClick={() => window.print()}
              className="inline-flex min-h-11 items-center justify-center gap-2 rounded-2xl bg-slate-900 px-4 py-2 font-bold text-white"
            >
              <FileText size={16} /> PDF
            </button>
          </div>
        </header>

        <section className="rounded-[2rem] border border-slate-200 bg-white p-4 shadow-sm sm:p-6">
          <div className="mb-4 flex items-center gap-2">
            <Filter size={16} className="text-slate-400" />
            <h2 className="text-sm font-black uppercase tracking-[0.2em] text-slate-500">Filtros</h2>
          </div>
          <div className="grid gap-3 md:grid-cols-5">
            <input
              type="text"
              placeholder="Acción"
              value={filters.action}
              onChange={(event) => setFilters((prev) => ({ ...prev, action: event.target.value }))}
              className="min-h-11 rounded-2xl border border-slate-200 px-4 py-3 text-sm font-semibold outline-none focus:ring-2 focus:ring-teal-200"
            />
            <input
              type="text"
              placeholder="Entidad"
              value={filters.entityType}
              onChange={(event) => setFilters((prev) => ({ ...prev, entityType: event.target.value }))}
              className="min-h-11 rounded-2xl border border-slate-200 px-4 py-3 text-sm font-semibold outline-none focus:ring-2 focus:ring-teal-200"
            />
            <select
              value={filters.userId}
              onChange={(event) => setFilters((prev) => ({ ...prev, userId: event.target.value }))}
              className="min-h-11 rounded-2xl border border-slate-200 px-4 py-3 text-sm font-semibold outline-none focus:ring-2 focus:ring-teal-200"
            >
              <option value="">Todos los usuarios</option>
              {users.map((user) => (
                <option key={user.id} value={user.id}>
                  {user.fullName} · {user.role}
                </option>
              ))}
            </select>
            <input
              type="date"
              value={filters.dateFrom}
              onChange={(event) => setFilters((prev) => ({ ...prev, dateFrom: event.target.value }))}
              className="min-h-11 rounded-2xl border border-slate-200 px-4 py-3 text-sm font-semibold outline-none focus:ring-2 focus:ring-teal-200"
            />
            <input
              type="date"
              value={filters.dateTo}
              onChange={(event) => setFilters((prev) => ({ ...prev, dateTo: event.target.value }))}
              className="min-h-11 rounded-2xl border border-slate-200 px-4 py-3 text-sm font-semibold outline-none focus:ring-2 focus:ring-teal-200"
            />
          </div>
          <div className="mt-4">
            <button
              type="button"
              onClick={fetchData}
              className="inline-flex min-h-11 items-center justify-center rounded-2xl bg-teal-600 px-4 py-2 font-bold text-white"
            >
              Aplicar filtros
            </button>
          </div>
        </section>

        <section className="rounded-[2rem] border border-slate-200 bg-white shadow-sm">
          {loading ? (
            <div className="p-10 text-center text-sm font-semibold text-slate-400">Cargando auditoría...</div>
          ) : filteredLogs.length === 0 ? (
            <div className="p-10 text-center">
              <ShieldCheck className="mx-auto mb-3 text-slate-300" size={40} />
              <p className="text-sm font-bold text-slate-500">No hay registros para esos filtros.</p>
            </div>
          ) : (
            <>
              <div className="hidden overflow-x-auto lg:block">
                <table className="w-full text-left">
                  <thead className="border-b border-slate-200 bg-slate-50 text-[11px] font-black uppercase tracking-[0.2em] text-slate-500">
                    <tr>
                      <th className="px-6 py-4">Fecha</th>
                      <th className="px-6 py-4">Usuario</th>
                      <th className="px-6 py-4">Acción</th>
                      <th className="px-6 py-4">Entidad</th>
                      <th className="px-6 py-4">Entidad ID</th>
                      <th className="px-6 py-4">IP</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-sm">
                    {filteredLogs.map((log) => (
                      <tr key={log.id} className="hover:bg-slate-50">
                        <td className="px-6 py-4 font-semibold text-slate-600">{formatDateTime(log.createdAt)}</td>
                        <td className="px-6 py-4">
                          <div className="font-bold text-slate-800">{log.user?.fullName || 'Sistema'}</div>
                          <div className="text-xs text-slate-400">{log.user?.role || 'N/A'}</div>
                        </td>
                        <td className="px-6 py-4 font-black text-teal-700">{log.action}</td>
                        <td className="px-6 py-4 font-semibold text-slate-700">{log.entityType}</td>
                        <td className="px-6 py-4 text-slate-500">{log.entityId || '—'}</td>
                        <td className="px-6 py-4 text-slate-500">{log.ipAddress || '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="space-y-4 p-4 lg:hidden">
                {filteredLogs.map((log) => (
                  <article key={log.id} className="rounded-[1.75rem] border border-slate-200 bg-white p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-xs font-black uppercase tracking-[0.2em] text-teal-600">{log.action}</p>
                        <h3 className="mt-1 text-sm font-bold text-slate-800">{log.entityType}</h3>
                        <p className="mt-1 text-xs text-slate-500">{log.user?.fullName || 'Sistema'} · {log.user?.role || 'N/A'}</p>
                      </div>
                      <span className="rounded-full bg-slate-100 px-3 py-1 text-[10px] font-black uppercase text-slate-500">
                        {log.entityId || 'sin id'}
                      </span>
                    </div>
                    <p className="mt-3 text-sm font-semibold text-slate-600">{formatDateTime(log.createdAt)}</p>
                    <p className="mt-1 text-xs text-slate-400">IP: {log.ipAddress || '—'}</p>
                  </article>
                ))}
              </div>
            </>
          )}
        </section>
      </div>
    </div>
  );
};

export default AuditPage;
