import type {
    GIAEStatus,
    ISODate
} from '../types';

export function resolveGIAEStatusAfterSummaryChange(
    currentStatus: GIAEStatus,
    currentSummary: string,
    nextSummary: string
): GIAEStatus {
    if (
        currentStatus === 'submitted' &&
        nextSummary !== currentSummary
    ) {
        return 'pending';
    }

    return currentStatus;
}

export function isFutureGIAECopyDate(
    _lessonDate: ISODate,
    _today: ISODate
) {
    return false;
}
