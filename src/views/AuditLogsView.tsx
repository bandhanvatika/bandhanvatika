import React, { useState, useEffect } from 'react';
import { apiRequest } from '../api/client.ts';
import { AuditLog } from '../types/index.ts';
import { History, Search, Shield, Filter } from 'lucide-react';

export const AuditLogsView: React.FC = () => {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  useEffect(() => {
    const fetchLogs = async () => {
      setLoading(true);
      const res = await apiRequest<AuditLog[]>('/audit-logs');
      if (res.success && res.data) setLogs(res.data);
      setLoading(false);
    };
    fetchLogs();
  }, []);

  const filtered = logs.filter((l) => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return (
      l.action.toLowerCase().includes(q) ||
      l.userName.toLowerCase().includes(q) ||
      l.entity.toLowerCase().includes(q) ||
      (l.details && l.details.toLowerCase().includes(q))
    );
  });

  return (
    <div className="space-y-5 animate-in fade-in duration-300">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-5 rounded-3xl bg-white border border-stone-200/80 shadow-xs">
        <div>
          <h2 className="text-xl font-bold font-brand text-[#14281D]">System Audit Trail</h2>
          <p className="text-xs text-stone-500 mt-0.5">
            Immutable log of all user activities, status changes, and financial postings
          </p>
        </div>

        <div className="relative">
          <Search className="w-3.5 h-3.5 text-stone-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search action or user..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-8 pr-3 py-2 bg-stone-50 border border-stone-200 rounded-xl text-xs outline-none focus:border-[#C5A059] w-64"
          />
        </div>
      </div>

      <div className="p-5 rounded-3xl bg-white border border-stone-200/80 shadow-xs overflow-hidden">
        {loading ? (
          <div className="py-12 text-center text-xs text-stone-400 font-semibold">
            Loading immutable audit records...
          </div>
        ) : filtered.length === 0 ? (
          <div className="py-12 text-center text-xs text-stone-400 font-semibold">
            No audit records found.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-stone-200 text-stone-400 font-bold uppercase tracking-wider text-[10px]">
                  <th className="py-3 px-3">Timestamp</th>
                  <th className="py-3 px-3">User</th>
                  <th className="py-3 px-3">Role</th>
                  <th className="py-3 px-3">Action</th>
                  <th className="py-3 px-3">Entity</th>
                  <th className="py-3 px-3">Details</th>
                  <th className="py-3 px-3">IP Address</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100">
                {filtered.map((l) => (
                  <tr key={l.id} className="hover:bg-stone-50/80 transition-colors">
                    <td className="py-3 px-3 text-stone-500 font-mono text-[11px] whitespace-nowrap">
                      {new Date(l.createdAt).toLocaleString('en-IN')}
                    </td>
                    <td className="py-3 px-3 font-bold text-stone-900">{l.userName}</td>
                    <td className="py-3 px-3">
                      <span className="inline-block px-1.5 py-0.5 rounded text-[9px] font-bold uppercase bg-stone-100 text-stone-700">
                        {l.userRole}
                      </span>
                    </td>
                    <td className="py-3 px-3">
                      <span className="inline-block px-2 py-0.5 rounded-md font-mono text-[10px] font-bold bg-[#14281D]/5 text-[#14281D]">
                        {l.action}
                      </span>
                    </td>
                    <td className="py-3 px-3 text-stone-600 font-medium">{l.entity}</td>
                    <td className="py-3 px-3 text-stone-700 max-w-xs truncate" title={l.details || ''}>
                      {l.details || '—'}
                    </td>
                    <td className="py-3 px-3 text-stone-400 font-mono text-[10px]">{l.ipAddress || '127.0.0.1'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
