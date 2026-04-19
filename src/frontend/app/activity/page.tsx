"use client";

import { useState, useEffect, useRef, Suspense } from "react";
import { useAppDispatch, useAppSelector } from "../lib/hooks";
import { addNotice } from "../lib/slices/toastsSlice";
import { setAlert } from "../lib/slices/alertsSlice";
import AccessGuard from "../components/AccessGuard";
import { Button } from "../components/ui/button";
import { Card, CardContent } from "../components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "../components/ui/table";
import { UserIcon } from "../components/ui/icons";
import { formatTimestamp } from "@/app/lib/utilities/time";
import type { PredictEvent } from "../lib/interfaces/alert";
import { activityWebSocketUrl } from "../lib/api/core";

function dotColor(connected: boolean): string {
  return connected ? "bg-green-500" : "bg-red-500";
}

function confidenceBarColor(confidence: number): string {
  if (confidence >= 0.8) return "bg-green-500";
  if (confidence >= 0.5) return "bg-yellow-500";
  return "bg-red-500";
}

function getDetectionState(message: PredictEvent): {
  label: string;
  className: string;
} {
  if (message.predicted_action === "fall" && message.should_trigger_alert) {
    return {
      label: "FALL DETECTED",
      className: "bg-red-100 text-red-700",
    };
  }

  if (message.predicted_action === "fall" && !message.should_trigger_alert) {
    return {
      label: "LOW CONFIDENCE FALL",
      className: "bg-yellow-100 text-yellow-700",
    };
  }

  return {
    label: "NO FALL",
    className: "bg-green-100 text-green-700",
  };
}

function UnsuspendedActivityPage() {
  const [messages, setMessages] = useState<PredictEvent[]>([]);
  const [isConnected, setIsConnected] = useState(false);
  const [isReconnecting, setIsReconnecting] = useState(false);
  const [retryCount, setRetryCount] = useState(0);
  const [connectionError, setConnectionError] = useState<string | null>(null);

  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const isUnmountingRef = useRef(false);
  const reconnectingRef = useRef(false);

  const maxRetries = 5;

  const dispatch = useAppDispatch();
  const accessToken = useAppSelector((state: any) => state.tokens.access_token);

  const connectWebSocket = () => {
    if (!accessToken) return;

    const wsUrl = activityWebSocketUrl(accessToken);

    if (
      wsRef.current?.readyState === WebSocket.OPEN ||
      wsRef.current?.readyState === WebSocket.CONNECTING
    ) {
      return;
    }

    try {
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        if (reconnectTimeoutRef.current) {
          clearTimeout(reconnectTimeoutRef.current);
        }

        reconnectingRef.current = false;
        setIsConnected(true);
        setIsReconnecting(false);
        setRetryCount(0);
        setConnectionError(null);

        dispatch(
          addNotice({
            title: "Connected",
            content: "WebSocket connection established",
          })
        );
      };

      ws.onmessage = (event) => {
        if (isUnmountingRef.current) return;

        try {
          const data: PredictEvent = JSON.parse(event.data);

          // Ignore keepalive ping
          if ((data as any).type === "ping") return;

          const timestamped = {
            ...data,
            timestamp: data.timestamp || new Date().toISOString(),
          };

          setMessages((prev) => [timestamped, ...prev]);

          if (data.should_trigger_alert && data.alert_id && data.member) {
            dispatch(
              setAlert({
                alertId: data.alert_id,
                memberName: data.member.name,
                timestamp: data.timestamp || timestamped.timestamp,
                confidence: data.confidence,
              })
            );
          }
        } catch (e) {
          console.error("Failed to parse message:", e);
        }
      };

      ws.onerror = () => {
        setIsConnected(false);
      };

      ws.onclose = () => {
        if (isUnmountingRef.current) return;
        setIsConnected(false);

        if (reconnectingRef.current) return;
        reconnectingRef.current = true;

        setRetryCount((prev) => {
          const nextRetry = prev + 1;

          if (nextRetry <= maxRetries) {
            setIsReconnecting(true);
            setConnectionError(`Reconnecting... attempt ${nextRetry} of ${maxRetries}`);

            reconnectTimeoutRef.current = setTimeout(() => {
              reconnectingRef.current = false;
              connectWebSocket();
            }, 3000);
          } else {
            reconnectingRef.current = false;
            setIsReconnecting(false);
            setConnectionError("Connection failed - please refresh or retry.");
          }

          return nextRetry;
        });
      };
    } catch (e) {
      console.error("Failed to create WebSocket:", e);
    }
  };

  useEffect(() => {
    if (!accessToken) return;

    isUnmountingRef.current = false;

    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }

    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }

    setRetryCount(0);
    setIsReconnecting(false);
    setConnectionError(null);

    const timeout = setTimeout(() => {
      connectWebSocket();
    }, 100);

    return () => clearTimeout(timeout);
  }, [accessToken]);

  useEffect(() => {
    return () => {
      isUnmountingRef.current = true;

      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
        reconnectTimeoutRef.current = null;
      }

      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }
    };
  }, []);

  const clearMessages = () => setMessages([]);

  const handleRetryConnection = () => {
    reconnectingRef.current = false;
    setRetryCount(0);
    setConnectionError(null);
    setIsReconnecting(false);
    connectWebSocket();
  };

  return (
    <AccessGuard>
      <div className="min-h-screen bg-gray-50">
        <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
          <div className="mb-8 flex items-start justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Activity Monitor</h1>
              <p className="mt-2 text-gray-500">Real-time fall detection monitoring</p>
            </div>
            <div className="flex items-center gap-3">
              <div className="flex items-center rounded-lg border border-gray-200 bg-white px-3 py-2">
                <span
                  className={`inline-block h-2.5 w-2.5 rounded-full ${dotColor(isConnected)}`}
                />
                <span className="ml-2 text-sm font-medium text-gray-700">
                  {isConnected
                    ? "Connected"
                    : isReconnecting
                      ? `Reconnecting (${retryCount}/${maxRetries})`
                      : "Disconnected"}
                </span>
              </div>

              {connectionError && (
                <span className="text-sm text-red-600">{connectionError}</span>
              )}

              {!isConnected && !isReconnecting && (
                <Button onClick={handleRetryConnection} variant="outline" className="bg-white">
                  Retry
                </Button>
              )}

              <Button onClick={clearMessages} variant="outline" className="bg-white">
                Clear
              </Button>
            </div>
          </div>

          <div className="mb-8 grid gap-6 md:grid-cols-2">
            <Card>
              <CardContent className="flex items-center p-6">
                <div className="rounded-lg bg-blue-50 p-3">
                  <UserIcon className="h-8 w-8 text-blue-600" />
                </div>
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-500">Total Activities</p>
                  <p className="text-2xl font-bold text-gray-900">{messages.length}</p>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="flex items-center p-6">
                <div className="rounded-lg bg-green-50 p-3">
                  <div className={`h-3 w-3 rounded-full ${dotColor(isConnected)}`} />
                </div>
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-500">Connection Status</p>
                  <p className="text-2xl font-bold text-gray-900">
                    {isConnected ? "Active" : isReconnecting ? "Reconnecting" : "Inactive"}
                  </p>
                </div>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardContent className="p-6">
              <div className="mb-6">
                <h2 className="text-xl font-semibold text-gray-900">Activity Feed</h2>
                <p className="text-sm text-gray-500">Live stream of detected activities</p>
              </div>

              <div className="overflow-hidden rounded-lg border border-gray-200">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Time</TableHead>
                      <TableHead>Member Name</TableHead>
                      <TableHead>Detection Result</TableHead>
                      <TableHead>Confidence</TableHead>
                    </TableRow>
                  </TableHeader>

                  <TableBody>
                    {messages.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={4} className="text-center text-gray-500">
                          No activities detected yet. Waiting for real-time data...
                        </TableCell>
                      </TableRow>
                    ) : (
                      messages.map((message, index) => {
                        const isAlert = message.should_trigger_alert === true;
                        const badge = getDetectionState(message);

                        return (
                          <TableRow
                            key={index}
                            className={isAlert ? "bg-red-50 border-l-4 border-red-500" : ""}
                          >
                            <TableCell className="font-medium">
                              {message.timestamp ? formatTimestamp(message.timestamp) : "-"}
                            </TableCell>

                            <TableCell>{message.member?.name || "Unknown"}</TableCell>

                            <TableCell>
                              <span
                                className={`inline-flex items-center rounded-full px-3 py-1 text-sm font-bold ${badge.className}`}
                              >
                                {badge.label}
                              </span>
                            </TableCell>

                            <TableCell>
                              <div className="flex items-center gap-2">
                                <div className="h-2 w-24 overflow-hidden rounded-full bg-gray-200">
                                  <div
                                    className={`h-full ${confidenceBarColor(message.confidence)}`}
                                    style={{ width: `${message.confidence * 100}%` }}
                                  />
                                </div>
                                <span className="text-sm font-medium text-gray-700">
                                  {(message.confidence * 100).toFixed(1)}%
                                </span>
                              </div>
                            </TableCell>
                          </TableRow>
                        );
                      })
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </AccessGuard>
  );
}

export default function ActivityPage() {
  return (
    <Suspense>
      <UnsuspendedActivityPage />
    </Suspense>
  );
}