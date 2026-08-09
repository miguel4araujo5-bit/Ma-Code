const API_URL = '/api/conquistador/game';
const DEFAULT_POLL_INTERVAL_MS = 700;

function normalizeId(value) {
  return String(value ?? '')
    .replace(/[^A-Za-z0-9_-]/g, '')
    .slice(0, 96);
}

function normalizeRevision(value) {
  const revision = Number(value);

  return Number.isInteger(revision) && revision >= 0
    ? revision
    : null;
}

async function readJsonResponse(response) {
  let data = null;

  try {
    data = await response.json();
  } catch {
    data = null;
  }

  if (!response.ok || !data?.success) {
    const error = new Error(
      data?.message || 'Não foi possível comunicar com a partida online.',
    );

    error.status = response.status;
    error.data = data;

    throw error;
  }

  return data;
}

export class OnlineGameClient {
  constructor({
    matchId,
    playerId,
    pollIntervalMs = DEFAULT_POLL_INTERVAL_MS,
  }) {
    this.matchId = normalizeId(matchId);
    this.playerId = normalizeId(playerId);
    this.pollIntervalMs = Math.max(
      250,
      Number(pollIntervalMs) || DEFAULT_POLL_INTERVAL_MS,
    );

    if (!this.matchId || !this.playerId) {
      throw new Error('A sessão online não possui identificação válida.');
    }

    this.revision = null;
    this.state = null;
    this.pollTimer = null;
    this.polling = false;
    this.closed = false;
    this.listeners = new Set();
    this.errorListeners = new Set();
  }

  async request(payload) {
    const response = await fetch(API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        matchId: this.matchId,
        playerId: this.playerId,
        ...payload,
      }),
    });

    return readJsonResponse(response);
  }

  applyState(data) {
    if (!data?.game) {
      return this.state;
    }

    const revision = normalizeRevision(data.revision);

    if (
      revision !== null &&
      this.revision !== null &&
      revision < this.revision
    ) {
      return this.state;
    }

    this.revision = revision;
    this.state = data;

    for (const listener of this.listeners) {
      try {
        listener(data);
      } catch {
        continue;
      }
    }

    return data;
  }

  notifyError(error) {
    for (const listener of this.errorListeners) {
      try {
        listener(error);
      } catch {
        continue;
      }
    }
  }

  onState(listener) {
    if (typeof listener !== 'function') {
      return () => {};
    }

    this.listeners.add(listener);

    return () => {
      this.listeners.delete(listener);
    };
  }

  onError(listener) {
    if (typeof listener !== 'function') {
      return () => {};
    }

    this.errorListeners.add(listener);

    return () => {
      this.errorListeners.delete(listener);
    };
  }

  async getState() {
    const data = await this.request({
      action: 'state',
      knownRevision: this.revision,
    });

    if (data.status === 'not-modified') {
      return this.state;
    }

    return this.applyState(data);
  }

  async command(type, payload = {}) {
    const commandType = String(type ?? '').trim();

    if (!commandType) {
      throw new Error('A ação online não é válida.');
    }

    try {
      const data = await this.request({
        action: 'command',
        revision: this.revision,
        command: {
          type: commandType,
          payload,
        },
      });

      return this.applyState(data);
    } catch (error) {
      if (error?.status === 409 && error?.data?.game) {
        this.applyState(error.data);
      }

      throw error;
    }
  }

  schedulePoll() {
    if (this.closed || !this.polling) {
      return;
    }

    window.clearTimeout(this.pollTimer);

    this.pollTimer = window.setTimeout(
      () => this.pollOnce(),
      this.pollIntervalMs,
    );
  }

  async pollOnce() {
    if (this.closed || !this.polling) {
      return;
    }

    try {
      await this.getState();
    } catch (error) {
      this.notifyError(error);
    } finally {
      this.schedulePoll();
    }
  }

  async startPolling({ immediate = true } = {}) {
    if (this.closed) {
      return null;
    }

    this.polling = true;

    if (immediate) {
      try {
        return await this.getState();
      } finally {
        this.schedulePoll();
      }
    }

    this.schedulePoll();
    return this.state;
  }

  stopPolling() {
    this.polling = false;

    if (this.pollTimer) {
      window.clearTimeout(this.pollTimer);
      this.pollTimer = null;
    }
  }

  close() {
    this.stopPolling();
    this.closed = true;
    this.listeners.clear();
    this.errorListeners.clear();
  }
}

export default OnlineGameClient;
