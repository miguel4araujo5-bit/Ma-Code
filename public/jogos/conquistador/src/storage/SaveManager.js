const DEFAULT_STORAGE_KEY =
  'ma-code-conquistador-save';

const DEFAULT_SAVE_VERSION = 1;

function safeParse(
  value,
) {
  try {
    return JSON.parse(
      value,
    );
  } catch {
    return null;
  }
}

function isObject(
  value,
) {
  return (
    value !== null &&
    typeof value ===
      'object' &&
    !Array.isArray(value)
  );
}

export class SaveManager {
  constructor({
    storageKey =
      DEFAULT_STORAGE_KEY,
    saveVersion =
      DEFAULT_SAVE_VERSION,
  } = {}) {
    this.storageKey =
      storageKey;

    this.saveVersion =
      saveVersion;
  }

  isAvailable() {
    try {
      const testKey =
        `${this.storageKey}-test`;

      localStorage.setItem(
        testKey,
        '1',
      );

      localStorage.removeItem(
        testKey,
      );

      return true;
    } catch {
      return false;
    }
  }

  save(
    game,
  ) {
    if (
      !this.isAvailable()
    ) {
      return {
        success: false,
        reason:
          'O armazenamento local não está disponível.',
      };
    }

    if (
      !game ||
      typeof game.toJSON !==
        'function'
    ) {
      return {
        success: false,
        reason:
          'A partida não pode ser serializada.',
      };
    }

    const payload = {
      saveVersion:
        this.saveVersion,

      savedAt:
        new Date()
          .toISOString(),

      game:
        game.toJSON(),
    };

    try {
      localStorage.setItem(
        this.storageKey,
        JSON.stringify(
          payload,
        ),
      );

      return {
        success: true,
        savedAt:
          payload.savedAt,
      };
    } catch (error) {
      return {
        success: false,
        reason:
          error instanceof Error
            ? error.message
            : 'Não foi possível guardar a partida.',
      };
    }
  }

  loadRaw() {
    if (
      !this.isAvailable()
    ) {
      return null;
    }

    const raw =
      localStorage.getItem(
        this.storageKey,
      );

    if (!raw) {
      return null;
    }

    const payload =
      safeParse(raw);

    if (
      !isObject(payload) ||
      !isObject(
        payload.game,
      )
    ) {
      return null;
    }

    if (
      payload.saveVersion !==
      this.saveVersion
    ) {
      return null;
    }

    return payload;
  }

  load(
    GameClass,
  ) {
    const payload =
      this.loadRaw();

    if (!payload) {
      return {
        success: false,
        game: null,
        reason:
          'Não existe uma partida válida guardada.',
      };
    }

    if (
      !GameClass ||
      typeof GameClass.fromJSON !==
        'function'
    ) {
      return {
        success: false,
        game: null,
        reason:
          'A classe da partida não permite restaurar gravações.',
      };
    }

    try {
      const game =
        GameClass.fromJSON(
          payload.game,
        );

      return {
        success: true,
        game,
        savedAt:
          payload.savedAt,
      };
    } catch (error) {
      return {
        success: false,
        game: null,
        reason:
          error instanceof Error
            ? error.message
            : 'Não foi possível restaurar a partida.',
      };
    }
  }

  hasSave() {
    return Boolean(
      this.loadRaw(),
    );
  }

  clear() {
    try {
      localStorage.removeItem(
        this.storageKey,
      );

      return true;
    } catch {
      return false;
    }
  }

  export(
    game,
  ) {
    if (
      !game ||
      typeof game.toJSON !==
        'function'
    ) {
      throw new Error(
        'A partida não pode ser exportada.',
      );
    }

    const payload = {
      saveVersion:
        this.saveVersion,

      exportedAt:
        new Date()
          .toISOString(),

      game:
        game.toJSON(),
    };

    return JSON.stringify(
      payload,
      null,
      2,
    );
  }

  import(
    serialized,
    GameClass,
  ) {
    const payload =
      typeof serialized ===
        'string'
        ? safeParse(
            serialized,
          )
        : serialized;

    if (
      !isObject(payload) ||
      !isObject(
        payload.game,
      )
    ) {
      throw new Error(
        'O ficheiro de partida não é válido.',
      );
    }

    if (
      payload.saveVersion !==
      this.saveVersion
    ) {
      throw new Error(
        'Esta gravação pertence a uma versão incompatível.',
      );
    }

    if (
      !GameClass ||
      typeof GameClass.fromJSON !==
        'function'
    ) {
      throw new Error(
        'Não é possível restaurar a partida.',
      );
    }

    return GameClass.fromJSON(
      payload.game,
    );
  }
}

export {
  DEFAULT_STORAGE_KEY,
  DEFAULT_SAVE_VERSION,
};
