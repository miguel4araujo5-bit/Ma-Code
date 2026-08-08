export type MAQuadroFormatPainterAction =
    | 'activate'
    | 'cancel';

export type MAQuadroFormatPainterState = {
    active: boolean;
    sourceName: string | null;
};

const FORMAT_PAINTER_REQUEST_EVENT =
    'ma-quadro:format-painter-request';

const FORMAT_PAINTER_STATE_EVENT =
    'ma-quadro:format-painter-state';

export function requestMAQuadroFormatPainter(
    action: MAQuadroFormatPainterAction
) {
    if (
        typeof window ===
        'undefined'
    ) {
        return;
    }

    window.dispatchEvent(
        new CustomEvent<
            MAQuadroFormatPainterAction
        >(
            FORMAT_PAINTER_REQUEST_EVENT,
            {
                detail: action
            }
        )
    );
}

export function publishMAQuadroFormatPainterState(
    state: MAQuadroFormatPainterState
) {
    if (
        typeof window ===
        'undefined'
    ) {
        return;
    }

    window.dispatchEvent(
        new CustomEvent<
            MAQuadroFormatPainterState
        >(
            FORMAT_PAINTER_STATE_EVENT,
            {
                detail: state
            }
        )
    );
}

export function subscribeMAQuadroFormatPainterRequest(
    listener: (
        action:
            MAQuadroFormatPainterAction
    ) => void
) {
    if (
        typeof window ===
        'undefined'
    ) {
        return () => {};
    }

    const handler = (
        event: Event
    ) => {
        const customEvent =
            event as
                CustomEvent<
                    MAQuadroFormatPainterAction
                >;

        listener(
            customEvent.detail
        );
    };

    window.addEventListener(
        FORMAT_PAINTER_REQUEST_EVENT,
        handler
    );

    return () => {
        window.removeEventListener(
            FORMAT_PAINTER_REQUEST_EVENT,
            handler
        );
    };
}

export function subscribeMAQuadroFormatPainterState(
    listener: (
        state:
            MAQuadroFormatPainterState
    ) => void
) {
    if (
        typeof window ===
        'undefined'
    ) {
        return () => {};
    }

    const handler = (
        event: Event
    ) => {
        const customEvent =
            event as
                CustomEvent<
                    MAQuadroFormatPainterState
                >;

        listener(
            customEvent.detail
        );
    };

    window.addEventListener(
        FORMAT_PAINTER_STATE_EVENT,
        handler
    );

    return () => {
        window.removeEventListener(
            FORMAT_PAINTER_STATE_EVENT,
            handler
        );
    };
}
