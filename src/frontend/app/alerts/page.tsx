"use client";

import { useEffect, useState } from "react";
import { useAppSelector, useAppDispatch } from "../lib/hooks";
import { clearAlert, bumpAlertsRefreshKey } from "../lib/slices/alertsSlice";
import AccessGuard from "../components/AccessGuard";
import { formatTimestamp } from "@/app/lib/utilities/time";
import type { AlertRecord } from "../lib/interfaces/alert";
import { apiCore } from "../lib/api/core";


export default function AlertsPage() {
  const [alerts, setAlerts] = useState<AlertRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const dispatch = useAppDispatch();
  const accessToken = useAppSelector((state: any) => state.tokens.access_token);

  // Read the active banner's alertId from Redux
  // Only clear banner if the acknowledged alert matches what's currently showing
  const activeAlertId = useAppSelector(
    (state: any) => state.alerts.alertId
  );

  const alertsRefreshKey = useAppSelector(
    (state: any) => state.alerts.alertsRefreshKey
  );

  const loadAlerts = async () => {
    try {
      setError("");
      console.log("Alerts page accessToken:", accessToken);
      console.log("Alerts page token preview:", accessToken?.slice(0, 20));

      const res = await fetch(`${apiCore.url}/alerts`, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });

      console.log("GET /alerts status:", res.status);
      if (!res.ok) throw new Error("Failed to fetch alerts");

      const data = await res.json();
      console.log("GET /alerts response:", data);
      setAlerts(data);
    } catch (err) {
      setError("Failed to load alerts");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (accessToken) {
      setLoading(true);
      loadAlerts();
    }
  }, [accessToken, alertsRefreshKey]);

  const handleAcknowledge = async (id: string) => {
    try {
      console.log("Acknowledging alert id:", id);
      console.log("Acknowledge token preview:", accessToken?.slice(0, 20));

      const res = await fetch(`${apiCore.url}/alerts/${id}/acknowledge`, {
        method: "POST",
        headers: { Authorization: `Bearer ${accessToken}` },
      });

      console.log("POST acknowledge status:", res.status);
      if (!res.ok) throw new Error("Failed to acknowledge alert");

      const data = await res.json();
      console.log("POST acknowledge response:", data);

      // Update local table row
      setAlerts((prev) =>
        prev.map((a) =>
          a.id === id
            ? {
                ...a,
                acknowledged: true,
                acknowledged_at: data.alert.acknowledged_at,
                acknowledged_by: data.alert.acknowledged_by,
              }
            : a
        )
      );

      dispatch(bumpAlertsRefreshKey());

      console.log("activeAlertId:", activeAlertId);
      console.log("clicked alert id:", id);

      // Only clear the banner if this is the same alert currently showing
      if (activeAlertId === id) {
        dispatch(clearAlert());
      }

    } catch {
      setError("Failed to acknowledge alert");
    }
  };

  return (
    <AccessGuard>
      <main className="p-8">
        <h1 className="text-4xl font-bold mb-2">Alerts</h1>
        <p className="text-gray-600 mb-6">All recorded fall alerts</p>

        {error && <div className="mb-4 text-red-600">{error}</div>}
        {loading && <div>Loading alerts...</div>}

        {!loading && (
          <div className="border rounded-xl overflow-hidden">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="text-left p-4">Resident</th>
                  <th className="text-left p-4">Time</th>
                  <th className="text-left p-4">Confidence</th>
                  <th className="text-left p-4">Status</th>
                  <th className="text-left p-4">Action</th>
                </tr>
              </thead>
              <tbody>
                {alerts.map((alert) => (
                  <tr
                    key={alert.id}
                    className={alert.acknowledged ? "bg-white" : "bg-red-50"}
                  >
                    <td className="p-4">{alert.member_name || alert.member_id}</td>
                    <td className="p-4">{formatTimestamp(alert.timestamp)}</td>
                    <td className="p-4">{(alert.confidence * 100).toFixed(1)}%</td>
                    <td className="p-4">
                      {alert.acknowledged ? (
                        <span className="text-green-600 font-medium">Acknowledged</span>
                      ) : (
                        <span className="text-red-600 font-medium">Unacknowledged</span>
                      )}
                    </td>
                    <td className="p-4">
                      {!alert.acknowledged && (
                        <button
                          onClick={() => handleAcknowledge(alert.id)}
                          className="px-3 py-2 rounded bg-black text-white hover:bg-gray-800 transition-colors"
                        >
                          Acknowledge
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
                {alerts.length === 0 && (
                  <tr>
                    <td className="p-4 text-gray-500" colSpan={5}>
                      No alerts found.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </main>
    </AccessGuard>
  );
}