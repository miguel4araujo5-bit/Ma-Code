(() => {
  'use strict';

  const GAME_API_PATH =
    '/api/conquistador/game';

  const STORED_SESSION_KEY =
    'conquistador-online-session-v1';

  const RETURN_TO_LOBBY_KEY =
    'conquistador-online-return-to-lobby-v1';

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

  let redirectingToLobby =
    false;

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

    const entry =
      queue[index];

    return typeof entry?.playerId ===
      'string'
      ? entry.playerId
      : '';
  }

  function getActiveActorId(data) {
    const game =
      isRecord(
        data?.game,
      )
        ? data.game
        : null;

    const event =
      isRecord(
        game?.sevenEvent,
      )
        ? game.sevenEvent
        : null;

    if (
      !game ||
      game.phase !==
        'event-seven' ||
      event?.step !==
        'discard'
    ) {
      return '';
    }

    const timer =
      isRecord(
        data?.turnTimer,
      )
        ? data.turnTimer
        : null;

    const timedActorId =
      typeof timer?.actorId ===
      'string'
        ? timer.actorId
        : '';

    return (
      timedActorId ||
      getDiscardActorId(
        game,
      )
    );
  }

  function normalizeGameState(data) {
    if (
      !isRecord(data) ||
      !isRecord(
        data.game,
      )
    ) {
      return data;
    }

    const game =
      data.game;

    const players =
      Array.isArray(
        game.players,
      )
        ? game.players
        : [];

    const actorId =
      getActiveActorId(
        data,
      );

    if (!actorId) {
      return data;
    }

    const actorIndex =
      players.findIndex(
        (player) =>
          isRecord(player) &&
          player.id ===
            actorId,
      );

    if (
      actorIndex < 0 ||
      game.currentPlayerId ===
        actorId
    ) {
      return data;
    }

    return {
      ...data,

      game: {
        ...game,

        currentPlayerId:
          actorId,
      },
    };
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

  function markReturnToLobby() {
    try {
      sessionStorage.setItem(
        RETURN_TO_LOBBY_KEY,
        '1',
      );
    } catch {
      return;
    }
  }

  function redirectToLobby() {
    if (redirectingToLobby) {
      return;
    }

    redirectingToLobby =
      true;

    clearStoredSession();
    markReturnToLobby();

    const target =
      new URL(
        '/jogos/conquistador/',
        window.location.origin,
      );

    window.location.replace(
      target.href,
    );
  }

  function shouldReturnToLobby() {
    try {
      return (
        sessionStorage.getItem(
          RETURN_TO_LOBBY_KEY,
        ) ===
        '1'
      );
    } catch {
      return false;
    }
  }

  function clearReturnToLobby() {
    try {
      sessionStorage.removeItem(
        RETURN_TO_LOBBY_KEY,
      );
    } catch {
      return;
    }
  }

  function openOnlineLobbyWhenReady() {
    if (
      !shouldReturnToLobby()
    ) {
      return;
    }

    let observer =
      null;

    let timeoutId =
      null;

    const openLobby =
      () => {
        const button =
          document.querySelector(
            '#online-game-button',
          );

        if (!button) {
          return false;
        }

        clearReturnToLobby();

        observer?.disconnect();

        if (timeoutId) {
          window.clearTimeout(
            timeoutId,
          );
        }

        button.click();

        return true;
      };

    if (openLobby()) {
      return;
    }

    observer =
      new MutationObserver(
        () => {
          openLobby();
        },
      );

    observer.observe(
      document.documentElement,
      {
        childList: true,
        subtree: true,
      },
    );

    timeoutId =
      window.setTimeout(
        () => {
          observer?.disconnect();
        },
        10_000,
      );
  }

  function transformSocketMessage(
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
      return event;
    }

    let message =
      null;

    try {
      message =
        JSON.parse(
          event.data,
        );
    } catch {
      return event;
    }

    if (!isRecord(message)) {
      return event;
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
      window.queueMicrotask(
        redirectToLobby,
      );
    }

    if (!data) {
      return event;
    }

    const normalizedData =
      normalizeGameState(
        data,
      );

    if (
      normalizedData ===
      data
    ) {
      return event;
    }

    return new MessageEvent(
      'message',
      {
        data:
          JSON.stringify({
            ...message,

            data:
              normalizedData,
          }),

        origin:
          event.origin,

        lastEventId:
          event.lastEventId,
      },
    );
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

      let socketWrappers =
        listenerWrappers.get(
          this,
        );

      if (!socketWrappers) {
        socketWrappers =
          new WeakMap();

        listenerWrappers.set(
          this,
          socketWrappers,
        );
      }

      let wrappedListener =
        socketWrappers.get(
          listener,
        );

      if (!wrappedListener) {
        const socket =
          this;

        wrappedListener =
          function (event) {
            const transformedEvent =
              transformSocketMessage(
                socket,
                event,
              );

            if (
              typeof listener ===
              'function'
            ) {
              return listener.call(
                socket,
                transformedEvent,
              );
            }

            return listener
              .handleEvent?.(
                transformedEvent,
              );
          };

        socketWrappers.set(
          listener,
          wrappedListener,
        );
      }

      return originalAddEventListener.call(
        this,
        type,
        wrappedListener,
        options,
      );
    };

  WebSocket.prototype.removeEventListener =
    function (
      type,
      listener,
      options,
    ) {
      const socketWrappers =
        listenerWrappers.get(
          this,
        );

      const wrappedListener =
        socketWrappers?.get(
          listener,
        );

      return originalRemoveEventListener.call(
        this,
        type,
        wrappedListener ||
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

      const requestUrl =
        getRequestUrl(
          input,
        );

      if (
        !isGameApiUrl(
          requestUrl,
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
          window.queueMicrotask(
            redirectToLobby,
          );
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
        window.queueMicrotask(
          redirectToLobby,
        );
      }

      const normalizedData =
        normalizeGameState(
          data,
        );

      if (
        normalizedData ===
        data
      ) {
        return response;
      }

      const headers =
        new Headers(
          response.headers,
        );

      headers.delete(
        'content-length',
      );

      headers.delete(
        'content-encoding',
      );

      return new Response(
        JSON.stringify(
          normalizedData,
        ),
        {
          status:
            response.status,

          statusText:
            response.statusText,

          headers,
        },
      );
    };

  if (
    document.readyState ===
    'loading'
  ) {
    document.addEventListener(
      'DOMContentLoaded',
      openOnlineLobbyWhenReady,
      {
        once: true,
      },
    );
  } else {
    openOnlineLobbyWhenReady();
  }
})();
