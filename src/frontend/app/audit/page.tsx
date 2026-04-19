"use client";

import { useEffect, useState } from "react";
import { useAppSelector } from "../lib/hooks";
import AccessGuard from "../components/AccessGuard";
import { RootState } from "../lib/store";
import { formatTimestamp } from "@/app/lib/utilities/time";
import { isAdmin, loggedIn } from "../lib/slices/authSlice";
import { apiCore } from "../lib/api/core";

interface AuditLog {
  id: string;
  action: string;
  user_id?: string;
  user_email?: string;
  status?: string;
  timestamp?: string;
  alert_id?: string;
  member_id?: string;
  member_name?: string;
  acknowledged_by?: string;
}

export default function AuditPage() {
  const accessToken = useAppSelector(
    (state: RootState) => state.tokens.access_token
  );
  const isSuperuser = useAppSelector((state: RootState) => isAdmin(state));
  const isLoggedIn = useAppSelector((state: RootState) => loggedIn(state));

  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!accessToken || !isLoggedIn) {
      setLoading(false);
      return;
    }

    if (!isSuperuser) {
      setLoading(false);
      return;
    }

    const loadLogs = async () => {
      try {
        setLoading(true);
        setError(null);

        const response = await fetch(`${apiCore.url}/audit-logs/`, {
          headers: apiCore.headers(accessToken),
        });

        if (response.status === 403) {
          setError("Access denied");
          return;
        }

        if (!response.ok) {
          throw new Error("Failed to load audit logs");
        }

        const data = await response.json();
        setLogs(data);
      } catch (err) {
        setError("Failed to load audit logs");
      } finally {
        setLoading(false);
      }
    };

    loadLogs();
  }, [accessToken, isLoggedIn, isSuperuser]);

  return (
    <AccessGuard requireAdmin>
      {loading ? (
        <div className="p-6">Loading audit logs...</div>
      ) : error ? (
        <div className="p-6 text-red-600">{error}</div>
      ) : (
        <div className="min-h-screen bg-gray-50">
          <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
            <div className="mb-6">
              <h1 className="text-3xl font-bold text-gray-900">Audit Log</h1>
              <p className="mt-2 text-gray-500">
                Security and traceability events for authorized administrators
              </p>
            </div>

            <div className="overflow-hidden rounded-lg border border-gray-200 bg-white">
              <table className="min-w-full text-sm">
                <thead className="bg-gray-100">
                  <tr>
                    <th className="border-b p-3 text-left">Time</th>
                    <th className="border-b p-3 text-left">Action</th>
                    <th className="border-b p-3 text-left">User</th>
                    <th className="border-b p-3 text-left">Status</th>
                    <th className="border-b p-3 text-left">Member</th>
                    <th className="border-b p-3 text-left">Alert ID</th>
                  </tr>
                </thead>
                <tbody>
                  {logs.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="p-4 text-center text-gray-500">
                        No audit logs found
                      </td>
                    </tr>
                  ) : (
                    logs.map((log) => (
                      <tr key={log.id}>
                        <td className="border-b p-3">
                          {log.timestamp ? formatTimestamp(log.timestamp) : "-"}
                        </td>
                        <td className="border-b p-3">{log.action || "-"}</td>
                        <td className="border-b p-3">{log.user_email || "-"}</td>
                        <td className="border-b p-3">{log.status || "-"}</td>
                        <td className="border-b p-3">{log.member_name || "-"}</td>
                        <td className="border-b p-3">{log.alert_id || "-"}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </AccessGuard>
  );
}