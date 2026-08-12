import {
    useMemo,
    useState
} from 'react';

import type {
    MAQuadroPanelId,
    MAQuadroShapeKind,
    MAQuadroTextPreset
} from '../../types/maQuadro';

import {
    useMAQuadroEditorContext
} from './editorContext';

import './maQuadroDiscovery.css';

const panels: Array<{
    id: MAQuadroPanelId;
    icon: string;
    label: string;
}> = [
    {
        id: 'templates',
        icon: '▦',
        label: 'Modelos'
    },
    {
        id: 'elements',
        icon: '◇',
        label: 'Elementos'
    },
    {
        id: 'uploads',
        icon: '↑',
        label: 'Uploads'
    },
    {
        id: 'text',
        icon: 'T',
        label: 'Texto'
    },
    {
        id: 'brand',
        icon: '◉',
        label: 'Marca'
    },
    {
        id: 'projects',
        icon: '▤',
        label: 'Projetos'
    }
];

const shapes: Array<{
    kind: MAQuadroShapeKind;
    icon: string;
    label: string;
}> = [
    {
        kind: 'rectangle',
        icon: '▭',
        label: 'Retângulo'
    },
    {
        kind: 'circle',
        icon: '●',
        label: 'Círculo'
    },
    {
        kind: 'ellipse',
        icon: '⬭',
        label: 'Elipse'
    },
    {
        kind: 'triangle',
        icon: '▲',
        label: 'Triângulo'
    },
    {
        kind: 'star',
        icon: '★',
        label: 'Estrela'
    },
    {
        kind: 'line',
        icon: '─',
        label: 'Linha'
    },
    {
        kind: 'arrow',
        icon: '➜',
        label: 'Seta'
    }
];

const textPresets: Array<{
    preset: MAQuadroTextPreset;
    label: string;
    className: string;
}> = [
    {
        preset: 'heading',
        label:
            'Adicionar um título',
        className:
            'mq-text-preset--heading'
    },
    {
        preset: 'subheading',
        label:
            'Adicionar um subtítulo',
        className:
            'mq-text-preset--subheading'
    },
    {
        preset: 'body',
        label:
            'Adicionar texto corrido',
        className:
            'mq-text-preset--body'
    },
    {
        preset: 'caption',
        label:
            'Adicionar uma legenda',
        className:
            'mq-text-preset--caption'
    }
];

type LibraryCategoryFilter =
    | 'all'
    | 'social'
    | 'story'
    | 'presentation'
    | 'print'
    | 'invitation'
    | 'custom';

type ProjectViewFilter =
    | 'all'
    | 'recent'
    | 'favourites';

type FavouriteCollection = {
    templates: string[];
    projects: string[];
};

const FAVOURITES_STORAGE_KEY =
    'ma-quadro-favourites-v1';

const categoryOptions: Array<{
    id: LibraryCategoryFilter;
    label: string;
}> = [
    {
        id: 'all',
        label: 'Todos'
    },
    {
        id: 'social',
        label: 'Social'
    },
    {
        id: 'story',
        label: 'Stories'
    },
    {
        id: 'presentation',
        label: 'Apresentações'
    },
    {
        id: 'print',
        label: 'Impressão'
    },
    {
        id: 'invitation',
        label: 'Convites'
    },
    {
        id: 'custom',
        label: 'Outros'
    }
];

const categoryLabels: Record<
    Exclude<LibraryCategoryFilter, 'all'>,
    string
> = {
    social: 'Social',
    story: 'Story',
    presentation: 'Apresentação',
    print: 'Impressão',
    invitation: 'Convite',
    custom: 'Personalizado'
};

function normalizeSearch(
    value: string
) {
    return value
        .trim()
        .toLocaleLowerCase(
            'pt-PT'
        )
        .normalize('NFD')
        .replace(
            /[\u0300-\u036f]/g,
            ''
        );
}

function formatUpdatedAt(
    value: string
) {
    const date = new Date(
        value
    );

    if (
        Number.isNaN(
            date.getTime()
        )
    ) {
        return 'Data indisponível';
    }

    return new Intl.DateTimeFormat(
        'pt-PT',
        {
            day: '2-digit',
            month: 'short',
            year: 'numeric'
        }
    ).format(date);
}

function readFavouriteCollection(): FavouriteCollection {
    if (
        typeof window ===
        'undefined'
    ) {
        return {
            templates: [],
            projects: []
        };
    }

    try {
        const raw =
            window.localStorage.getItem(
                FAVOURITES_STORAGE_KEY
            );

        if (!raw) {
            return {
                templates: [],
                projects: []
            };
        }

        const parsed =
            JSON.parse(raw) as
                Partial<FavouriteCollection>;

        return {
            templates:
                Array.isArray(
                    parsed.templates
                )
                    ? parsed.templates.filter(
                          (value): value is string =>
                              typeof value ===
                              'string'
                      )
                    : [],
            projects:
                Array.isArray(
                    parsed.projects
                )
                    ? parsed.projects.filter(
                          (value): value is string =>
                              typeof value ===
                              'string'
                      )
                    : []
        };
    } catch {
        return {
            templates: [],
            projects: []
        };
    }
}

function useFavouriteIds(
    collection:
        keyof FavouriteCollection
) {
    const [ids, setIds] =
        useState<string[]>(() =>
            readFavouriteCollection()[
                collection
            ]
        );

    const idSet = useMemo(
        () => new Set(ids),
        [ids]
    );

    const toggle = (
        id: string
    ) => {
        setIds((current) => {
            const exists =
                current.includes(id);

            const next = exists
                ? current.filter(
                      (item) =>
                          item !== id
                  )
                : [id, ...current];

            if (
                typeof window !==
                'undefined'
            ) {
                const stored =
                    readFavouriteCollection();

                stored[collection] =
                    next;

                try {
                    window.localStorage.setItem(
                        FAVOURITES_STORAGE_KEY,
                        JSON.stringify(
                            stored
                        )
                    );
                } catch {
                    // Favoritos são uma melhoria de navegação.
                    // O editor continua funcional mesmo sem localStorage.
                }
            }

            return next;
        });
    };

    return {
        favouriteIds: idSet,
        toggleFavourite: toggle
    };
}

function SearchField({
    value,
    placeholder,
    label,
    disabled,
    onChange
}: {
    value: string;
    placeholder: string;
    label: string;
    disabled: boolean;
    onChange: (
        value: string
    ) => void;
}) {
    return (
        <label className="mq-discovery-search">
            <span
                className="mq-discovery-search__icon"
                aria-hidden="true"
            >
                ⌕
            </span>

            <input
                type="search"
                value={value}
                disabled={disabled}
                placeholder={placeholder}
                aria-label={label}
                onChange={(event) =>
                    onChange(
                        event.target.value
                    )
                }
            />

            {value ? (
                <button
                    type="button"
                    className="mq-discovery-search__clear"
                    disabled={disabled}
                    aria-label="Limpar pesquisa"
                    title="Limpar pesquisa"
                    onClick={() =>
                        onChange('')
                    }
                >
                    ×
                </button>
            ) : null}
        </label>
    );
}

function CategoryFilters({
    value,
    disabled,
    onChange
}: {
    value:
        LibraryCategoryFilter;
    disabled: boolean;
    onChange: (
        value:
            LibraryCategoryFilter
    ) => void;
}) {
    return (
        <div
            className="mq-discovery-chips"
            aria-label="Categorias"
        >
            {categoryOptions.map(
                (option) => (
                    <button
                        key={option.id}
                        type="button"
                        className={
                            value ===
                            option.id
                                ? 'is-active'
                                : ''
                        }
                        disabled={disabled}
                        aria-pressed={
                            value ===
                            option.id
                        }
                        onClick={() =>
                            onChange(
                                option.id
                            )
                        }
                    >
                        {option.label}
                    </button>
                )
            )}
        </div>
    );
}

function FavouriteButton({
    active,
    disabled,
    label,
    onClick
}: {
    active: boolean;
    disabled: boolean;
    label: string;
    onClick: () => void;
}) {
    return (
        <button
            type="button"
            className={`mq-favourite-button${
                active
                    ? ' is-active'
                    : ''
            }`}
            disabled={disabled}
            aria-pressed={active}
            aria-label={
                active
                    ? `Remover ${label} dos favoritos`
                    : `Adicionar ${label} aos favoritos`
            }
            title={
                active
                    ? 'Remover dos favoritos'
                    : 'Adicionar aos favoritos'
            }
            onClick={onClick}
        >
            {active
                ? '★'
                : '☆'}
        </button>
    );
}

function PanelHeading({
    title,
    description
}: {
    title: string;
    description?: string;
}) {
    return (
        <div className="mq-panel-heading">
            <h2>
                {title}
            </h2>

            {description ? (
                <p>
                    {description}
                </p>
            ) : null}
        </div>
    );
}

function TemplatesPanel() {
    const editor =
        useMAQuadroEditorContext();

    const locked =
        editor.busy ||
        editor.structureBusy;

    const [search, setSearch] =
        useState('');

    const [category, setCategory] =
        useState<LibraryCategoryFilter>(
            'all'
        );

    const [favouritesOnly, setFavouritesOnly] =
        useState(false);

    const {
        favouriteIds,
        toggleFavourite
    } = useFavouriteIds(
        'templates'
    );

    const query =
        normalizeSearch(search);

    const templates = useMemo(
        () =>
            editor.projects.filter(
                (project) =>
                    project.isTemplate
            ),
        [editor.projects]
    );

    const filteredPresets =
        useMemo(
            () =>
                editor.presets.filter(
                    (preset) => {
                        if (
                            category !==
                                'all' &&
                            preset.category !==
                                category
                        ) {
                            return false;
                        }

                        if (!query) {
                            return true;
                        }

                        return normalizeSearch(
                            [
                                preset.name,
                                preset.description,
                                categoryLabels[
                                    preset.category
                                ]
                            ].join(' ')
                        ).includes(query);
                    }
                ),
            [
                category,
                editor.presets,
                query
            ]
        );

    const filteredTemplates =
        useMemo(
            () =>
                templates.filter(
                    (template) => {
                        if (
                            category !==
                                'all' &&
                            template.category !==
                                category
                        ) {
                            return false;
                        }

                        if (
                            favouritesOnly &&
                            !favouriteIds.has(
                                template.id
                            )
                        ) {
                            return false;
                        }

                        if (!query) {
                            return true;
                        }

                        return normalizeSearch(
                            [
                                template.name,
                                categoryLabels[
                                    template.category
                                ],
                                template.isTemplate
                                    ? 'modelo template'
                                    : ''
                            ].join(' ')
                        ).includes(query);
                    }
                ),
            [
                category,
                favouriteIds,
                favouritesOnly,
                query,
                templates
            ]
        );

    const systemTemplates =
        filteredTemplates.filter(
            (project) =>
                project.id.startsWith(
                    'template-'
                )
        );

    const personalTemplates =
        filteredTemplates.filter(
            (project) =>
                !project.id.startsWith(
                    'template-'
                )
        );

    const hasResults =
        filteredPresets.length > 0 ||
        filteredTemplates.length > 0;

    return (
        <>
            <PanelHeading
                title="Começar um design"
                description="Encontre um formato ou um modelo e comece a editar de imediato."
            />

            <div className="mq-discovery-controls">
                <SearchField
                    value={search}
                    disabled={locked}
                    label="Pesquisar modelos e formatos"
                    placeholder="Pesquisar modelos e formatos…"
                    onChange={setSearch}
                />

                <CategoryFilters
                    value={category}
                    disabled={locked}
                    onChange={setCategory}
                />

                <button
                    type="button"
                    className={`mq-favourites-filter${
                        favouritesOnly
                            ? ' is-active'
                            : ''
                    }`}
                    disabled={locked}
                    aria-pressed={
                        favouritesOnly
                    }
                    onClick={() =>
                        setFavouritesOnly(
                            (value) =>
                                !value
                        )
                    }
                >
                    <span aria-hidden="true">
                        ★
                    </span>
                    Só favoritos
                </button>
            </div>

            {filteredPresets.length > 0 &&
            !favouritesOnly ? (
                <>
                    <div className="mq-section-title">
                        <h3>
                            Formatos
                        </h3>

                        <span>
                            {
                                filteredPresets.length
                            }
                        </span>
                    </div>

                    <div className="mq-preset-grid">
                        {filteredPresets.map(
                            (preset) => (
                                <button
                                    key={preset.id}
                                    type="button"
                                    className="mq-preset-card"
                                    disabled={locked}
                                    onClick={() =>
                                        void editor
                                            .createFromPreset(
                                                preset
                                            )
                                    }
                                >
                                    <span
                                        className="mq-preset-card__preview"
                                        data-ratio={
                                            preset.category
                                        }
                                    />

                                    <strong>
                                        {preset.name}
                                    </strong>

                                    <small>
                                        {preset.width} ×{' '}
                                        {preset.height}
                                    </small>
                                </button>
                            )
                        )}
                    </div>
                </>
            ) : null}

            {!query &&
            category === 'all' &&
            !favouritesOnly ? (
                <button
                    type="button"
                    className="mq-wide-action"
                    disabled={locked}
                    onClick={() =>
                        editor.setNewDesignOpen(
                            true
                        )
                    }
                >
                    + Tamanho personalizado
                </button>
            ) : null}

            {systemTemplates.length > 0 ? (
                <>
                    <div className="mq-section-title">
                        <h3>
                            Modelos profissionais
                        </h3>

                        <span>
                            {
                                systemTemplates.length
                            }
                        </span>
                    </div>

                    <div className="mq-template-list">
                        {systemTemplates.map(
                            (template) => (
                                <article
                                    key={template.id}
                                    className="mq-template-card-shell"
                                >
                                    <button
                                        type="button"
                                        className="mq-template-card"
                                        disabled={locked}
                                        onClick={() =>
                                            void editor.openProject(
                                                template.id
                                            )
                                        }
                                    >
                                        <span className="mq-template-card__thumb">
                                            {template.pages[0]
                                                ?.thumbnail ? (
                                                <img
                                                    src={
                                                        template.pages[0]
                                                            .thumbnail
                                                    }
                                                    alt=""
                                                />
                                            ) : (
                                                <span>
                                                    MQ
                                                </span>
                                            )}
                                        </span>

                                        <span className="mq-template-card__copy">
                                            <strong>
                                                {
                                                    template.name
                                                }
                                            </strong>

                                            <small>
                                                {
                                                    categoryLabels[
                                                        template.category
                                                    ]
                                                }
                                                {' · '}
                                                {
                                                    template.pages.length
                                                }{' '}
                                                {template.pages.length ===
                                                1
                                                    ? 'página'
                                                    : 'páginas'}
                                            </small>
                                        </span>

                                        <span className="mq-template-card__arrow">
                                            →
                                        </span>
                                    </button>

                                    <FavouriteButton
                                        active={
                                            favouriteIds.has(
                                                template.id
                                            )
                                        }
                                        disabled={locked}
                                        label={
                                            template.name
                                        }
                                        onClick={() =>
                                            toggleFavourite(
                                                template.id
                                            )
                                        }
                                    />
                                </article>
                            )
                        )}
                    </div>
                </>
            ) : null}

            {personalTemplates.length > 0 ? (
                <>
                    <div className="mq-section-title">
                        <h3>
                            Os seus modelos
                        </h3>

                        <span>
                            {
                                personalTemplates.length
                            }
                        </span>
                    </div>

                    <div className="mq-project-list">
                        {personalTemplates.map(
                            (template) => (
                                <article
                                    key={template.id}
                                    className="mq-project-card"
                                >
                                    <button
                                        type="button"
                                        className="mq-project-card__open"
                                        disabled={locked}
                                        onClick={() =>
                                            void editor.openProject(
                                                template.id
                                            )
                                        }
                                    >
                                        <span className="mq-project-card__thumb">
                                            {template.pages[0]
                                                ?.thumbnail ? (
                                                <img
                                                    src={
                                                        template.pages[0]
                                                            .thumbnail
                                                    }
                                                    alt=""
                                                />
                                            ) : (
                                                <span>
                                                    MQ
                                                </span>
                                            )}
                                        </span>

                                        <span>
                                            <strong>
                                                {
                                                    template.name
                                                }
                                            </strong>

                                            <small>
                                                Modelo pessoal ·{' '}
                                                {
                                                    categoryLabels[
                                                        template.category
                                                    ]
                                                }
                                            </small>
                                        </span>
                                    </button>

                                    <div className="mq-project-card__actions mq-project-card__actions--with-favourite">
                                        <FavouriteButton
                                            active={
                                                favouriteIds.has(
                                                    template.id
                                                )
                                            }
                                            disabled={locked}
                                            label={
                                                template.name
                                            }
                                            onClick={() =>
                                                toggleFavourite(
                                                    template.id
                                                )
                                            }
                                        />

                                        <button
                                            type="button"
                                            disabled={locked}
                                            onClick={() =>
                                                void editor.openProject(
                                                    template.id
                                                )
                                            }
                                        >
                                            Usar
                                        </button>

                                        <button
                                            type="button"
                                            disabled={locked}
                                            onClick={() =>
                                                void editor.deleteProject(
                                                    template.id
                                                )
                                            }
                                        >
                                            Eliminar
                                        </button>
                                    </div>
                                </article>
                            )
                        )}
                    </div>
                </>
            ) : null}

            {!hasResults ||
            (favouritesOnly &&
                filteredTemplates.length ===
                    0) ? (
                <div className="mq-empty-state mq-discovery-empty">
                    <strong>
                        Nenhum resultado
                    </strong>

                    <p>
                        Ajuste a pesquisa ou os filtros para ver mais opções.
                    </p>

                    <button
                        type="button"
                        disabled={locked}
                        onClick={() => {
                            setSearch('');
                            setCategory(
                                'all'
                            );
                            setFavouritesOnly(
                                false
                            );
                        }}
                    >
                        Limpar filtros
                    </button>
                </div>
            ) : null}
        </>
    );
}

function ElementsPanel() {
    const editor =
        useMAQuadroEditorContext();

    const locked =
        editor.busy ||
        editor.structureBusy;

    return (
        <>
            <PanelHeading
                title="Elementos"
                description="Adicione formas vetoriais, linhas e desenho livre."
            />

            <div className="mq-element-grid">
                {shapes.map(
                    (shape) => (
                        <button
                            key={shape.kind}
                            type="button"
                            className="mq-element-button"
                            disabled={locked}
                            onClick={() =>
                                editor.addShape(
                                    shape.kind
                                )
                            }
                        >
                            <span>
                                {shape.icon}
                            </span>

                            <small>
                                {shape.label}
                            </small>
                        </button>
                    )
                )}
            </div>

            <div className="mq-section-title">
                <h3>
                    Desenho livre
                </h3>
            </div>

            <button
                type="button"
                className={`mq-wide-action${
                    editor.drawingMode
                        ? ' is-active'
                        : ''
                }`}
                disabled={locked}
                onClick={() =>
                    editor.setDrawingMode(
                        !editor.drawingMode
                    )
                }
            >
                {editor.drawingMode
                    ? '✓ Parar de desenhar'
                    : '✎ Ativar pincel'}
            </button>

            <div className="mq-inline-fields">
                <label>
                    <span>
                        Cor
                    </span>

                    <input
                        type="color"
                        value={
                            editor.brushColor
                        }
                        disabled={locked}
                        onChange={(event) =>
                            editor.setBrushColor(
                                event.target.value
                            )
                        }
                    />
                </label>

                <label className="mq-inline-fields__grow">
                    <span>
                        Espessura:{' '}
                        {editor.brushWidth}px
                    </span>

                    <input
                        type="range"
                        min="1"
                        max="120"
                        value={
                            editor.brushWidth
                        }
                        disabled={locked}
                        onChange={(event) =>
                            editor.setBrushWidth(
                                Number(
                                    event.target.value
                                )
                            )
                        }
                    />
                </label>
            </div>

            <div className="mq-section-title">
                <h3>
                    Organizar seleção
                </h3>
            </div>

            <div className="mq-action-grid">
                <button
                    type="button"
                    onClick={
                        editor.groupSelection
                    }
                    disabled={
                        locked ||
                        editor.selection.count <
                        2
                    }
                >
                    Agrupar
                </button>

                <button
                    type="button"
                    onClick={
                        editor.ungroupSelection
                    }
                    disabled={
                        locked ||
                        editor.selection.role !==
                        'group'
                    }
                >
                    Desagrupar
                </button>

                <button
                    type="button"
                    onClick={() =>
                        editor.distributeSelection(
                            'horizontal'
                        )
                    }
                    disabled={
                        locked ||
                        editor.selection.count <
                        3
                    }
                >
                    Distribuir H
                </button>

                <button
                    type="button"
                    onClick={() =>
                        editor.distributeSelection(
                            'vertical'
                        )
                    }
                    disabled={
                        locked ||
                        editor.selection.count <
                        3
                    }
                >
                    Distribuir V
                </button>
            </div>
        </>
    );
}

function UploadsPanel() {
    const editor =
        useMAQuadroEditorContext();

    const locked =
        editor.busy ||
        editor.structureBusy;

    return (
        <>
            <PanelHeading
                title="Uploads"
                description="As imagens permanecem no seu dispositivo e ficam incorporadas no projeto."
            />

            <button
                type="button"
                className="mq-upload-zone"
                disabled={locked}
                aria-busy={editor.busy}
                onClick={() =>
                    editor.imageInputRef
                        .current
                        ?.click()
                }
            >
                <span className="mq-upload-zone__icon">
                    ↑
                </span>

                <strong>
                    {editor.busy
                        ? 'A carregar…'
                        : 'Carregar imagens'}
                </strong>

                <small>
                    PNG, JPG, WebP ou GIF
                </small>
            </button>

            <input
                ref={
                    editor.imageInputRef
                }
                type="file"
                multiple
                disabled={locked}
                accept="image/png,image/jpeg,image/webp,image/gif"
                onChange={(event) =>
                    void editor.addImages(
                        event
                    )
                }
                hidden
            />

            <div className="mq-info-card">
                <strong>
                    Também pode arrastar
                </strong>

                <p>
                    Arraste uma ou várias
                    imagens diretamente para
                    a área de trabalho.
                </p>
            </div>

            <div className="mq-info-card mq-info-card--accent">
                <strong>
                    Edição local
                </strong>

                <p>
                    Depois de selecionar uma
                    imagem pode ajustar cor,
                    recortar, virar e remover
                    fundos lisos.
                </p>
            </div>
        </>
    );
}

function TextPanel() {
    const editor =
        useMAQuadroEditorContext();

    const locked =
        editor.busy ||
        editor.structureBusy;

    return (
        <>
            <PanelHeading
                title="Texto"
                description="Adicione hierarquia tipográfica e personalize-a no painel da direita."
            />

            <div className="mq-text-presets">
                {textPresets.map(
                    (item) => (
                        <button
                            key={item.preset}
                            type="button"
                            className={`mq-text-preset ${item.className}`}
                            disabled={locked}
                            onClick={() =>
                                editor.addText(
                                    item.preset
                                )
                            }
                        >
                            {item.label}
                        </button>
                    )
                )}
            </div>

            <div className="mq-section-title">
                <h3>
                    Ações rápidas
                </h3>
            </div>

            <div className="mq-action-grid mq-action-grid--3">
                <button
                    type="button"
                    disabled={
                        locked ||
                        editor.selection.role !==
                        'text'
                    }
                    onClick={() =>
                        editor.transformTextCase(
                            'upper'
                        )
                    }
                >
                    ABC
                </button>

                <button
                    type="button"
                    disabled={
                        locked ||
                        editor.selection.role !==
                        'text'
                    }
                    onClick={() =>
                        editor.transformTextCase(
                            'lower'
                        )
                    }
                >
                    abc
                </button>

                <button
                    type="button"
                    disabled={
                        locked ||
                        editor.selection.role !==
                        'text'
                    }
                    onClick={() =>
                        editor.transformTextCase(
                            'title'
                        )
                    }
                >
                    Título
                </button>
            </div>
        </>
    );
}

function BrandPanel() {
    const editor =
        useMAQuadroEditorContext();

    const locked =
        editor.busy ||
        editor.structureBusy;

    return (
        <>
            <PanelHeading
                title={`Marca ${editor.brand.name}`}
                description="Aplique cores e fontes consistentes ao design."
            />

            <div className="mq-section-title">
                <h3>
                    Paleta
                </h3>
            </div>

            <div className="mq-color-grid">
                {editor.brand.colors.map(
                    (color) => (
                        <button
                            key={color.value}
                            type="button"
                            className="mq-color-card"
                            disabled={locked}
                            onClick={() =>
                                editor.applyBrandColor(
                                    color.value
                                )
                            }
                            title={`Aplicar ${color.name}`}
                        >
                            <span
                                style={{
                                    background:
                                        color.value
                                }}
                            />

                            <small>
                                {color.name}
                            </small>
                        </button>
                    )
                )}
            </div>

            <div className="mq-section-title">
                <h3>
                    Fontes
                </h3>

                <button
                    type="button"
                    disabled={locked}
                    onClick={() =>
                        editor.fontInputRef
                            .current
                            ?.click()
                    }
                >
                    + Adicionar
                </button>
            </div>

            <input
                ref={
                    editor.fontInputRef
                }
                type="file"
                disabled={locked}
                accept=".ttf,.otf,.woff,.woff2,font/ttf,font/otf,font/woff,font/woff2"
                onChange={(event) =>
                    void editor.uploadFont(
                        event
                    )
                }
                hidden
            />

            <div className="mq-font-list">
                {editor.availableFonts.map(
                    (font) => (
                        <button
                            key={font.family}
                            type="button"
                            className="mq-font-card"
                            disabled={
                                locked ||
                                editor.selection.role !==
                                'text'
                            }
                            onClick={() =>
                                editor.setTextProperty(
                                    'fontFamily',
                                    font.family
                                )
                            }
                        >
                            <span
                                style={{
                                    fontFamily:
                                        `${font.family}, ${
                                            font.fallback ||
                                            'sans-serif'
                                        }`
                                }}
                            >
                                Aa
                            </span>

                            <strong>
                                {font.name}
                            </strong>
                        </button>
                    )
                )}
            </div>

            {editor.localFonts.length >
            0 ? (
                <div className="mq-local-fonts">
                    {editor.localFonts.map(
                        (font) => (
                            <div key={font.id}>
                                <span>
                                    {font.fileName}
                                </span>

                                <button
                                    type="button"
                                    disabled={locked}
                                    onClick={() =>
                                        void editor
                                            .deleteFont(
                                                font.id
                                            )
                                    }
                                >
                                    Eliminar
                                </button>
                            </div>
                        )
                    )}
                </div>
            ) : null}
        </>
    );
}

function ProjectsPanel() {
    const editor =
        useMAQuadroEditorContext();

    const locked =
        editor.busy ||
        editor.structureBusy;

    const [search, setSearch] =
        useState('');

    const [view, setView] =
        useState<ProjectViewFilter>(
            'recent'
        );

    const {
        favouriteIds,
        toggleFavourite
    } = useFavouriteIds(
        'projects'
    );

    const projects = useMemo(
        () =>
            editor.projects
                .filter(
                    (project) =>
                        !project.isTemplate
                )
                .sort((first, second) =>
                    second.updatedAt.localeCompare(
                        first.updatedAt
                    )
                ),
        [editor.projects]
    );

    const query =
        normalizeSearch(search);

    const matchingProjects =
        useMemo(
            () => {
                const searched =
                    projects.filter(
                        (project) => {
                            if (!query) {
                                return true;
                            }

                            return normalizeSearch(
                                [
                                    project.name,
                                    categoryLabels[
                                        project.category
                                    ]
                                ].join(' ')
                            ).includes(
                                query
                            );
                        }
                    );

                if (
                    view ===
                    'favourites'
                ) {
                    return searched.filter(
                        (project) =>
                            favouriteIds.has(
                                project.id
                            )
                    );
                }

                if (
                    view === 'recent'
                ) {
                    return searched.slice(
                        0,
                        8
                    );
                }

                return searched;
            },
            [
                favouriteIds,
                projects,
                query,
                view
            ]
        );

    return (
        <>
            <PanelHeading
                title="Os seus projetos"
                description="Pesquise, retome os mais recentes ou marque os projetos que usa mais vezes."
            />

            <div className="mq-discovery-controls">
                <SearchField
                    value={search}
                    disabled={locked}
                    label="Pesquisar projetos"
                    placeholder="Pesquisar projetos…"
                    onChange={setSearch}
                />

                <div
                    className="mq-discovery-chips mq-discovery-chips--views"
                    aria-label="Vista de projetos"
                >
                    <button
                        type="button"
                        className={
                            view ===
                            'recent'
                                ? 'is-active'
                                : ''
                        }
                        disabled={locked}
                        aria-pressed={
                            view ===
                            'recent'
                        }
                        onClick={() =>
                            setView(
                                'recent'
                            )
                        }
                    >
                        Recentes
                    </button>

                    <button
                        type="button"
                        className={
                            view ===
                            'favourites'
                                ? 'is-active'
                                : ''
                        }
                        disabled={locked}
                        aria-pressed={
                            view ===
                            'favourites'
                        }
                        onClick={() =>
                            setView(
                                'favourites'
                            )
                        }
                    >
                        ★ Favoritos
                    </button>

                    <button
                        type="button"
                        className={
                            view === 'all'
                                ? 'is-active'
                                : ''
                        }
                        disabled={locked}
                        aria-pressed={
                            view === 'all'
                        }
                        onClick={() =>
                            setView(
                                'all'
                            )
                        }
                    >
                        Todos
                    </button>
                </div>
            </div>

            <div className="mq-section-title mq-section-title--discovery">
                <h3>
                    {view === 'recent'
                        ? 'Projetos recentes'
                        : view ===
                            'favourites'
                          ? 'Projetos favoritos'
                          : 'Todos os projetos'}
                </h3>

                <span>
                    {
                        matchingProjects.length
                    }
                </span>
            </div>

            <div className="mq-project-list">
                {matchingProjects.map(
                    (project) => (
                        <article
                            key={project.id}
                            className={`mq-project-card${
                                editor.project?.id ===
                                project.id
                                    ? ' is-active'
                                    : ''
                            }`}
                        >
                            <button
                                type="button"
                                className="mq-project-card__open"
                                disabled={locked}
                                onClick={() =>
                                    void editor.openProject(
                                        project.id
                                    )
                                }
                            >
                                <span className="mq-project-card__thumb">
                                    {project.pages[0]
                                        ?.thumbnail ? (
                                        <img
                                            src={
                                                project.pages[0]
                                                    .thumbnail
                                            }
                                            alt=""
                                        />
                                    ) : (
                                        <span>
                                            MQ
                                        </span>
                                    )}
                                </span>

                                <span className="mq-project-card__copy">
                                    <strong>
                                        {project.name}
                                    </strong>

                                    <small>
                                        {
                                            categoryLabels[
                                                project.category
                                            ]
                                        }
                                        {' · '}
                                        {project.pages.length}{' '}
                                        {project.pages.length ===
                                        1
                                            ? 'página'
                                            : 'páginas'}
                                    </small>

                                    <small className="mq-project-card__date">
                                        Atualizado em{' '}
                                        {formatUpdatedAt(
                                            project.updatedAt
                                        )}
                                    </small>
                                </span>
                            </button>

                            <div className="mq-project-card__actions mq-project-card__actions--with-favourite">
                                <FavouriteButton
                                    active={
                                        favouriteIds.has(
                                            project.id
                                        )
                                    }
                                    disabled={locked}
                                    label={
                                        project.name
                                    }
                                    onClick={() =>
                                        toggleFavourite(
                                            project.id
                                        )
                                    }
                                />

                                <button
                                    type="button"
                                    disabled={locked}
                                    onClick={() =>
                                        void editor.duplicateProject(
                                            project.id
                                        )
                                    }
                                >
                                    Duplicar
                                </button>

                                <button
                                    type="button"
                                    disabled={locked}
                                    onClick={() =>
                                        void editor.deleteProject(
                                            project.id
                                        )
                                    }
                                >
                                    Eliminar
                                </button>
                            </div>
                        </article>
                    )
                )}
            </div>

            {matchingProjects.length ===
            0 ? (
                <div className="mq-empty-state mq-discovery-empty">
                    <strong>
                        {projects.length === 0
                            ? 'Ainda não existem projetos guardados.'
                            : 'Nenhum projeto corresponde a esta vista.'}
                    </strong>

                    {projects.length > 0 ? (
                        <p>
                            Experimente limpar a pesquisa ou mostrar todos os projetos.
                        </p>
                    ) : null}

                    {projects.length > 0 ? (
                        <button
                            type="button"
                            disabled={locked}
                            onClick={() => {
                                setSearch('');
                                setView(
                                    'all'
                                );
                            }}
                        >
                            Mostrar todos
                        </button>
                    ) : null}
                </div>
            ) : null}

            <div className="mq-info-card mq-info-card--compact">
                <strong>
                    Guardado neste dispositivo
                </strong>

                <p>
                    Os projetos continuam no IndexedDB do browser. Use a exportação de projeto para manter uma cópia de segurança fora do browser.
                </p>
            </div>

            <button
                type="button"
                className="mq-wide-action"
                disabled={locked}
                onClick={() =>
                    editor.projectInputRef
                        .current
                        ?.click()
                }
            >
                Importar projeto JSON
            </button>
        </>
    );
}

export default function LeftSidebar() {
    const editor =
        useMAQuadroEditorContext();

    return (
        <aside className="mq-left-sidebar">
            <nav
                className="mq-tool-rail"
                aria-label="Ferramentas do editor"
            >
                {panels.map(
                    (panel) => (
                        <button
                            key={panel.id}
                            type="button"
                            className={
                                editor.activePanel ===
                                panel.id
                                    ? 'is-active'
                                    : ''
                            }
                            onClick={() =>
                                editor.setActivePanel(
                                    panel.id
                                )
                            }
                        >
                            <span>
                                {panel.icon}
                            </span>

                            <small>
                                {panel.label}
                            </small>
                        </button>
                    )
                )}
            </nav>

            <div className="mq-left-panel">
                <div className="mq-left-panel__scroll">
                    {editor.activePanel ===
                    'templates' ? (
                        <TemplatesPanel />
                    ) : null}

                    {editor.activePanel ===
                    'elements' ? (
                        <ElementsPanel />
                    ) : null}

                    {editor.activePanel ===
                    'uploads' ? (
                        <UploadsPanel />
                    ) : null}

                    {editor.activePanel ===
                    'text' ? (
                        <TextPanel />
                    ) : null}

                    {editor.activePanel ===
                    'brand' ? (
                        <BrandPanel />
                    ) : null}

                    {editor.activePanel ===
                    'projects' ? (
                        <ProjectsPanel />
                    ) : null}
                </div>
            </div>
        </aside>
    );
}
