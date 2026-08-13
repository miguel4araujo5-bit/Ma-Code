(() => {
  'use strict';

  const GAME_API_PATH =
    '/api/conquistador/game';

  const STORED_SESSION_KEY =
    'conquistador-online-session-v1';

  const originalFetch =
    window.fetch.bind(
      window,
    );

  const originalAddEventListener =
    WebSocket.prototype.addEventListener;

  const originalRemoveEventListener =
    WebSocket.prototype.removeEventListener;

  const listenerWrappers =
    new WeakMap();

  let latestGameData =
    null;

  let endingSession =
    false;

  let observer =
    null;

  function isRecord(value) {
    return Boolean(
      value &&
      typeof value ===
        'object' &&
      !Array.isArray(
        value,
      ),
    );
  }

  function getRequestUrl(input) {
    if (
      input instanceof Request
    ) {
      return input.url;
    }

    if (
      input instanceof URL
    ) {
      return input.href;
    }

    return String(
      input || '',
    );
  }

  function isGameApiUrl(value) {
    try {
      return (
        new URL(
          String(
            value || '',
          ),
          window.location.href,
        ).pathname ===
        GAME_API_PATH
      );
    } catch {
      return false;
    }
  }

  function normalizeId(value) {
    return String(
      value ?? '',
    )
      .replace(
        /[^A-Za-z0-9_-]/g,
        '',
      )
      .slice(
        0,
        96,
      );
  }

  function getDiscardActorId(game) {
    const event =
      isRecord(
        game?.sevenEvent,
      )
        ? game.sevenEvent
        : null;

    if (
      !event ||
      event.step !==
        'discard'
    ) {
      return '';
    }

    const queue =
      Array.isArray(
        event.discardQueue,
      )
        ? event.discardQueue
        : [];

    const index =
      Math.max(
        0,
        Number(
          event.discardIndex,
        ) || 0,
      );

    return normalizeId(
      queue[index]
        ?.playerId,
    );
  }

  function getActiveActorId(data) {
    const game =
      isRecord(
        data?.game,
      )
        ? data.game
        : null;

    if (!game) {
      return '';
    }

    const players =
      Array.isArray(
        game.players,
      )
        ? game.players
        : [];

    const timer =
      isRecord(
        data?.turnTimer,
      )
        ? data.turnTimer
        : null;

    const timedActorId =
      normalizeId(
        timer?.actorId,
      );

    if (
      timedActorId &&
      players.some(
        player =>
          normalizeId(
            player?.id,
          ) ===
          timedActorId,
      )
    ) {
      return timedActorId;
    }

    const discardActorId =
      getDiscardActorId(
        game,
      );

    if (
      discardActorId &&
      players.some(
        player =>
          normalizeId(
            player?.id,
          ) ===
          discardActorId,
      )
    ) {
      return discardActorId;
    }

    return normalizeId(
      game.currentPlayerId,
    );
  }

  function getActiveActor(data) {
    const game =
      isRecord(
        data?.game,
      )
        ? data.game
        : null;

    if (!game) {
      return null;
    }

    const actorId =
      getActiveActorId(
        data,
      );

    if (!actorId) {
      return null;
    }

    const players =
      Array.isArray(
        game.players,
      )
        ? game.players
        : [];

    return (
      players.find(
        player =>
          normalizeId(
            player?.id,
          ) === actorId,
      ) || null
    );
  }

  function setTextIfDifferent(
    element,
    value,
  ) {
    if (!element) {
      return;
    }

    const nextValue =
      String(
        value ?? '',
      );

    if (
      element.textContent !==
      nextValue
    ) {
      element.textContent =
        nextValue;
    }
  }

  function syncTurnPresentation() {
    const data =
      latestGameData;

    if (
      !data ||
      !isRecord(
        data.game,
      )
    ) {
      return;
    }

    const actor =
      getActiveActor(
        data,
      );

    if (!actor) {
      return;
    }

    const actorId =
      normalizeId(
        actor.id,
      );

    const banner =
      document.querySelector(
        '.turn-banner',
      );

    if (banner) {
      const color =
        String(
          actor.color || '',
        );

      if (
        color &&
        banner.style
          .getPropertyValue(
            '--player-color',
          ) !== color
      ) {
        banner.style
          .setProperty(
            '--player-color',
            color,
          );
      }

      setTextIfDifferent(
        banner.querySelector(
          '.turn-player-symbol',
        ),
        actor.symbol || '',
      );

      setTextIfDifferent(
        banner.querySelector(
          '.turn-copy strong',
        ),
        actor.name ||
          'Jogador',
      );
    }

    const gamePlayers =
      Array.isArray(
        data.game.players,
      )
        ? data.game.players
        : [];

    const summaries =
      Array.from(
        document.querySelectorAll(
          '.players-list .player-summary',
        ),
      );

    summaries.forEach(
      (summary, index) => {
        const playerId =
          normalizeId(
            gamePlayers[index]
              ?.id,
          );

        const shouldBeActive =
          playerId ===
          actorId;

        if (
          summary.classList
            .contains(
              'is-active',
            ) !==
          shouldBeActive
        ) {
          summary.classList
            .toggle(
              'is-active',
              shouldBeActive,
            );
        }
      },
    );

    const instruction =
      document.querySelector(
        '.action-buttons .instruction-card',
      );

    const instructionTitle =
      instruction?.querySelector(
        'strong',
      );

    if (
      instruction &&
      instructionTitle
        ?.textContent
        ?.trim() ===
        'Aguarde a sua vez'
    ) {
      const copy =
        instruction.querySelector(
          'span',
        );

      setTextIfDifferent(
        copy,
        `${actor.name || 'Outro jogador'} está a jogar. O tabuleiro é atualizado automaticamente.`,
      );
    }
  }

  function scheduleTurnPresentation() {
    window.requestAnimationFrame(
      () => {
        syncTurnPresentation();
      },
    );
  }

  function captureGameData(data) {
    if (!isRecord(data)) {
      return;
    }

    if (
      isRecord(
        data.game,
      )
    ) {
      latestGameData =
        data;

      scheduleTurnPresentation();
      return;
    }

    if (
      latestGameData &&
      Object.prototype
        .hasOwnProperty.call(
          data,
          'turnTimer',
        )
    ) {
      latestGameData = {
        ...latestGameData,
        turnTimer:
          data.turnTimer,
      };

      scheduleTurnPresentation();
    }
  }

  function isKickedPayload(
    data,
    status = 0,
  ) {
    return Boolean(
      Number(status) ===
        410 ||
      data?.kicked ===
        true ||
      data?.status ===
        'player-replaced',
    );
  }

  function clearStoredSession() {
    try {
      localStorage.removeItem(
        STORED_SESSION_KEY,
      );
    } catch {
      return;
    }
  }

  function returnToMainMenu() {
    if (endingSession) {
      return;
    }

    endingSession =
      true;

    clearStoredSession();

    observer?.disconnect();

    const app =
      document.querySelector(
        '#app',
      );

    if (app) {
      app.style.pointerEvents =
        'none';
    }

    window.setTimeout(
      () => {
        const target =
          new URL(
            '/jogos/conquistador/',
            window.location.origin,
          );

        if (
          window.location.pathname ===
            target.pathname &&
          window.location.search ===
            ''
        ) {
          window.location.reload();
          return;
        }

        window.location.replace(
          target.href,
        );
      },
      0,
    );
  }

  function inspectMessage(
    socket,
    event,
  ) {
    if (
      !isGameApiUrl(
        socket.url,
      ) ||
      typeof event.data !==
        'string'
    ) {
      return false;
    }

    let message =
      null;

    try {
      message =
        JSON.parse(
          event.data,
        );
    } catch {
      return false;
    }

    if (!isRecord(message)) {
      return false;
    }

    const data =
      isRecord(
        message.data,
      )
        ? message.data
        : null;

    if (
      isKickedPayload(
        data,
        message.status,
      )
    ) {
      returnToMainMenu();
      return true;
    }

    if (data) {
      captureGameData(
        data,
      );
    }

    return false;
  }

  function getSocketWrapperMap(socket) {
    let map =
      listenerWrappers.get(
        socket,
      );

    if (!map) {
      map =
        new WeakMap();

      listenerWrappers.set(
        socket,
        map,
      );
    }

    return map;
  }

  WebSocket.prototype.addEventListener =
    function (
      type,
      listener,
      options,
    ) {
      if (
        type !==
          'message' ||
        !listener ||
        !isGameApiUrl(
          this.url,
        )
      ) {
        return originalAddEventListener.call(
          this,
          type,
          listener,
          options,
        );
      }

      const wrappers =
        getSocketWrapperMap(
          this,
        );

      let wrapped =
        wrappers.get(
          listener,
        );

      if (!wrapped) {
        const socket =
          this;

        wrapped =
          function (event) {
            if (
              inspectMessage(
                socket,
                event,
              )
            ) {
              return;
            }

            if (
              typeof listener ===
                'function'
            ) {
              return listener.call(
                socket,
                event,
              );
            }

            return listener
              .handleEvent?.(
                event,
              );
          };

        wrappers.set(
          listener,
          wrapped,
        );
      }

      return originalAddEventListener.call(
        this,
        type,
        wrapped,
        options,
      );
    };

  WebSocket.prototype.removeEventListener =
    function (
      type,
      listener,
      options,
    ) {
      const wrapped =
        listenerWrappers
          .get(
            this,
          )
          ?.get(
            listener,
          );

      return originalRemoveEventListener.call(
        this,
        type,
        wrapped ||
          listener,
        options,
      );
    };

  window.fetch =
    async function (
      input,
      init,
    ) {
      const response =
        await originalFetch(
          input,
          init,
        );

      if (
        !isGameApiUrl(
          getRequestUrl(
            input,
          ),
        )
      ) {
        return response;
      }

      const contentType =
        response.headers.get(
          'Content-Type',
        ) || '';

      if (
        !contentType
          .toLowerCase()
          .includes(
            'application/json',
          )
      ) {
        if (
          response.status ===
            410
        ) {
          returnToMainMenu();
        }

        return response;
      }

      let data =
        null;

      try {
        data =
          await response
            .clone()
            .json();
      } catch {
        return response;
      }

      if (!isRecord(data)) {
        return response;
      }

      if (
        isKickedPayload(
          data,
          response.status,
        )
      ) {
        returnToMainMenu();
        return response;
      }

      captureGameData(
        data,
      );

      return response;
    };

  observer =
    new MutationObserver(
      () => {
        if (!endingSession) {
          syncTurnPresentation();
        }
      },
    );

  const observeTarget =
    document.querySelector(
      '#app',
    ) ||
    document.documentElement;

  observer.observe(
    observeTarget,
    {
      childList: true,
      subtree: true,
    },
  );
})();
