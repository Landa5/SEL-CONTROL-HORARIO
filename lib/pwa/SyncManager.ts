export interface SyncItem {
    id: string;
    url: string;
    method: string;
    body: any;
    timestamp: number;
}

const SYNC_QUEUE_KEY = 'offline_sync_queue';

class SyncManager {
    static getQueue(): SyncItem[] {
        if (typeof window === 'undefined') return [];
        const raw = localStorage.getItem(SYNC_QUEUE_KEY);
        return raw ? JSON.parse(raw) : [];
    }

    static saveQueue(queue: SyncItem[]) {
        if (typeof window === 'undefined') return;
        localStorage.setItem(SYNC_QUEUE_KEY, JSON.stringify(queue));
    }

    static enqueue(url: string, method: string, body: any) {
        const queue = this.getQueue();
        const item: SyncItem = {
            id: crypto.randomUUID(),
            url,
            method,
            body,
            timestamp: Date.now()
        };
        queue.push(item);
        this.saveQueue(queue);
        console.log(`[SyncManager] Enqueued offline action: ${method} ${url}`);
        return item;
    }

    static async sync() {
        if (typeof window === 'undefined' || !navigator.onLine) return;

        const queue = this.getQueue();
        if (queue.length === 0) return;

        console.log(`[SyncManager] Syncing ${queue.length} items...`);

        const failedQueue: SyncItem[] = [];

        for (const item of queue) {
            try {
                const res = await fetch(item.url, {
                    method: item.method,
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(item.body)
                });

                if (!res.ok) {
                    console.warn(`[SyncManager] Failed to sync item ${item.id} (${res.status}). Keeping in queue.`);
                    // If 4xx (client error), maybe discard? For now, keep it unless strict validation fails.
                    // If 5xx or network error, definitely keep.
                    if (res.status >= 400 && res.status < 500) {
                        // Discard invalid requests to avoid infinite loops
                        console.error(`[SyncManager] Discarding invalid request ${item.id}`);
                    } else {
                        failedQueue.push(item);
                    }
                } else {
                    console.log(`[SyncManager] Successfully synced item ${item.id}`);
                }
            } catch (error) {
                console.error(`[SyncManager] Network error processing item ${item.id}`, error);
                failedQueue.push(item);
            }
        }

        this.saveQueue(failedQueue);
    }

    static hasPendingItems(): boolean {
        return this.getQueue().length > 0;
    }
}

export default SyncManager;
