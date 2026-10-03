export type AppActivityState = {
  isActive: boolean;
  changedAt: number;
};

let currentState: AppActivityState = {
  isActive: true,
  changedAt: Date.now()
};

export function setAppActivityState(isActive: boolean): AppActivityState {
  currentState = { isActive, changedAt: Date.now() };
  return currentState;
}

export function getAppActivityState(): AppActivityState {
  return currentState;
}
