import type {
    MAQuadroBackground,
    MAQuadroCanvasJson,
    MAQuadroPage,
    MAQuadroProject,
    MAQuadroProjectCategory
} from '../../types/maQuadro';
import {
    isMAQuadroProject,
    migrateLegacyMAQuadroDesign
} from './project';

const projectCategories =
    new Set<MAQuadroProjectCategory>([
        'social',
        'story',
        'presentation',
        'print',
        'invitation',
        'custom'
    ]);

const backgroundTypes =
    new Set<MAQuadroBackground['type']>([
        'solid',
        'transparent',
        'gradient'
    ]);

const MAX_PROJECT_PAGES = 200;
const MAX_PAGE_OBJECTS = 5000;
const MAX_OBJECT_DEPTH = 40;
const MAX_NAME_LENGTH = 180;
const MIN_PAGE_SIZE = 100;
const MAX_PAGE_SIZE = 8000;

function isRecord(
    value: unknown
): value is Record<string, unknown> {
    return Boolean(
        value &&
        typeof value === 'object' &&
        !Array.isArray(value)
    );
}

function isNonEmptyString(
    value: unknown,
    maximumLength = MAX_NAME_LENGTH
): value is string {
    return (
        typeof value === 'string' &&
        value.trim().length > 0 &&
        value.length <= maximumLength
    );
}

function isIsoDate(
    value: unknown
) {
    return (
        typeof value === 'string' &&
        value.length <= 40 &&
        Number.isFinite(
            Date.parse(value)
        )
    );
}

function isSafeDimension(
    value: unknown
) {
    return (
        typeof value === 'number' &&
        Number.isFinite(value) &&
        Number.isInteger(value) &&
        value >= MIN_PAGE_SIZE &&
        value <= MAX_PAGE_SIZE
    );
}

function isSafeColour(
    value: unknown
) {
    return (
        typeof value === 'string' &&
        value.length > 0 &&
        value.length <= 120
    );
}

function isSafeBackground(
    value: unknown
): value is MAQuadroBackground {
    if (!isRecord(value)) {
        return false;
    }

    return (
        backgroundTypes.has(
            value.type as MAQuadroBackground['type']
        ) &&
        isSafeColour(value.color) &&
        isSafeColour(value.gradientFrom) &&
        isSafeColour(value.gradientTo) &&
        typeof value.gradientAngle === 'number' &&
        Number.isFinite(value.gradientAngle) &&
        Math.abs(value.gradientAngle) <= 3600
    );
}

type CanvasObjectValidationState = {
    count: number;
    ids: Set<string>;
};

function validateCanvasObject(
    value: unknown,
    state: CanvasObjectValidationState,
    depth = 0
): boolean {
    if (
        !isRecord(value) ||
        depth > MAX_OBJECT_DEPTH
    ) {
        return false;
    }

    state.count += 1;

    if (
        state.count >
        MAX_PAGE_OBJECTS
    ) {
        return false;
    }

    const objectId =
        value.maId;

    if (objectId !== undefined) {
        if (
            typeof objectId !== 'string' ||
            objectId.length === 0 ||
            objectId.length > 220 ||
            state.ids.has(objectId)
        ) {
            return false;
        }

        state.ids.add(objectId);
    }

    const children =
        value.objects;

    if (children === undefined) {
        return true;
    }

    if (!Array.isArray(children)) {
        return false;
    }

    return children.every(
        (child) =>
            validateCanvasObject(
                child,
                state,
                depth + 1
            )
    );
}

function isSafeCanvasJson(
    value: unknown
): value is MAQuadroCanvasJson {
    if (!isRecord(value)) {
        return false;
    }

    const objects =
        value.objects;

    if (!Array.isArray(objects)) {
        return false;
    }

    const state:
        CanvasObjectValidationState = {
            count: 0,
            ids: new Set()
        };

    return objects.every(
        (object) =>
            validateCanvasObject(
                object,
                state
            )
    );
}

function isSafeThumbnail(
    value: unknown
) {
    return (
        value === undefined ||
        (
            typeof value === 'string' &&
            value.length <= 2500000 &&
            (
                value.startsWith('data:image/') ||
                value.startsWith('blob:') ||
                value.startsWith('/') ||
                value.startsWith('https://')
            )
        )
    );
}

function isSafePage(
    value: unknown
): value is MAQuadroPage {
    if (!isRecord(value)) {
        return false;
    }

    return (
        isNonEmptyString(
            value.id,
            220
        ) &&
        isNonEmptyString(
            value.name
        ) &&
        isSafeDimension(
            value.width
        ) &&
        isSafeDimension(
            value.height
        ) &&
        isSafeBackground(
            value.background
        ) &&
        isSafeCanvasJson(
            value.canvasJson
        ) &&
        isSafeThumbnail(
            value.thumbnail
        )
    );
}

function hasUniqueIds(
    values: string[]
) {
    return (
        new Set(values).size ===
        values.length
    );
}

export function isSystemMAQuadroTemplate(
    project: Pick<
        MAQuadroProject,
        'id' | 'isTemplate'
    >
) {
    return (
        project.isTemplate &&
        project.id.startsWith(
            'template-'
        )
    );
}

export function validateMAQuadroProject(
    value: unknown
): value is MAQuadroProject {
    if (!isMAQuadroProject(value)) {
        return false;
    }

    if (
        !isNonEmptyString(
            value.id,
            220
        ) ||
        !isNonEmptyString(
            value.name
        ) ||
        !projectCategories.has(
            value.category
        ) ||
        typeof value.isTemplate !== 'boolean' ||
        !isIsoDate(
            value.createdAt
        ) ||
        !isIsoDate(
            value.updatedAt
        ) ||
        value.pages.length === 0 ||
        value.pages.length > MAX_PROJECT_PAGES ||
        !value.pages.every(
            isSafePage
        )
    ) {
        return false;
    }

    const pageIds =
        value.pages.map(
            (page) => page.id
        );

    return (
        hasUniqueIds(pageIds) &&
        pageIds.includes(
            value.activePageId
        )
    );
}

export function normalizeImportedMAQuadroProject(
    value: unknown
): MAQuadroProject | null {
    const normalized =
        isMAQuadroProject(value)
            ? value
            : migrateLegacyMAQuadroDesign(
                value
            );

    return validateMAQuadroProject(
        normalized
    )
        ? normalized
        : null;
}
