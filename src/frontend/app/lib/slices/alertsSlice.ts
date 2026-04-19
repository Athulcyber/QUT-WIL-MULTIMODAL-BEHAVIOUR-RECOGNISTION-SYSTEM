import { createSlice, PayloadAction } from "@reduxjs/toolkit";
import { RootState } from "../store";

interface AlertState {
  hasActiveAlert: boolean;
  alertId: string;
  memberName: string;
  timestamp: string;
  confidence: number;
  alertsRefreshKey: number;
}

type SetAlertPayload = {
  alertId: string;
  memberName: string;
  timestamp: string;
  confidence: number;
};

const initialState: AlertState = {
  hasActiveAlert: false,
  alertId: "",
  memberName: "",
  timestamp: "",
  confidence: 0,
  alertsRefreshKey: 0,
};

export const alertsSlice = createSlice({
  name: "alerts",
  initialState,
  reducers: {
    setAlert: (state, action: PayloadAction<SetAlertPayload>) => {
      state.hasActiveAlert = true;
      state.alertId = action.payload.alertId;
      state.memberName = action.payload.memberName;
      state.timestamp = action.payload.timestamp;
      state.confidence = action.payload.confidence;
    },
    clearAlert: (state) => {
      state.hasActiveAlert = false;
      state.alertId = "";
      state.memberName = "";
      state.timestamp = "";
      state.confidence = 0;
    },
    bumpAlertsRefreshKey: (state) => {
      state.alertsRefreshKey += 1;
    },
  },
});

export const { setAlert, clearAlert, bumpAlertsRefreshKey } = alertsSlice.actions;

export const selectHasActiveAlert = (state: RootState) =>
  state.alerts.hasActiveAlert;

export const selectActiveAlert = (state: RootState) => state.alerts;

export const selectAlertsRefreshKey = (state: RootState) =>
  state.alerts.alertsRefreshKey;

export default alertsSlice.reducer;