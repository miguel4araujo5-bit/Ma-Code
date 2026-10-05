export async function copyTextToClipboard(
    value: string
) {
    if (
        typeof navigator !==
            'undefined' &&
        navigator.clipboard &&
        typeof navigator.clipboard.writeText ===
            'function'
    ) {
        await navigator.clipboard.writeText(
            value
        );
        return;
    }

    if (
        typeof document ===
        'undefined'
    ) {
        throw new Error(
            'Clipboard indisponível.'
        );
    }

    const textarea =
        document.createElement(
            'textarea'
        );

    textarea.value = value;
    textarea.setAttribute(
        'readonly',
        'true'
    );
    textarea.style.position =
        'fixed';
    textarea.style.opacity = '0';
    textarea.style.pointerEvents =
        'none';

    document.body.appendChild(
        textarea
    );
    textarea.focus();
    textarea.select();

    const successful =
        document.execCommand(
            'copy'
        );

    document.body.removeChild(
        textarea
    );

    if (!successful) {
        throw new Error(
            'Não foi possível copiar.'
        );
    }
}
