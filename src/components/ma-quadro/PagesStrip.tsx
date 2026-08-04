import {
    useEffect,
    useState,
    type ChangeEvent,
    type KeyboardEvent
} from 'react';

import type {
    MAQuadroPage
} from '../../types/maQuadro';

import {
    useMAQuadroEditorContext
} from './editorContext';

function PageNameField({
    page,
    index,
    disabled,
    onCommit
}: {
    page: MAQuadroPage;
    index: number;
    disabled: boolean;

    onCommit: (
        pageId: string,
        name: string
    ) => Promise<void>;
}) {
    const [
        draft,
        setDraft
    ] = useState(
        page.name
    );

    useEffect(() => {
        setDraft(
            page.name
        );
    }, [
        page.id,
        page.name
    ]);

    const commit =
        async () => {
            const next =
                draft.trim() ||
                `Página ${index + 1}`;

            setDraft(next);

            if (
                next ===
                page.name
            ) {
                return;
            }

            await onCommit(
                page.id,
                next
            );
        };

    const handleKeyDown = (
        event:
            KeyboardEvent<HTMLInputElement>
    ) => {
        if (
            event.key ===
            'Enter'
        ) {
            event.preventDefault();

            event
                .currentTarget
                .blur();
        } else if (
            event.key ===
            'Escape'
        ) {
            event.preventDefault();

            setDraft(
                page.name
            );

            event
                .currentTarget
                .blur();
        }
    };

    return (
        <input
            type="text"
            value={draft}
            maxLength={180}
            disabled={disabled}
            onChange={(
                event:
                    ChangeEvent<HTMLInputElement>
            ) =>
                setDraft(
                    event.target.value
                )
            }
            onBlur={() =>
                void commit()
            }
            onKeyDown={
                handleKeyDown
            }
            aria-label={`Nome da página ${index + 1}`}
        />
    );
}

export default function PagesStrip() {
    const editor =
        useMAQuadroEditorContext();

    const project =
        editor.project;

    if (!project) {
        return null;
    }

    const locked =
        editor.structureBusy ||
        editor.busy;

    return (
        <section
            className="mq-pages-strip"
            aria-label="Páginas do projeto"
            aria-busy={locked}
        >
            <div className="mq-pages-strip__header">
                <span>
                    <strong>
                        Páginas
                    </strong>

                    <small>
                        {
                            project.pages
                                .length
                        }
                    </small>
                </span>

                <div>
                    <button
                        type="button"
                        onClick={() =>
                            void editor
                                .duplicateActivePage()
                        }
                        disabled={
                            locked ||
                            !editor.activePage
                        }
                    >
                        Duplicar página
                    </button>

                    <button
                        type="button"
                        onClick={() =>
                            void editor
                                .addPage()
                        }
                        disabled={locked}
                    >
                        + Adicionar página
                    </button>
                </div>
            </div>

            <div className="mq-pages-list">
                {project.pages.map(
                    (
                        page,
                        index
                    ) => {
                        const active =
                            project.activePageId ===
                            page.id;

                        return (
                            <article
                                key={page.id}
                                className={`mq-page-card${
                                    active
                                        ? ' is-active'
                                        : ''
                                }`}
                            >
                                <button
                                    type="button"
                                    className="mq-page-card__preview"
                                    onClick={() =>
                                        void editor
                                            .setActivePage(
                                                page.id
                                            )
                                    }
                                    disabled={
                                        locked ||
                                        active
                                    }
                                    aria-label={`Abrir ${page.name}`}
                                    aria-current={
                                        active
                                            ? 'page'
                                            : undefined
                                    }
                                >
                                    <span className="mq-page-card__number">
                                        {index + 1}
                                    </span>

                                    {page.thumbnail ? (
                                        <img
                                            src={
                                                page.thumbnail
                                            }
                                            alt=""
                                        />
                                    ) : (
                                        <span
                                            className="mq-page-card__blank"
                                            style={{
                                                background:
                                                    page.background.type ===
                                                    'transparent'
                                                        ? 'repeating-conic-gradient(#E2E8F0 0 25%, #FFFFFF 0 50%) 50% / 14px 14px'
                                                        : page.background.type ===
                                                            'gradient'
                                                            ? `linear-gradient(${page.background.gradientAngle}deg, ${page.background.gradientFrom}, ${page.background.gradientTo})`
                                                            : page.background.color
                                            }}
                                        />
                                    )}
                                </button>

                                <PageNameField
                                    page={page}
                                    index={index}
                                    disabled={locked}
                                    onCommit={
                                        editor.renamePage
                                    }
                                />

                                <div className="mq-page-card__actions">
                                    <button
                                        type="button"
                                        onClick={() =>
                                            void editor
                                                .movePage(
                                                    page.id,
                                                    'left'
                                                )
                                        }
                                        disabled={
                                            locked ||
                                            index === 0
                                        }
                                        title="Mover para a esquerda"
                                        aria-label={`Mover ${page.name} para a esquerda`}
                                    >
                                        ←
                                    </button>

                                    <button
                                        type="button"
                                        onClick={() =>
                                            void editor
                                                .movePage(
                                                    page.id,
                                                    'right'
                                                )
                                        }
                                        disabled={
                                            locked ||
                                            index ===
                                            project.pages.length -
                                            1
                                        }
                                        title="Mover para a direita"
                                        aria-label={`Mover ${page.name} para a direita`}
                                    >
                                        →
                                    </button>

                                    {active ? (
                                        <button
                                            type="button"
                                            onClick={() =>
                                                void editor
                                                    .deleteActivePage()
                                            }
                                            disabled={
                                                locked ||
                                                project.pages.length ===
                                                1
                                            }
                                            title="Eliminar página"
                                            aria-label={`Eliminar ${page.name}`}
                                        >
                                            ×
                                        </button>
                                    ) : null}
                                </div>
                            </article>
                        );
                    }
                )}
            </div>
        </section>
    );
}
