export type MAQuadroSpacingAxis =
    | 'horizontal'
    | 'vertical';

export type MAQuadroSpacingRect = {
    left: number;
    top: number;
    width: number;
    height: number;
};

export type MAQuadroSpacingSegment = {
    axis: MAQuadroSpacingAxis;
    start: number;
    end: number;
    cross: number;
};

export type MAQuadroSpacingGuide = {
    axis: MAQuadroSpacingAxis;
    gap: number;
    segments: MAQuadroSpacingSegment[];
};

export type MAQuadroSpacingSnap = {
    delta: number;
    guide: MAQuadroSpacingGuide;
};

export type MAQuadroSmartSpacingResult = {
    horizontal: MAQuadroSpacingSnap | null;
    vertical: MAQuadroSpacingSnap | null;
};

type AxisRect = {
    start: number;
    end: number;
    crossStart: number;
    crossEnd: number;
};

type SpacingCandidate = {
    delta: number;
    gap: number;
    spans: Array<{
        start: number;
        end: number;
    }>;
    cross: number;
};

function rectEndX(
    rect: MAQuadroSpacingRect
) {
    return rect.left + rect.width;
}

function rectEndY(
    rect: MAQuadroSpacingRect
) {
    return rect.top + rect.height;
}

function toAxisRect(
    rect: MAQuadroSpacingRect,
    axis: MAQuadroSpacingAxis
): AxisRect {
    if (axis === 'horizontal') {
        return {
            start: rect.left,
            end: rectEndX(rect),
            crossStart: rect.top,
            crossEnd: rectEndY(rect)
        };
    }

    return {
        start: rect.top,
        end: rectEndY(rect),
        crossStart: rect.left,
        crossEnd: rectEndX(rect)
    };
}

function overlapsCrossAxis(
    first: AxisRect,
    second: AxisRect
) {
    return (
        Math.min(
            first.crossEnd,
            second.crossEnd
        ) -
        Math.max(
            first.crossStart,
            second.crossStart
        )
    ) > 0;
}

function candidateCross(
    target: AxisRect,
    related: AxisRect[]
) {
    const overlapStart = Math.max(
        target.crossStart,
        ...related.map(
            (rect) => rect.crossStart
        )
    );

    const overlapEnd = Math.min(
        target.crossEnd,
        ...related.map(
            (rect) => rect.crossEnd
        )
    );

    if (overlapEnd > overlapStart) {
        return (
            overlapStart +
            overlapEnd
        ) / 2;
    }

    return (
        target.crossStart +
        target.crossEnd
    ) / 2;
}

function createGuide(
    axis: MAQuadroSpacingAxis,
    candidate: SpacingCandidate
): MAQuadroSpacingGuide {
    return {
        axis,
        gap: candidate.gap,
        segments:
            candidate.spans.map(
                (span) => ({
                    axis,
                    start: span.start,
                    end: span.end,
                    cross: candidate.cross
                })
            )
    };
}

function pickBetterCandidate(
    current: SpacingCandidate | null,
    candidate: SpacingCandidate,
    threshold: number
) {
    if (
        candidate.gap < 0 ||
        Math.abs(candidate.delta) >
            threshold
    ) {
        return current;
    }

    if (!current) {
        return candidate;
    }

    const currentDistance =
        Math.abs(current.delta);

    const candidateDistance =
        Math.abs(candidate.delta);

    if (
        candidateDistance <
        currentDistance
    ) {
        return candidate;
    }

    if (
        candidateDistance ===
            currentDistance &&
        candidate.gap < current.gap
    ) {
        return candidate;
    }

    return current;
}

function findAxisSpacingSnap(
    targetRect: MAQuadroSpacingRect,
    otherRects: MAQuadroSpacingRect[],
    axis: MAQuadroSpacingAxis,
    threshold: number
): MAQuadroSpacingSnap | null {
    const target = toAxisRect(
        targetRect,
        axis
    );

    const relevant =
        otherRects
            .map((rect) =>
                toAxisRect(
                    rect,
                    axis
                )
            )
            .filter((rect) =>
                overlapsCrossAxis(
                    target,
                    rect
                )
            )
            .sort(
                (first, second) =>
                    first.start -
                    second.start
            );

    if (relevant.length < 2) {
        return null;
    }

    let best: SpacingCandidate | null =
        null;

    const targetSize =
        target.end - target.start;

    for (
        let index = 0;
        index < relevant.length - 1;
        index += 1
    ) {
        const first = relevant[index];
        const second =
            relevant[index + 1];

        if (
            first.end > second.start
        ) {
            continue;
        }

        const available =
            second.start -
            first.end -
            targetSize;

        if (available >= 0) {
            const centeredGap =
                available / 2;

            const expectedCenterStart =
                first.end +
                centeredGap;

            const expectedCenterEnd =
                expectedCenterStart +
                targetSize;

            best = pickBetterCandidate(
                best,
                {
                    delta:
                        expectedCenterStart -
                        target.start,
                    gap: centeredGap,
                    spans: [
                        {
                            start: first.end,
                            end:
                                expectedCenterStart
                        },
                        {
                            start:
                                expectedCenterEnd,
                            end: second.start
                        }
                    ],
                    cross: candidateCross(
                        target,
                        [first, second]
                    )
                },
                threshold
            );
        }

        const gap =
            second.start -
            first.end;

        const expectedAfterStart =
            second.end + gap;

        best = pickBetterCandidate(
            best,
            {
                delta:
                    expectedAfterStart -
                    target.start,
                gap,
                spans: [
                    {
                        start: first.end,
                        end: second.start
                    },
                    {
                        start: second.end,
                        end: expectedAfterStart
                    }
                ],
                cross: candidateCross(
                    target,
                    [first, second]
                )
            },
            threshold
        );

        const expectedBeforeEnd =
            first.start - gap;

        const expectedBeforeStart =
            expectedBeforeEnd -
            targetSize;

        best = pickBetterCandidate(
            best,
            {
                delta:
                    expectedBeforeStart -
                    target.start,
                gap,
                spans: [
                    {
                        start:
                            expectedBeforeEnd,
                        end: first.start
                    },
                    {
                        start: first.end,
                        end: second.start
                    }
                ],
                cross: candidateCross(
                    target,
                    [first, second]
                )
            },
            threshold
        );
    }

    if (!best) {
        return null;
    }

    return {
        delta: best.delta,
        guide: createGuide(
            axis,
            best
        )
    };
}

export function findMAQuadroSmartSpacing(
    target: MAQuadroSpacingRect,
    others: MAQuadroSpacingRect[],
    threshold: number
): MAQuadroSmartSpacingResult {
    const safeThreshold = Math.max(
        0,
        Number.isFinite(threshold)
            ? threshold
            : 0
    );

    return {
        horizontal:
            findAxisSpacingSnap(
                target,
                others,
                'horizontal',
                safeThreshold
            ),
        vertical:
            findAxisSpacingSnap(
                target,
                others,
                'vertical',
                safeThreshold
            )
    };
}
