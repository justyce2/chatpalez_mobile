export type ChatPollingOptions = {
  intervalMs?: number;
  isRealtimeConnected: () => boolean;
  getLastMessageId: () => number | string | undefined;
  isOnline?: () => boolean;
  poll: (lastMessageId?: number | string) => Promise<void>;
};

export class ChatPollingController {
  private timer: number | undefined;
  private active = false;
  private pollInFlight = false;

  constructor(private readonly options: ChatPollingOptions) {}

  start(): void {
    this.active = true;
    this.sync();
  }

  stop(): void {
    this.active = false;
    this.clearTimer();
  }

  setRealtimeConnected(connected: boolean): void {
    if (connected) {
      this.clearTimer();
    } else if (this.active) {
      this.sync();
    }
  }

  private sync(): void {
    this.clearTimer();
    if (!this.active || this.options.isRealtimeConnected()) return;

    const intervalMs = Math.max(1000, this.options.intervalMs ?? 3000);
    this.timer = window.setInterval(() => {
      void this.tick();
    }, intervalMs);
  }

  private clearTimer(): void {
    if (this.timer !== undefined) {
      window.clearInterval(this.timer);
      this.timer = undefined;
    }
  }

  private async tick(): Promise<void> {
    if (
      !this.active ||
      this.pollInFlight ||
      this.options.isRealtimeConnected() ||
      this.options.isOnline?.() === false
    ) return;

    this.pollInFlight = true;
    try {
      await this.options.poll(this.options.getLastMessageId());
    } finally {
      this.pollInFlight = false;
    }
  }
}
