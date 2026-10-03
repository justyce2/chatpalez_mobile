export type ResyncTask = () => Promise<void>;

export class CoalescedResync {
  private running = false;
  private queued = false;

  constructor(private readonly task: ResyncTask) {}

  async request(): Promise<void> {
    if (this.running) {
      this.queued = true;
      return;
    }

    this.running = true;
    try {
      do {
        this.queued = false;
        await this.task();
      } while (this.queued);
    } finally {
      this.running = false;
    }
  }

  get isRunning(): boolean {
    return this.running;
  }
}
