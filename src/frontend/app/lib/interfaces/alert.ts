export interface AlertRecord {
  id: string;
  member_id: string;
  member_name?: string | null;
  timestamp: string;
  prediction: string;
  confidence: number;
  acknowledged: boolean;
  acknowledged_at?: string | null;
  acknowledged_by?: string | null;
}

export interface PredictEvent {
  predicted_class?: number;
  predicted_action: string;
  confidence: number;
  alert_id?: string | null;
  should_trigger_alert: boolean;
  member: {
    id: string;
    name: string;
  } | null;
  timestamp?: string;
}

export interface BannerWsMessage {
  alert_id?: string | null;
  predicted_action?: string;
  confidence?: number;
  timestamp?: string;
  should_trigger_alert?: boolean;
  member?: {
    id?: string;
    name?: string;
  };
}