import { CONFIG } from "../config.js";

const VALID_VEHICLE_STATES = new Set(["stopped", "parked", "driving"]);

function normalizeVehicleState(value) {
  return VALID_VEHICLE_STATES.has(value) ? value : null;
}

// 실제 데이터 연결 시 이 객체의 함수만 교체하면 각 모드는 수정할 필요가 없습니다.
export const dataService = {
  async getVehicleState() {
    if (!CONFIG.api.useLiveData) {
      return normalizeVehicleState(window.MOOV_VEHICLE_STATE || CONFIG.wellness.mockVehicleState);
    }
    const response = await fetch(`${CONFIG.api.baseUrl}${CONFIG.api.endpoints.vehicleState}`);
    if (!response.ok) throw new Error(`차량 상태 조회 실패: ${response.status}`);
    const payload = await response.json();
    return normalizeVehicleState(payload.vehicle_state);
  },

  subscribeVehicleState(handler) {
    const listener = (event) => handler(normalizeVehicleState(event.detail?.vehicle_state));
    window.addEventListener("moov:vehicle-state", listener);
    return () => window.removeEventListener("moov:vehicle-state", listener);
  },

  async sendVehicleCommand(command, payload = {}) {
    if (!CONFIG.api.useLiveData) {
      return { ok: true, simulated: true, command, payload, at: new Date().toISOString() };
    }
    const response = await fetch(`${CONFIG.api.baseUrl}${CONFIG.api.endpoints.vehicle}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ command, payload })
    });
    if (!response.ok) throw new Error(`차량 제어 실패: ${response.status}`);
    return response.json();
  }
};
