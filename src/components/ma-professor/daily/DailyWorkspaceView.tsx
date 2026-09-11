import {
    useCallback,
    useEffect,
    useMemo,
    useRef,
    useState
} from 'react';

import {
    useMAProfessorAccess
} from '../access/AccessGate';

import {
    calculateDailyCriteriaAverage,
    dailyCriteriaGridRepository,
    normalizeDailyCriterionScoreInput,
    parseDailyCriterionScore,
    type DailyCriteriaGridSnapshot
} from './dailyCriteriaGridRepository';

import {
    giaeExplicitSubmissionRepository
} from '../giaeExplicitSubmissionRepository';

import {
    createMAProfessorBackup
} from '../settings/backupRepository';

import {
    downloadTextFile
} from '../settings/csvExport';

import type {
    EntityId,
    GIAEStatus,
    ISODate,
    LessonStatus,
    Score,
    SummarySource
} from '../types';

import {
    deleteMAProfessorDailyDraft,
    readMAProfessorDailyDraft,
    saveMAProfessorDailyDraft,
    shouldAutoRestoreMAProfessorDailyDraft
} from './dailyDraftStorage';

import {
    isFutureGIAECopyDate,
    resolveGIAEStatusAfterSummaryChange
} from './dailyGIAEAuto';

import {
    dailyWorkspaceRepository,
    type DailyDateWorkspace,
    type DailyStudentRow
} from './dailyWorkspaceRepository';

interface DailyWorkspaceViewProps {
    academicYearId: EntityId;
    initialDate?: ISODate;
    initialLessonId?: EntityId;
    onSaved?: () => void | Promise<void>;
    onNavigationGuardChange?: (
        guard: (() => Promise<boolean>) | null
    ) => void;
}

interface LessonFormState {
    status: LessonStatus;
    startTime: string;
    endTime: string;
    periodCount: string;
    countTowardProgress: boolean;
    plannedActivity: string;
    summary: string;
    summarySource: SummarySource;
    planificationItemIds: EntityId[];
    notes: string;
    giaeStatus: GIAEStatus;
}

interface AssessmentFormState {
    choice: 'none';
    criterionId: '';
    title: '';
    activityType: 'other';
    description: string;
}

interface StudentEditorRow extends DailyStudentRow {
    assessmentScoreText: string;
    criterionScores: Record<
        EntityId,
        string
    >;
    criterionScorePersisted: Record<
        EntityId,
        boolean
    >;
}

interface SaveOptions {
    reload?: boolean;
    announce?: boolean;
}

const inputClassName =
    'w-full min-w-0 rounded-xl border border-white/10 bg-slate-950 px-3 py-2.5 text-sm text-white outline-none transition placeholder:text-slate-600 focus:border-cyan-300/55 focus:ring-2 focus:ring-cyan-300/10 disabled:cursor-not-allowed disabled:opacity-45';

const compactInputClassName =
    'w-full min-w-0 rounded-lg border border-white/10 bg-slate-950 px-2.5 py-2 text-xs text-white outline-none transition placeholder:text-slate-600 focus:border-cyan-300/55 focus:ring-2 focus:ring-cyan-300/10 disabled:cursor-not-allowed disabled:opacity-45';

function todayISO(): ISODate {
    const date = new Date();

    return [
        String(date.getFullYear()).padStart(4, '0'),
        String(date.getMonth() + 1).padStart(2, '0'),
        String(date.getDate()).padStart(2, '0')
    ].join('-');
}

function addDays(
    value: ISODate,
    amount: number
): ISODate {
    const [year, month, day] = value
        .split('-')
        .map(Number);

    const date = new Date(
        Date.UTC(year, month - 1, day)
    );

    date.setUTCDate(
        date.getUTCDate() + amount
    );

    return [
        String(date.getUTCFullYear()).padStart(4, '0'),
        String(date.getUTCMonth() + 1).padStart(2, '0'),
        String(date.getUTCDate()).padStart(2, '0')
    ].join('-');
}

function parseISODate(value: ISODate) {
    const [year, month, day] = value
        .split('-')
        .map(Number);

    return new Date(
        year,
        month - 1,
        day
    );
}

function formatShortWeekday(value: ISODate) {
    const date = parseISODate(value);

    const weekday =
        new Intl.DateTimeFormat('pt-PT', {
            weekday: 'short'
        })
            .format(date)
            .replace('.', '');

    return `${weekday} ${String(
        date.getDate()
    ).padStart(2, '0')}/${String(
        date.getMonth() + 1
    ).padStart(2, '0')}`;
}

function formatWeekRange(
    startDate: ISODate,
    endDate: ISODate
) {
    const start = parseISODate(startDate);
    const end = parseISODate(endDate);

    const sameYear =
        start.getFullYear() ===
        end.getFullYear();

    const startLabel =
        new Intl.DateTimeFormat('pt-PT', {
            day: 'numeric',
            month: 'long',
            ...(sameYear
                ? {}
                : {
                      year: 'numeric'
                  })
        }).format(start);

    const endLabel =
        new Intl.DateTimeFormat('pt-PT', {
            day: 'numeric',
            month: 'long',
            year: 'numeric'
        }).format(end);

    return `${startLabel} — ${endLabel}`;
}

function formatScore(value: Score | null) {
    return value === null
        ? '—'
        : new Intl.NumberFormat('pt-PT', {
              maximumFractionDigits: 2
          }).format(value);
}

function formatPercent(value: number | null) {
    return value === null
        ? '—'
        : `${new Intl.NumberFormat('pt-PT', {
              maximumFractionDigits: 1
          }).format(value)}%`;
}

function getModuleLabel(
    code: string,
    name: string
) {
    return code.trim()
        ? `${code.trim()} — ${name}`
        : name;
}

function getSubjectLabel(
    shortName: string,
    name: string
) {
    return shortName.trim() || name;
}

function lessonStatusLabel(
    status: LessonStatus
) {
    const labels: Record<
        LessonStatus,
        string
    > = {
        planned: 'Planeada',
        taught: 'Dada',
        cancelled: 'Cancelada'
    };

    return labels[status];
}

function lessonStatusClasses(
    status: LessonStatus
) {
    if (status === 'taught') {
        return 'border-emerald-300/25 bg-emerald-300/10 text-emerald-100';
    }

    if (status === 'cancelled') {
        return 'border-rose-300/25 bg-rose-300/10 text-rose-100';
    }

    return 'border-cyan-300/25 bg-cyan-300/10 text-cyan-100';
}

async function copyTextToClipboard(
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

function buildLessonForm(
    workspace: NonNullable<
        DailyDateWorkspace['selectedLesson']
    >
): LessonFormState {
    const lesson =
        workspace.context.lessonRow.lesson;

    return {
        status: lesson.status,
        startTime: lesson.startTime,
        endTime: lesson.endTime,
        periodCount: String(
            lesson.periodCount
        ),
        countTowardProgress:
            lesson.countTowardProgress,
        plannedActivity:
            lesson.plannedActivity,
        summary: lesson.summary,
        summarySource:
            lesson.summarySource,
        planificationItemIds: [
            ...lesson.planificationItemIds
        ],
        notes: lesson.notes,
        giaeStatus: lesson.giaeStatus
    };
}

function buildAssessmentForm(
    _workspace: NonNullable<
        DailyDateWorkspace['selectedLesson']
    >,
    criteriaGrid:
        DailyCriteriaGridSnapshot | null
): AssessmentFormState {
    return {
        choice: 'none',
        criterionId: '',
        title: '',
        activityType: 'other',
        description:
            criteriaGrid?.activity ?? ''
    };
}

function buildStudentRows(
    rows: DailyStudentRow[],
    criteriaGrid:
        DailyCriteriaGridSnapshot | null
): StudentEditorRow[] {
    const criteria =
        criteriaGrid?.criteria ?? [];

    return rows.map(row => {
        const persistedScores =
            criteriaGrid
                ?.scoresByStudentId[
                    row.student.id
                ] ?? {};

        const criterionScores =
            Object.fromEntries(
                criteria.map(criterion => [
                    criterion.id,
                    Object.prototype.hasOwnProperty.call(
                        persistedScores,
                        criterion.id
                    )
                        ? String(
                              persistedScores[
                                  criterion.id
                              ]
                          )
                        : '10'
                ])
            );

        const criterionScorePersisted =
            Object.fromEntries(
                criteria.map(criterion => [
                    criterion.id,
                    Object.prototype.hasOwnProperty.call(
                        persistedScores,
                        criterion.id
                    )
                ])
            );

        return {
            ...row,
            assessmentStatus:
                'not_evaluated',
            assessmentScore: null,
            assessmentNote: '',
            assessmentScoreText: '',
            criterionScores,
            criterionScorePersisted
        };
    });
}

function buildEditorSignature(
    lessonForm: LessonFormState | null,
    assessmentForm:
        | AssessmentFormState
        | null,
    students: StudentEditorRow[]
) {
    if (
        !lessonForm ||
        !assessmentForm
    ) {
        return '';
    }

    return JSON.stringify({
        lesson: lessonForm,
        assessment: assessmentForm,
        students: students.map(row => ({
            studentId: row.student.id,
            attendanceStatus:
                row.attendanceStatus,
            attendanceCode:
                row.attendanceCode,
            attendanceNote:
                row.attendanceNote,
            assessmentStatus:
                row.assessmentStatus,
            assessmentScoreText:
                row.assessmentScoreText,
            assessmentNote:
                row.assessmentNote,
            criterionScores:
                row.criterionScores
        }))
    });
}

export default function DailyWorkspaceView({
    academicYearId,
    initialDate,
    initialLessonId,
    onSaved,
    onNavigationGuardChange
}: DailyWorkspaceViewProps) {
    const {
        session
    } = useMAProfessorAccess();

    const accountEmail =
        session.email;

    const [date, setDate] =
        useState<ISODate>(
            initialDate ?? todayISO()
        );

    const [
        workspace,
        setWorkspace
    ] =
        useState<DailyDateWorkspace | null>(
            null
        );

    const [
        lessonForm,
        setLessonForm
    ] =
        useState<LessonFormState | null>(
            null
        );

    const [
        assessmentForm,
        setAssessmentForm
    ] =
        useState<AssessmentFormState | null>(
            null
        );

    const [students, setStudents] =
        useState<StudentEditorRow[]>([]);

    const [
        savedSignature,
        setSavedSignature
    ] = useState('');

    const [
        assessmentIdToDelete,
        setAssessmentIdToDelete
    ] = useState<EntityId | null>(
        null
    );

    const [loading, setLoading] =
        useState(true);

    const [saving, setSaving] =
        useState(false);

    const [
        emergencyBackupBusy,
        setEmergencyBackupBusy
    ] = useState(false);

    const [error, setError] =
        useState('');

    const [success, setSuccess] =
        useState('');

    const [
        showWeekOverview,
        setShowWeekOverview
    ] = useState(true);

    const [
        showAdvanced,
        setShowAdvanced
    ] = useState(false);

    const [
        showAssessmentDetails,
        setShowAssessmentDetails
    ] = useState(false);

    const [
        showStudentDetails,
        setShowStudentDetails
    ] = useState(false);

    const loadRequestRef = useRef(0);
    const savingRef = useRef(false);
    const draftWriteEpochRef =
        useRef(0);
    const hadUnsavedChangesRef =
        useRef(false);
    const navigationGuardRef =
        useRef<() => Promise<boolean>>(
            async () => true
        );
    const quickGradeInputRefs =
        useRef<Array<HTMLInputElement | null>>(
            []
        );

    const hydrate = useCallback(
        (
            nextWorkspace:
                DailyDateWorkspace,
            nextCriteriaGrid:
                DailyCriteriaGridSnapshot | null
        ) => {
            setWorkspace(nextWorkspace);
            setDate(nextWorkspace.date);
            setAssessmentIdToDelete(
                null
            );
            quickGradeInputRefs.current = [];

            if (
                !nextWorkspace.selectedLesson
            ) {
                setLessonForm(null);
                setAssessmentForm(null);
                setStudents([]);
                setSavedSignature('');
                return;
            }

            const nextLessonForm =
                buildLessonForm(
                    nextWorkspace.selectedLesson
                );

            const nextAssessmentForm =
                buildAssessmentForm(
                    nextWorkspace.selectedLesson,
                    nextCriteriaGrid
                );

            const nextStudents =
                buildStudentRows(
                    nextWorkspace
                        .selectedLesson.students,
                    nextCriteriaGrid
                );

            setLessonForm(
                nextLessonForm
            );

            setAssessmentForm(
                nextAssessmentForm
            );

            setStudents(nextStudents);

            setSavedSignature(
                buildEditorSignature(
                    nextLessonForm,
                    nextAssessmentForm,
                    nextStudents
                )
            );
        },
        []
    );

    const restoreDailyDraft =
        useCallback(
            async (
                nextWorkspace:
                    DailyDateWorkspace,
                nextCriteriaGrid:
                    DailyCriteriaGridSnapshot | null,
                requestId: number
            ) => {
                const nextSelectedLesson =
                    nextWorkspace
                        .selectedLesson;

                if (
                    !nextSelectedLesson
                ) {
                    return;
                }

                const lessonId =
                    nextSelectedLesson
                        .context
                        .lessonRow
                        .lesson.id;

                const nextLessonForm =
                    buildLessonForm(
                        nextSelectedLesson
                    );

                const nextAssessmentForm =
                    buildAssessmentForm(
                        nextSelectedLesson,
                        nextCriteriaGrid
                    );

                const nextStudents =
                    buildStudentRows(
                        nextSelectedLesson
                            .students,
                        nextCriteriaGrid
                    );

                const baseSavedSignature =
                    buildEditorSignature(
                        nextLessonForm,
                        nextAssessmentForm,
                        nextStudents
                    );

                let draft;

                try {
                    draft =
                        await readMAProfessorDailyDraft(
                            accountEmail,
                            academicYearId,
                            lessonId
                        );
                } catch {
                    return;
                }

                if (
                    requestId !==
                        loadRequestRef.current ||
                    !draft ||
                    draft.academicYearId !==
                        academicYearId ||
                    draft.lessonId !==
                        lessonId ||
                    draft.date !==
                        nextWorkspace.date ||
                    !shouldAutoRestoreMAProfessorDailyDraft(
                        draft,
                        baseSavedSignature
                    )
                ) {
                    return;
                }

                const draftByStudent =
                    new Map(
                        draft.students.map(
                            row => [
                                row.studentId,
                                row
                            ]
                        )
                    );

                const restoredStudents =
                    nextStudents.map(
                        row => {
                            const stored =
                                draftByStudent.get(
                                    row.student.id
                                );

                            if (!stored) {
                                return row;
                            }

                            return {
                                ...row,
                                attendanceStatus:
                                    stored.attendanceStatus,
                                attendanceCode:
                                    stored.attendanceCode,
                                attendanceNote:
                                    stored.attendanceNote,
                                criterionScores:
                                    stored.criterionScores
                                        ? {
                                              ...row.criterionScores,
                                              ...stored.criterionScores
                                          }
                                        : row.criterionScores
                            };
                        }
                    );

                const restoredLessonForm:
                    LessonFormState = {
                    ...draft.lesson,
                    planificationItemIds: [
                        ...draft.lesson
                            .planificationItemIds
                    ]
                };

                const restoredAssessmentForm:
                    AssessmentFormState = {
                    ...nextAssessmentForm,
                    description:
                        draft.assessment.description
                };

                const reconstructedSignature =
                    buildEditorSignature(
                        restoredLessonForm,
                        restoredAssessmentForm,
                        restoredStudents
                    );

                if (
                    reconstructedSignature !==
                    draft.draftSignature
                ) {
                    return;
                }

                setLessonForm(
                    restoredLessonForm
                );
                setAssessmentForm(
                    restoredAssessmentForm
                );
                setStudents(
                    restoredStudents
                );
                setAssessmentIdToDelete(
                    null
                );
                setSavedSignature(
                    baseSavedSignature
                );
                setSuccess(
                    'Rascunho não guardado recuperado neste dispositivo. Reveja e guarde a aula.'
                );
            },
            [
                accountEmail,
                academicYearId
            ]
        );

    const loadDate = useCallback(
        async (
            nextDate: ISODate,
            requestedLessonId?:
                | EntityId
                | null,
            requestedAssessmentId?:
                | EntityId
                | null
        ) => {
            const requestId =
                ++loadRequestRef.current;

            setLoading(true);
            setError('');
            setSuccess('');

            try {
                const nextWorkspace =
                    await dailyWorkspaceRepository.getDateWorkspace(
                        academicYearId,
                        nextDate,
                        requestedLessonId,
                        requestedAssessmentId
                    );

                if (
                    requestId !==
                    loadRequestRef.current
                ) {
                    return false;
                }

                const nextCriteriaGrid =
                    nextWorkspace.selectedLesson
                        ? await dailyCriteriaGridRepository.getLessonGrid(
                              nextWorkspace
                                  .selectedLesson
                                  .context
                                  .lessonRow
                                  .lesson.id
                          )
                        : null;

                if (
                    requestId !==
                    loadRequestRef.current
                ) {
                    return false;
                }

                hydrate(
                    nextWorkspace,
                    nextCriteriaGrid
                );

                await restoreDailyDraft(
                    nextWorkspace,
                    nextCriteriaGrid,
                    requestId
                );

                if (
                    requestId !==
                    loadRequestRef.current
                ) {
                    return false;
                }

                return true;
            } catch (loadError) {
                if (
                    requestId ===
                    loadRequestRef.current
                ) {
                    setError(
                        dailyWorkspaceRepository.describeError(
                            loadError
                        )
                    );
                }

                return false;
            } finally {
                if (
                    requestId ===
                    loadRequestRef.current
                ) {
                    setLoading(false);
                }
            }
        },
        [
            academicYearId,
            hydrate,
            restoreDailyDraft
        ]
    );

    useEffect(() => {
        const nextDate =
            initialDate ?? todayISO();

        void loadDate(
            nextDate,
            initialLessonId
        );
    }, [
        initialDate,
        initialLessonId,
        loadDate
    ]);

    const selectedLesson =
        workspace?.selectedLesson ?? null;

    const lessonRow =
        selectedLesson?.context
            .lessonRow ?? null;

    const lessonIsFuture =
        Boolean(
            lessonRow &&
            lessonRow.lesson.date > todayISO()
        );

    const assessmentWorkspace =
        selectedLesson
            ?.assessmentWorkspace ?? null;

    const criteria =
        assessmentWorkspace?.criteria ?? [];

    const criteriaGridTemplate =
        useMemo(
            () =>
                [
                    '2.25rem',
                    'minmax(8rem, 1fr)',
                    '3.75rem',
                    ...criteria.map(
                        () =>
                            'minmax(4.4rem, 5.5rem)'
                    ),
                    '4.75rem'
                ].join(' '),
            [criteria]
        );

    const criteriaGridMinWidth =
        (18 + criteria.length * 5.5) + 'rem';

    const hasCriteriaDefaultsToSave =
        Boolean(
            lessonForm &&
                lessonForm.status !==
                    'cancelled' &&
                criteria.length > 0 &&
                students.some(
                    row =>
                        row.attendanceStatus ===
                            'present' &&
                        criteria.some(
                            criterion =>
                                !row
                                    .criterionScorePersisted[
                                    criterion.id
                                ]
                        )
                )
        );

    const selectedAssessmentId:
        EntityId | null = null;

    const presentCount = useMemo(
        () =>
            students.filter(
                row =>
                    row.attendanceStatus ===
                    'present'
            ).length,
        [students]
    );

    const absentCount =
        students.length - presentCount;

    const currentEditorSignature =
        useMemo(
            () =>
                buildEditorSignature(
                    lessonForm,
                    assessmentForm,
                    students
                ),
            [
                assessmentForm,
                lessonForm,
                students
            ]
        );

    const hasUnsavedChanges =
        Boolean(
            currentEditorSignature &&
                currentEditorSignature !==
                    savedSignature
        );

    const hasPendingSave =
        hasUnsavedChanges ||
        hasCriteriaDefaultsToSave;

    const persistCurrentDailyDraft =
        useCallback(
            async () => {
                if (
                    !selectedLesson ||
                    !lessonForm ||
                    !assessmentForm ||
                    savingRef.current ||
                    !savedSignature ||
                    !currentEditorSignature ||
                    currentEditorSignature ===
                        savedSignature
                ) {
                    return;
                }

                const lessonId =
                    selectedLesson
                        .context
                        .lessonRow
                        .lesson.id;

                const writeEpoch =
                    draftWriteEpochRef.current;

                try {
                    await saveMAProfessorDailyDraft({
                        accountEmail,
                        academicYearId,
                        lessonId,
                        date,
                        baseSavedSignature:
                            savedSignature,
                        draftSignature:
                            currentEditorSignature,
                        assessmentIdToDelete:
                            null,
                        lesson: {
                            ...lessonForm,
                            planificationItemIds: [
                                ...lessonForm
                                    .planificationItemIds
                            ]
                        },
                        assessment: {
                            ...assessmentForm
                        },
                        students:
                            students.map(
                                row => ({
                                    studentId:
                                        row.student.id,
                                    attendanceStatus:
                                        row.attendanceStatus,
                                    attendanceCode:
                                        row.attendanceCode,
                                    attendanceNote:
                                        row.attendanceNote,
                                    assessmentStatus:
                                        'not_evaluated',
                                    assessmentScoreText:
                                        '',
                                    assessmentNote:
                                        '',
                                    criterionScores: {
                                        ...row.criterionScores
                                    }
                                })
                            )
                    });

                    if (
                        writeEpoch !==
                        draftWriteEpochRef.current
                    ) {
                        try {
                            await deleteMAProfessorDailyDraft(
                                accountEmail,
                                academicYearId,
                                lessonId
                            );
                        } catch {
                            // A gravação pedagógica continua a ser a fonte autoritativa.
                        }
                    }
                } catch {
                    // A proteção auxiliar nunca deve bloquear o trabalho normal do professor.
                }
            },
            [
                accountEmail,
                academicYearId,
                assessmentForm,
                currentEditorSignature,
                date,
                lessonForm,
                savedSignature,
                selectedLesson,
                students
            ]
        );

    useEffect(() => {
        if (!selectedLesson) {
            hadUnsavedChangesRef.current =
                false;
            return;
        }

        const lessonId =
            selectedLesson
                .context
                .lessonRow
                .lesson.id;

        if (!hasUnsavedChanges) {
            if (
                hadUnsavedChangesRef.current
            ) {
                hadUnsavedChangesRef.current =
                    false;
                draftWriteEpochRef.current +=
                    1;

                void deleteMAProfessorDailyDraft(
                    accountEmail,
                    academicYearId,
                    lessonId
                ).catch(() => {
                    // Um rascunho antigo nunca altera o estado já guardado.
                });
            }

            return;
        }

        hadUnsavedChangesRef.current =
            true;

        const timeout =
            window.setTimeout(
                () => {
                    void persistCurrentDailyDraft();
                },
                300
            );

        return () => {
            window.clearTimeout(
                timeout
            );
        };
    }, [
        accountEmail,
        academicYearId,
        hasUnsavedChanges,
        persistCurrentDailyDraft,
        selectedLesson
    ]);

    useEffect(() => {
        if (!hasUnsavedChanges) {
            return;
        }

        const handleVisibilityChange =
            () => {
                if (
                    document.visibilityState ===
                    'hidden'
                ) {
                    void persistCurrentDailyDraft();
                }
            };

        const handlePageHide =
            () => {
                void persistCurrentDailyDraft();
            };

        document.addEventListener(
            'visibilitychange',
            handleVisibilityChange
        );

        window.addEventListener(
            'pagehide',
            handlePageHide
        );

        return () => {
            document.removeEventListener(
                'visibilitychange',
                handleVisibilityChange
            );

            window.removeEventListener(
                'pagehide',
                handlePageHide
            );
        };
    }, [
        hasUnsavedChanges,
        persistCurrentDailyDraft
    ]);

    const weekTimeSlots = useMemo(
        () => {
            const slots = new Map<
                string,
                {
                    startTime: string;
                    endTime: string;
                }
            >();

            workspace?.weekDays.forEach(
                day => {
                    day.lessons.forEach(
                        row => {
                            const current =
                                slots.get(
                                    row.lesson
                                        .startTime
                                );

                            if (
                                !current ||
                                row.lesson
                                    .endTime >
                                    current.endTime
                            ) {
                                slots.set(
                                    row.lesson
                                        .startTime,
                                    {
                                        startTime:
                                            row
                                                .lesson
                                                .startTime,
                                        endTime:
                                            row
                                                .lesson
                                                .endTime
                                    }
                                );
                            }
                        }
                    );
                }
            );

            return [
                ...slots.values()
            ].sort(
                (left, right) =>
                    left.startTime.localeCompare(
                        right.startTime
                    )
            );
        },
        [workspace?.weekDays]
    );

    useEffect(() => {
        if (!hasUnsavedChanges) {
            return;
        }

        const handleBeforeUnload = (
            event: BeforeUnloadEvent
        ) => {
            event.preventDefault();
            event.returnValue = '';
        };

        window.addEventListener(
            'beforeunload',
            handleBeforeUnload
        );

        return () => {
            window.removeEventListener(
                'beforeunload',
                handleBeforeUnload
            );
        };
    }, [hasUnsavedChanges]);

    function updateLessonForm<
        Key extends keyof LessonFormState
    >(
        key: Key,
        value: LessonFormState[Key]
    ) {
        setLessonForm(current =>
            current
                ? {
                      ...current,
                      [key]: value
                  }
                : current
        );
    }

    function updateStudent(
        studentId: EntityId,
        changes: Partial<StudentEditorRow>
    ) {
        setStudents(current =>
            current.map(row =>
                row.student.id === studentId
                    ? {
                          ...row,
                          ...changes
                      }
                    : row
            )
        );
    }

    function closeSecondaryPanels() {
        setShowAdvanced(false);
        setShowAssessmentDetails(
            false
        );
        setShowStudentDetails(false);
    }

    async function notifySaved() {
        if (!onSaved) {
            return;
        }

        try {
            await onSaved();
        } catch {
            setSuccess(
                'Os dados foram guardados, mas o resumo geral não foi atualizado.'
            );
        }
    }

    async function handleCopySummary() {
        if (
            !selectedLesson ||
            !lessonForm ||
            !assessmentForm ||
            savingRef.current
        ) {
            return;
        }

        const summary =
            lessonForm.summary;

        if (!summary.trim()) {
            setError(
                'Escreva primeiro o sumário antes de copiar.'
            );
            setSuccess('');
            return;
        }

        const lessonId =
            selectedLesson.context
                .lessonRow.lesson.id;

        if (hasUnsavedChanges) {
            const saved =
                await saveAll({
                    reload: false,
                    announce: false
                });

            if (!saved) {
                return;
            }
        }

        savingRef.current = true;
        setSaving(true);
        setError('');
        setSuccess('');

        let copied = false;

        try {
            const currentWorkspace =
                await dailyWorkspaceRepository.getLessonWorkspace(
                    academicYearId,
                    lessonId,
                    selectedAssessmentId ??
                        undefined
                );

            const currentLesson =
                currentWorkspace.context
                    .lessonRow.lesson;

            if (
                currentLesson.summary !==
                summary
            ) {
                throw new Error(
                    'Esta aula foi alterada noutra aba ou janela. Reveja a versão atual antes de copiar novamente o sumário.'
                );
            }

            await copyTextToClipboard(
                summary
            );
            copied = true;

            const assessmentId =
                currentWorkspace
                    .selectedAssessment?.id ??
                null;

            if (
                isFutureGIAECopyDate(
                    currentLesson.date,
                    todayISO()
                )
            ) {
                await loadDate(
                    date,
                    lessonId,
                    assessmentId
                );
                setSuccess(
                    'Sumário copiado. Como a aula é futura, mantém-se por submeter no GIAE.'
                );
                return;
            }

            const submitted =
                await giaeExplicitSubmissionRepository.markSubmitted(
                    {
                        lessonId,
                        expectedUpdatedAt:
                            currentLesson.updatedAt
                    }
                );

            if (
                submitted.giaeStatus !==
                'submitted'
            ) {
                throw new Error(
                    'Não foi possível confirmar a submissão desta aula no GIAE.'
                );
            }

            const reloaded =
                await loadDate(
                    date,
                    lessonId,
                    assessmentId
                );

            if (!reloaded) {
                const confirmedLessonForm:
                    LessonFormState = {
                    ...lessonForm,
                    giaeStatus: 'submitted'
                };

                setLessonForm(
                    confirmedLessonForm
                );
                setSavedSignature(
                    buildEditorSignature(
                        confirmedLessonForm,
                        assessmentForm,
                        students
                    )
                );
            }

            setSuccess(
                'Sumário copiado e assinalado automaticamente como submetido no GIAE.'
            );

            await notifySaved();
        } catch (copyError) {
            await loadDate(
                date,
                lessonId,
                selectedAssessmentId
            );

            const message =
                copyError instanceof Error &&
                copyError.message.trim()
                    ? copyError.message
                    : 'Ocorreu um erro inesperado.';

            setError(
                copied
                    ? `O sumário foi copiado, mas não foi assinalado como submetido no GIAE. ${message}`
                    : `Não foi possível copiar o sumário. ${message}`
            );
            setSuccess('');
        } finally {
            savingRef.current = false;
            setSaving(false);
        }
    }

    async function saveAll(
        options: SaveOptions = {}
    ): Promise<boolean> {
        const {
            reload = true,
            announce = true
        } = options;

        if (
            !selectedLesson ||
            !lessonForm ||
            !assessmentForm ||
            savingRef.current
        ) {
            return false;
        }

        const periodCount = Number(
            lessonForm.periodCount
        );

        if (
            !Number.isInteger(
                periodCount
            ) ||
            periodCount <= 0
        ) {
            setError(
                'O número de tempos deve ser um número inteiro superior a zero.'
            );
            setSuccess('');
            return false;
        }

        const effectiveStatus:
            LessonStatus =
            lessonForm.status ===
            'cancelled'
                ? 'cancelled'
                : lessonForm.summary.trim()
                  ? 'taught'
                  : lessonForm.status;

        if (
            effectiveStatus !==
                'taught' &&
            absentCount > 0
        ) {
            setError(
                'Escreva o sumário antes de guardar faltas nesta aula.'
            );
            setSuccess('');
            return false;
        }

        if (
            effectiveStatus !==
            'cancelled'
        ) {
            for (const row of students) {
                if (
                    row.attendanceStatus ===
                    'absent'
                ) {
                    continue;
                }

                for (const criterion of criteria) {
                    try {
                        parseDailyCriterionScore(
                            row.criterionScores[
                                criterion.id
                            ] ?? ''
                        );
                    } catch {
                        setError(
                            'A classificação de ' + row.student.name + ' em “' + criterion.name + '” deve estar entre 0 e 20 valores.'
                        );
                        setSuccess('');
                        return false;
                    }
                }
            }
        }

        savingRef.current = true;
        setSaving(true);
        setError('');

        if (announce) {
            setSuccess('');
        }

        const lessonId =
            selectedLesson
                .context
                .lessonRow
                .lesson.id;

        let lessonPersisted = false;

        try {
            const result =
                await dailyWorkspaceRepository.saveLesson(
                    {
                        lessonId,
                        status:
                            effectiveStatus,
                        startTime:
                            lessonForm.startTime,
                        endTime:
                            lessonForm.endTime,
                        periodCount,
                        countTowardProgress:
                            lessonForm
                                .countTowardProgress,
                        plannedActivity:
                            lessonForm
                                .plannedActivity,
                        summary:
                            lessonForm.summary,
                        summarySource:
                            lessonForm
                                .summarySource,
                        planificationItemIds:
                            lessonForm
                                .planificationItemIds,
                        notes:
                            lessonForm.notes,
                        giaeStatus:
                            lessonForm
                                .giaeStatus,
                        students:
                            students.map(
                                row => ({
                                    studentId:
                                        row.student.id,
                                    attendanceStatus:
                                        row.attendanceStatus,
                                    attendanceCode:
                                        row.attendanceCode,
                                    attendanceNote:
                                        row.attendanceNote,
                                    assessmentStatus:
                                        'not_evaluated',
                                    assessmentScore:
                                        null,
                                    assessmentNote:
                                        ''
                                })
                            ),
                        assessment: {
                            mode: 'none',
                            assessmentId: null,
                            criterionId: '',
                            title: '',
                            activityType: 'other',
                            description: ''
                        }
                    }
                );

            lessonPersisted = true;

            if (
                effectiveStatus !==
                    'cancelled' &&
                criteria.length > 0
            ) {
                await dailyCriteriaGridRepository.saveLessonGrid(
                    {
                        lesson:
                            result.lesson,
                        summary:
                            lessonForm.summary,
                        activity:
                            assessmentForm.description,
                        rows:
                            students.map(
                                row => ({
                                    studentId:
                                        row.student.id,
                                    attendanceStatus:
                                        row.attendanceStatus,
                                    scores: {
                                        ...row.criterionScores
                                    }
                                })
                            )
                    }
                );

                await dailyWorkspaceRepository.getLessonWorkspace(
                    academicYearId,
                    lessonId
                );
            }

            const persistedStudents =
                students.map(
                    row => ({
                        ...row,
                        criterionScorePersisted:
                            Object.fromEntries(
                                criteria.map(
                                    criterion => [
                                        criterion.id,
                                        effectiveStatus !==
                                            'cancelled' &&
                                        row.attendanceStatus ===
                                            'present'
                                    ]
                                )
                            )
                    })
                );

            setStudents(
                persistedStudents
            );

            draftWriteEpochRef.current +=
                1;

            try {
                await deleteMAProfessorDailyDraft(
                    accountEmail,
                    academicYearId,
                    lessonId
                );
            } catch {
                // A aula já foi guardada; uma falha auxiliar não altera esse resultado.
            }

            if (reload) {
                const reloaded =
                    await loadDate(
                        date,
                        result.lesson.id
                    );

                if (!reloaded) {
                    setSavedSignature(
                        currentEditorSignature
                    );
                    setSuccess(
                        'Os dados foram guardados. Atualize a página se a aula não refletir imediatamente as alterações.'
                    );
                }
            } else {
                setSavedSignature(
                    currentEditorSignature
                );
            }

            setAssessmentIdToDelete(
                null
            );

            if (announce) {
                setSuccess(
                    'Aula, sumário, faltas e avaliações guardados.'
                );
            }

            await notifySaved();

            return true;
        } catch (saveError) {
            if (lessonPersisted) {
                try {
                    await dailyWorkspaceRepository.getLessonWorkspace(
                        academicYearId,
                        lessonId
                    );
                } catch {
                    // Mantém o erro original da gravação.
                }
            }

            setError(
                dailyWorkspaceRepository.describeError(
                    saveError
                )
            );

            return false;
        } finally {
            savingRef.current = false;
            setSaving(false);
        }
    }

    async function saveBeforeNavigation() {
        if (!hasUnsavedChanges) {
            return true;
        }

        const saved =
            await saveAll({
                reload: false,
                announce: false
            });

        if (saved) {
            return true;
        }

        if (
            !selectedLesson ||
            typeof window === 'undefined'
        ) {
            return false;
        }

        const leaveWithoutSaving =
            window.confirm(
                'Não foi possível guardar as alterações.\n\nOK — Sair sem guardar\nCancelar — Ficar e corrigir'
            );

        if (!leaveWithoutSaving) {
            return false;
        }

        const lessonId =
            selectedLesson
                .context
                .lessonRow
                .lesson.id;

        draftWriteEpochRef.current +=
            1;
        hadUnsavedChangesRef.current =
            false;
        setSavedSignature(
            currentEditorSignature
        );

        try {
            await deleteMAProfessorDailyDraft(
                accountEmail,
                academicYearId,
                lessonId
            );
        } catch {
            // A limpeza auxiliar do rascunho nunca pode voltar a prender a navegação.
        }

        setError('');
        setSuccess('');

        return true;
    }

    navigationGuardRef.current =
        saveBeforeNavigation;

    useEffect(() => {
        if (!onNavigationGuardChange) {
            return;
        }

        const guard = () =>
            navigationGuardRef.current();

        onNavigationGuardChange(
            guard
        );

        return () => {
            onNavigationGuardChange(
                null
            );
        };
    }, [onNavigationGuardChange]);

    async function downloadEmergencyBackup() {
        if (
            !selectedLesson ||
            !lessonForm ||
            !assessmentForm ||
            emergencyBackupBusy
        ) {
            return;
        }

        setEmergencyBackupBusy(true);

        try {
            const persistedBackup =
                await createMAProfessorBackup();

            const exportedAt =
                new Date().toISOString();

            const emergencyBackup = {
                product:
                    'ma-professor-emergency-backup',
                schemaVersion: 1,
                exportedAt,
                reason:
                    error.trim() ||
                    'Não foi possível guardar a aula.',
                persistedBackup,
                unsavedDailyDraft: {
                    academicYearId,
                    date,
                    lessonId:
                        selectedLesson
                            .context
                            .lessonRow
                            .lesson.id,
                    assessmentIdToDelete,
                    context: {
                        groupName:
                            lessonRow?.group.name ??
                            '',
                        subjectName:
                            lessonRow?.subject.name ??
                            '',
                        subjectShortName:
                            lessonRow?.subject.shortName ??
                            '',
                        moduleCode:
                            lessonRow?.module.code ??
                            '',
                        moduleName:
                            lessonRow?.module.name ??
                            ''
                    },
                    lesson: lessonForm,
                    assessment:
                        assessmentForm,
                    students:
                        students.map(row => ({
                            studentId:
                                row.student.id,
                            number:
                                row.student.number,
                            name:
                                row.student.name,
                            attendanceStatus:
                                row.attendanceStatus,
                            attendanceCode:
                                row.attendanceCode,
                            attendanceNote:
                                row.attendanceNote,
                            assessmentStatus:
                                row.assessmentStatus,
                            assessmentScoreText:
                                row.assessmentScoreText,
                            assessmentNote:
                                row.assessmentNote,
                            criterionScores: {
                                ...row.criterionScores
                            }
                        }))
                },
                recoveryNote:
                    'Esta cópia de emergência contém o backup local já persistido e, em separado, o estado da aula que ainda estava no ecrã. O ficheiro não está cifrado e pode conter dados de alunos.'
            };

            const time =
                exportedAt
                    .slice(11, 19)
                    .replace(/:/g, '-');

            downloadTextFile(
                `ma-professor-emergencia-aula-${date}-${time}.json`,
                JSON.stringify(
                    emergencyBackup,
                    null,
                    2
                ),
                'application/json;charset=utf-8'
            );

            setSuccess(
                'Cópia de segurança de emergência criada. Os dados no ecrã continuam disponíveis para tentar guardar novamente.'
            );
        } catch (backupError) {
            const backupMessage =
                backupError instanceof Error &&
                backupError.message.trim()
                    ? backupError.message
                    : 'erro inesperado';

            setSuccess('');
            setError(current =>
                `${current || 'Não foi possível guardar a aula.'} Também não foi possível criar a cópia de segurança: ${backupMessage}`
            );
        } finally {
            setEmergencyBackupBusy(
                false
            );
        }
    }

    async function changeDate(
        nextDate: ISODate,
        requestedLessonId?:
            | EntityId
            | null
    ) {
        if (
            loading ||
            savingRef.current
        ) {
            return;
        }

        if (
            nextDate === date &&
            (!requestedLessonId ||
                requestedLessonId ===
                    workspace
                        ?.selectedLessonId)
        ) {
            return;
        }

        if (
            !(await saveBeforeNavigation())
        ) {
            return;
        }

        closeSecondaryPanels();

        await loadDate(
            nextDate,
            requestedLessonId
        );
    }

    async function selectLesson(
        lessonDate: ISODate,
        lessonId: EntityId
    ) {
        if (
            loading ||
            savingRef.current ||
            (lessonDate === date &&
                workspace
                    ?.selectedLessonId ===
                    lessonId)
        ) {
            return;
        }

        await changeDate(
            lessonDate,
            lessonId
        );
    }

    function useNextPlanificationItem() {
        if (
            !selectedLesson ||
            !lessonForm
        ) {
            return;
        }

        const item =
            selectedLesson.context
                .nextPlanificationItem;

        if (!item) {
            return;
        }

        const nextSummary =
            item.suggestedSummary.trim() ||
            item.content.trim();

        setLessonForm({
            ...lessonForm,
            status:
                lessonForm.status ===
                'planned'
                    ? 'taught'
                    : lessonForm.status,
            plannedActivity:
                item.activity.trim() ||
                item.content.trim(),
            summary: nextSummary,
            summarySource:
                'planification',
            planificationItemIds: [
                item.id
            ],
            giaeStatus:
                resolveGIAEStatusAfterSummaryChange(
                    lessonForm.giaeStatus,
                    lessonForm.summary,
                    nextSummary
                )
        });
    }

    function copyPreviousLesson() {
        if (
            !selectedLesson ||
            !lessonForm
        ) {
            return;
        }

        const previous =
            selectedLesson.context
                .previousLessonTemplate;

        if (!previous) {
            return;
        }

        setLessonForm({
            ...lessonForm,
            status:
                lessonForm.status ===
                'planned'
                    ? 'taught'
                    : lessonForm.status,
            plannedActivity:
                previous.plannedActivity,
            summary: previous.summary,
            summarySource: 'manual',
            planificationItemIds: [],
            notes: previous.notes,
            giaeStatus:
                resolveGIAEStatusAfterSummaryChange(
                    lessonForm.giaeStatus,
                    lessonForm.summary,
                    previous.summary
                )
        });
    }

    function markAllPresent() {
        setStudents(current =>
            current.map(row => ({
                ...row,
                attendanceStatus:
                    'present',
                attendanceCode: '',
                attendanceNote: ''
            }))
        );
    }

    function toggleAttendance(
        row: StudentEditorRow
    ) {
        const willBeAbsent =
            row.attendanceStatus ===
            'present';

        updateStudent(
            row.student.id,
            {
                attendanceStatus:
                    willBeAbsent
                        ? 'absent'
                        : 'present',
                attendanceCode:
                    willBeAbsent
                        ? row.attendanceCode ||
                          'F'
                        : '',
                attendanceNote:
                    willBeAbsent
                        ? row.attendanceNote
                        : ''
            }
        );
    }

    function changeCriterionScore(
        row: StudentEditorRow,
        criterionId: EntityId,
        value: string
    ) {
        const normalizedValue =
            normalizeDailyCriterionScoreInput(
                value
            );

        updateStudent(
            row.student.id,
            {
                criterionScores: {
                    ...row.criterionScores,
                    [criterionId]:
                        normalizedValue
                }
            }
        );
    }

    function focusNextQuickGrade(
        currentIndex: number
    ) {
        for (
            let index = currentIndex + 1;
            index <
            quickGradeInputRefs.current
                .length;
            index += 1
        ) {
            const input =
                quickGradeInputRefs.current[
                    index
                ];

            if (
                input &&
                !input.disabled
            ) {
                input.focus();
                input.select();
                return;
            }
        }
    }

    return (
        <main className="min-h-[calc(100vh-58px)] bg-slate-950 px-3 py-2 text-white sm:px-5 lg:px-7">
            <div className="mx-auto max-w-[1600px] space-y-2">
                <section className="rounded-2xl border border-white/10 bg-slate-900/70 p-2.5 shadow-xl shadow-black/15">
                    <div className="flex flex-col gap-2 lg:flex-row lg:items-center lg:justify-between">
                        <div className="flex min-w-0 items-center gap-2">
                            <button
                                type="button"
                                onClick={() =>
                                    void changeDate(
                                        workspace?.previousWeekDate ??
                                            addDays(
                                                date,
                                                -7
                                            )
                                    )
                                }
                                disabled={
                                    loading ||
                                    saving
                                }
                                className="grid h-8 w-8 shrink-0 place-items-center rounded-lg border border-white/10 bg-white/[0.04] text-base font-black text-slate-200 transition hover:border-cyan-300/30 hover:text-white disabled:opacity-40"
                                aria-label="Semana anterior"
                            >
                                ‹
                            </button>

                            <div className="min-w-0 flex-1">
                                <p className="text-[0.58rem] font-black uppercase tracking-[0.16em] text-cyan-300">
                                    Semana
                                </p>

                                <h1 className="truncate text-sm font-black capitalize sm:text-base">
                                    {workspace
                                        ? formatWeekRange(
                                              workspace.weekStartDate,
                                              workspace.weekEndDate
                                          )
                                        : 'A preparar…'}
                                </h1>
                            </div>

                            <button
                                type="button"
                                onClick={() =>
                                    void changeDate(
                                        workspace?.nextWeekDate ??
                                            addDays(
                                                date,
                                                7
                                            )
                                    )
                                }
                                disabled={
                                    loading ||
                                    saving
                                }
                                className="grid h-8 w-8 shrink-0 place-items-center rounded-lg border border-white/10 bg-white/[0.04] text-base font-black text-slate-200 transition hover:border-cyan-300/30 hover:text-white disabled:opacity-40"
                                aria-label="Semana seguinte"
                            >
                                ›
                            </button>
                        </div>

                        <div className="flex flex-wrap gap-2">
                            <input
                                type="date"
                                value={date}
                                onChange={event => {
                                    if (
                                        event.target
                                            .value
                                    ) {
                                        void changeDate(
                                            event
                                                .target
                                                .value
                                        );
                                    }
                                }}
                                disabled={
                                    loading ||
                                    saving
                                }
                                className="min-w-0 flex-1 rounded-lg border border-white/10 bg-slate-950 px-2.5 py-1.5 text-xs font-bold text-white outline-none focus:border-cyan-300/50 disabled:opacity-50 sm:flex-none"
                            />

                            <button
                                type="button"
                                onClick={() =>
                                    void changeDate(
                                        todayISO()
                                    )
                                }
                                disabled={
                                    loading ||
                                    saving
                                }
                                className="rounded-lg bg-cyan-300 px-3 py-1.5 text-xs font-black text-slate-950 transition hover:brightness-110 disabled:opacity-40"
                            >
                                Hoje
                            </button>

                            <button
                                type="button"
                                onClick={() =>
                                    setShowWeekOverview(
                                        current =>
                                            !current
                                    )
                                }
                                className="rounded-lg border border-white/10 bg-white/[0.04] px-3 py-1.5 text-xs font-black text-slate-300 transition hover:border-cyan-300/30 hover:text-white"
                            >
                                {showWeekOverview
                                    ? 'Recolher semana'
                                    : 'Mostrar semana'}
                            </button>
                        </div>
                    </div>

                    {showWeekOverview ? (
                        <div className="mt-2 max-h-44 overflow-auto rounded-xl border border-white/10 bg-slate-950/40">
                            <div className="min-w-[760px]">
                                <div className="sticky top-0 z-10 grid grid-cols-[5.25rem_repeat(5,minmax(0,1fr))] border-b border-white/10 bg-slate-900/95 backdrop-blur">
                                    <div className="flex items-center justify-center border-r border-white/10 px-1.5 py-1.5 text-[0.56rem] font-black uppercase tracking-[0.1em] text-slate-500">
                                        Hora
                                    </div>

                                    {workspace?.weekDays.map(
                                        day => {
                                            const selected =
                                                day.date ===
                                                date;

                                            return (
                                                <button
                                                    key={
                                                        day.date
                                                    }
                                                    type="button"
                                                    onClick={() =>
                                                        void changeDate(
                                                            day.date
                                                        )
                                                    }
                                                    disabled={
                                                        loading ||
                                                        saving
                                                    }
                                                    className={`border-r border-white/10 px-1.5 py-1.5 text-center text-[0.64rem] font-black capitalize transition last:border-r-0 ${
                                                        selected
                                                            ? 'bg-cyan-300/10 text-cyan-100'
                                                            : day.isToday
                                                              ? 'text-cyan-200 hover:bg-white/[0.04]'
                                                              : 'text-slate-300 hover:bg-white/[0.04] hover:text-white'
                                                    }`}
                                                >
                                                    {formatShortWeekday(
                                                        day.date
                                                    )}
                                                </button>
                                            );
                                        }
                                    )}
                                </div>

                                {weekTimeSlots.map(
                                    slot => (
                                        <div
                                            key={
                                                slot.startTime
                                            }
                                            className="grid grid-cols-[5.25rem_repeat(5,minmax(0,1fr))] border-b border-white/10 last:border-b-0"
                                        >
                                            <div className="flex items-center justify-center border-r border-white/10 bg-slate-900/35 px-1 py-1 text-center text-[0.58rem] font-black leading-tight text-slate-300">
                                                {
                                                    slot.startTime
                                                }

                                                <span className="mx-0.5 text-slate-600">
                                                    –
                                                </span>

                                                {
                                                    slot.endTime
                                                }
                                            </div>

                                            {workspace?.weekDays.map(
                                                day => {
                                                    const lessons =
                                                        day.lessons.filter(
                                                            row =>
                                                                row
                                                                    .lesson
                                                                    .startTime ===
                                                                slot.startTime
                                                        );

                                                    return (
                                                        <div
                                                            key={`${day.date}-${slot.startTime}`}
                                                            className={`min-h-9 border-r border-white/10 p-0.5 last:border-r-0 ${
                                                                day.date ===
                                                                date
                                                                    ? 'bg-cyan-300/[0.025]'
                                                                    : ''
                                                            }`}
                                                        >
                                                            <div className="space-y-0.5">
                                                                {lessons.map(
                                                                    row => {
                                                                        const active =
                                                                            workspace.selectedLessonId ===
                                                                            row
                                                                                .lesson
                                                                                .id;

                                                                        const cancelled =
                                                                            row
                                                                                .lesson
                                                                                .status ===
                                                                            'cancelled';

                                                                        return (
                                                                            <button
                                                                                key={
                                                                                    row
                                                                                        .lesson
                                                                                        .id
                                                                                }
                                                                                type="button"
                                                                                onClick={() =>
                                                                                    void selectLesson(
                                                                                        day.date,
                                                                                        row
                                                                                            .lesson
                                                                                            .id
                                                                                    )
                                                                                }
                                                                                disabled={
                                                                                    loading ||
                                                                                    saving
                                                                                }
                                                                                title={`${row.group.name} · ${getSubjectLabel(
                                                                                    row
                                                                                        .subject
                                                                                        .shortName,
                                                                                    row
                                                                                        .subject
                                                                                        .name
                                                                                )} · ${
                                                                                    row
                                                                                        .module
                                                                                        .code ||
                                                                                    row
                                                                                        .module
                                                                                        .name
                                                                                }`}
                                                                                className={`w-full rounded-md border px-1.5 py-0.5 text-left leading-tight transition disabled:opacity-50 ${
                                                                                    active
                                                                                        ? 'border-cyan-300/60 bg-cyan-300/15'
                                                                                        : cancelled
                                                                                          ? 'border-rose-300/20 bg-rose-300/[0.06] opacity-70'
                                                                                          : 'border-white/10 bg-slate-900/65 hover:border-cyan-300/30 hover:bg-cyan-300/[0.055]'
                                                                                }`}
                                                                            >
                                                                                <span
                                                                                    className={`block truncate text-[0.61rem] font-black ${
                                                                                        active
                                                                                            ? 'text-cyan-100'
                                                                                            : cancelled
                                                                                              ? 'text-rose-100'
                                                                                              : 'text-white'
                                                                                    }`}
                                                                                >
                                                                                    {
                                                                                        row
                                                                                            .group
                                                                                            .name
                                                                                    }{' '}
                                                                                    ·{' '}
                                                                                    {getSubjectLabel(
                                                                                        row
                                                                                            .subject
                                                                                            .shortName,
                                                                                        row
                                                                                            .subject
                                                                                            .name
                                                                                    )}
                                                                                </span>

                                                                                <span className="block truncate text-[0.55rem] font-semibold text-slate-500">
                                                                                    {row
                                                                                        .module
                                                                                        .code ||
                                                                                        row
                                                                                            .module
                                                                                            .name}
                                                                                </span>
                                                                            </button>
                                                                        );
                                                                    }
                                                                )}
                                                            </div>
                                                        </div>
                                                    );
                                                }
                                            )}
                                        </div>
                                    )
                                )}

                                {!loading &&
                                weekTimeSlots.length ===
                                    0 ? (
                                    <div className="px-4 py-5 text-center text-xs text-slate-500">
                                        Não existem
                                        aulas nesta
                                        semana.
                                    </div>
                                ) : null}
                            </div>
                        </div>
                    ) : null}

                    <div className="mt-1.5 flex flex-col gap-1 text-[0.66rem] sm:flex-row sm:items-center sm:justify-between">
                        <p className="text-slate-500">
                            Selecione uma aula
                            na semana e trabalhe
                            no painel abaixo.
                        </p>

                        {hasUnsavedChanges ? (
                            <p className="font-black text-amber-200">
                                Alterações por
                                guardar.
                            </p>
                        ) : lessonRow ? (
                            <p className="font-bold text-emerald-200">
                                Aula guardada.
                            </p>
                        ) : null}
                    </div>
                </section>

                {loading &&
                !lessonRow ? (
                    <section className="rounded-2xl border border-white/10 bg-slate-900/60 px-5 py-10 text-center">
                        <div className="mx-auto h-8 w-8 animate-spin rounded-full border-4 border-cyan-300/20 border-t-cyan-300" />

                        <p className="mt-3 text-sm font-semibold text-slate-400">
                            A preparar a
                            aula…
                        </p>
                    </section>
                ) : null}

                {lessonRow &&
                lessonForm &&
                assessmentForm &&
                selectedLesson ? (
                    <article className="overflow-hidden rounded-2xl border border-white/10 bg-slate-900/60 shadow-xl shadow-black/15">
                        <header className="border-b border-white/10 bg-slate-900 px-4 py-2.5 sm:px-5">
                            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                                <div className="min-w-0">
                                    <div className="flex flex-wrap items-center gap-2">
                                        <h2 className="text-base font-black sm:text-lg">
                                            {
                                                lessonRow
                                                    .group
                                                    .name
                                            }{' '}
                                            ·{' '}
                                            {getSubjectLabel(
                                                lessonRow
                                                    .subject
                                                    .shortName,
                                                lessonRow
                                                    .subject
                                                    .name
                                            )}
                                        </h2>

                                        <span
                                            className={`rounded-full border px-2 py-0.5 text-[0.58rem] font-black uppercase tracking-[0.1em] ${lessonStatusClasses(
                                                lessonForm.status
                                            )}`}
                                        >
                                            {lessonStatusLabel(
                                                lessonForm.status
                                            )}
                                        </span>
                                    </div>

                                    <p className="mt-0.5 truncate text-[0.7rem] font-semibold text-slate-400">
                                        {getModuleLabel(
                                            lessonRow
                                                .module
                                                .code,
                                            lessonRow
                                                .module
                                                .name
                                        )}{' '}
                                        ·{' '}
                                        {
                                            lessonForm.startTime
                                        }
                                        –
                                        {
                                            lessonForm.endTime
                                        }{' '}
                                        ·{' '}
                                        {
                                            lessonForm.periodCount
                                        }{' '}
                                        {lessonForm.periodCount ===
                                        '1'
                                            ? 'tempo'
                                            : 'tempos'}
                                    </p>
                                </div>

                                <button
                                    type="button"
                                    onClick={() =>
                                        setShowAdvanced(
                                            current =>
                                                !current
                                        )
                                    }
                                    className={`shrink-0 rounded-lg border px-3 py-1.5 text-xs font-black transition ${
                                        showAdvanced
                                            ? 'border-cyan-300/40 bg-cyan-300/10 text-cyan-100'
                                            : 'border-white/10 bg-white/[0.04] text-slate-300 hover:border-cyan-300/30 hover:text-white'
                                    }`}
                                >
                                    {showAdvanced
                                        ? 'Fechar opções'
                                        : 'Mais opções'}
                                </button>
                            </div>
                        </header>

                        <div className="p-3 sm:p-4">
                            {lessonForm.status ===
                            'cancelled' ? (
                                <div className="mb-3 rounded-xl border border-rose-300/20 bg-rose-300/10 px-4 py-2.5 text-sm font-bold text-rose-100">
                                    Esta aula está
                                    cancelada. Pode
                                    alterar o estado
                                    em “Mais opções”.
                                </div>
                            ) : null}

                            {lessonIsFuture ? (
                                <div className="mb-3 rounded-xl border border-amber-300/25 bg-amber-300/10 px-4 py-2.5 text-sm font-bold text-amber-100">
                                    🚨 Esta aula está marcada para uma data futura. Pode registar a avaliação; confirme apenas que está a trabalhar na aula correta.
                                </div>
                            ) : null}

                            <div className="grid gap-3 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)] lg:items-stretch">
                                <section className="flex min-h-0 flex-col overflow-hidden rounded-xl border border-white/10 bg-slate-950/55 lg:h-[25rem]">
                                    <div className="flex flex-col gap-2 border-b border-white/10 px-3 py-2.5 sm:flex-row sm:items-start sm:justify-between">
                                        <div>
                                            <p className="text-[0.6rem] font-black uppercase tracking-[0.15em] text-cyan-300">
                                                Sumário
                                            </p>

                                            <div className="mt-0.5 flex flex-wrap items-center gap-2">
                                                <span
                                                    className={`text-[0.78rem] font-bold ${
                                                        hasUnsavedChanges
                                                            ? 'text-amber-200'
                                                            : 'text-emerald-200'
                                                    }`}
                                                >
                                                    {hasUnsavedChanges
                                                        ? 'Por guardar'
                                                        : 'Guardado'}
                                                </span>
                                            </div>
                                        </div>

                                        <div className="flex flex-wrap gap-1.5">
                                            <button
                                                type="button"
                                                onClick={
                                                    useNextPlanificationItem
                                                }
                                                disabled={
                                                    saving ||
                                                    !selectedLesson
                                                        .context
                                                        .nextPlanificationItem ||
                                                    lessonForm.status ===
                                                        'cancelled'
                                                }
                                                className="rounded-lg border border-cyan-300/20 bg-cyan-300/10 px-2.5 py-1.5 text-[0.68rem] font-black text-cyan-100 transition hover:border-cyan-300/40 disabled:cursor-not-allowed disabled:opacity-35"
                                            >
                                                Planificação
                                            </button>

                                            <button
                                                type="button"
                                                onClick={
                                                    copyPreviousLesson
                                                }
                                                disabled={
                                                    saving ||
                                                    !selectedLesson
                                                        .context
                                                        .previousLessonTemplate ||
                                                    lessonForm.status ===
                                                        'cancelled'
                                                }
                                                className="rounded-lg border border-white/10 bg-white/[0.04] px-2.5 py-1.5 text-[0.68rem] font-black text-slate-200 transition hover:border-white/20 disabled:cursor-not-allowed disabled:opacity-35"
                                            >
                                                Copiar
                                                anterior
                                            </button>

                                            <button
                                                type="button"
                                                onClick={() =>
                                                    void saveAll()
                                                }
                                                disabled={
                                                    loading ||
                                                    saving ||
                                                    !hasUnsavedChanges
                                                }
                                                className="rounded-lg bg-cyan-300 px-3 py-1.5 text-[0.68rem] font-black text-slate-950 transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-40"
                                            >
                                                {saving
                                                    ? 'A guardar…'
                                                    : hasUnsavedChanges
                                                      ? 'Guardar'
                                                      : 'Guardado'}
                                            </button>
                                        </div>
                                    </div>

                                    <div className="flex min-h-0 flex-1 flex-col p-3">
                                        <textarea
                                            value={
                                                lessonForm.summary
                                            }
                                            onChange={event => {
                                                const value =
                                                    event
                                                        .target
                                                        .value;

                                                setLessonForm(
                                                    current =>
                                                        current
                                                            ? {
                                                                  ...current,
                                                                  summary:
                                                                      value,
                                                                  summarySource:
                                                                      'manual',
                                                                  status:
                                                                      current.status ===
                                                                          'planned' &&
                                                                      value.trim()
                                                                          ? 'taught'
                                                                          : current.status,
                                                                  giaeStatus:
                                                                      resolveGIAEStatusAfterSummaryChange(
                                                                          current.giaeStatus,
                                                                          current.summary,
                                                                          value
                                                                      )
                                                              }
                                                            : current
                                                );
                                            }}
                                            disabled={
                                                saving ||
                                                lessonForm.status ===
                                                    'cancelled'
                                            }
                                            rows={5}
                                            placeholder="Escreva o sumário da aula…"
                                            className={`${inputClassName} min-h-36 flex-1 resize-none text-sm leading-6`}
                                        />

                                        <div className="mt-2 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                                            <p className="text-[0.68rem] leading-4 text-slate-500">
                                                Ao escrever
                                                um sumário,
                                                a aula passa
                                                a dada quando
                                                guardar.
                                            </p>

                                            <div className="flex flex-wrap items-center justify-end gap-2">
                                                <button
                                                    type="button"
                                                    onClick={() =>
                                                        void handleCopySummary()
                                                    }
                                                    disabled={
                                                        saving ||
                                                        lessonForm.status ===
                                                            'cancelled' ||
                                                        !lessonForm.summary.trim()
                                                    }
                                                    className="inline-flex items-center gap-2 rounded-lg border border-white/10 bg-white/[0.04] px-3 py-1.5 text-[0.68rem] font-black text-slate-200 transition hover:border-cyan-300/30 hover:text-white disabled:cursor-not-allowed disabled:opacity-35"
                                                >
                                                    <svg
                                                        aria-hidden="true"
                                                        viewBox="0 0 24 24"
                                                        className="h-4 w-4"
                                                        fill="none"
                                                        stroke="currentColor"
                                                        strokeWidth="2"
                                                        strokeLinecap="round"
                                                        strokeLinejoin="round"
                                                    >
                                                        <rect
                                                            x="9"
                                                            y="9"
                                                            width="11"
                                                            height="11"
                                                            rx="2"
                                                        />
                                                        <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                                                    </svg>

                                                    Copiar
                                                </button>

                                                <label
                                                    title="O estado é atualizado automaticamente depois de copiar o sumário."
                                                    className="flex shrink-0 items-center gap-2 rounded-lg border border-white/10 bg-white/[0.03] px-2.5 py-1.5 text-[0.68rem] font-bold text-slate-300"
                                                >
                                                    <input
                                                        type="checkbox"
                                                        checked={
                                                            lessonForm.giaeStatus ===
                                                            'submitted'
                                                        }
                                                        disabled
                                                        readOnly
                                                        aria-label="Estado de submissão no GIAE"
                                                        className="h-4 w-4 accent-cyan-300 disabled:opacity-100"
                                                    />

                                                    Submetido no
                                                    GIAE
                                                </label>
                                            </div>
                                        </div>
                                    </div>
                                </section>

                                <section className="flex min-h-0 flex-col overflow-hidden rounded-xl border border-white/10 bg-slate-950/55 lg:h-[25rem]">
                                    <div className="flex flex-col gap-2 border-b border-white/10 px-3 py-2.5 sm:flex-row sm:items-center sm:justify-between">
                                        <div className="min-w-0">
                                            <div className="flex flex-wrap items-center gap-2">
                                                <p className="text-[0.6rem] font-black uppercase tracking-[0.15em] text-cyan-300">
                                                    Alunos
                                                </p>

                                                <span className="text-[0.66rem] font-semibold text-slate-500">
                                                    {
                                                        presentCount
                                                    }{' '}
                                                    presentes
                                                    ·{' '}
                                                    {
                                                        absentCount
                                                    }{' '}
                                                    faltas
                                                </span>
                                            </div>

                                            <h3 className="mt-0.5 text-sm font-black">
                                                Faltas e
                                                avaliação
                                            </h3>
                                        </div>

                                        <div className="flex flex-wrap gap-1.5">
                                            <button
                                                type="button"
                                                onClick={
                                                    markAllPresent
                                                }
                                                disabled={
                                                    saving ||
                                                    lessonForm.status ===
                                                        'cancelled'
                                                }
                                                className="rounded-lg border border-white/10 bg-white/[0.04] px-2.5 py-1.5 text-[0.68rem] font-black text-slate-200 transition hover:border-white/20 disabled:opacity-35"
                                            >
                                                Todos
                                                presentes
                                            </button>

                                            <button
                                                type="button"
                                                onClick={() =>
                                                    setShowAssessmentDetails(
                                                        current =>
                                                            !current
                                                    )
                                                }
                                                disabled={
                                                    saving ||
                                                    criteria.length ===
                                                        0
                                                }
                                                className={`rounded-lg border px-2.5 py-1.5 text-[0.68rem] font-black transition disabled:cursor-not-allowed disabled:opacity-35 ${
                                                    showAssessmentDetails
                                                        ? 'border-cyan-300/40 bg-cyan-300/10 text-cyan-100'
                                                        : 'border-white/10 bg-white/[0.04] text-slate-300 hover:border-cyan-300/30 hover:text-white'
                                                }`}
                                            >
                                                {showAssessmentDetails
                                                    ? 'Ocultar atividade'
                                                    : 'Atividade'}
                                            </button>

                                            <button
                                                type="button"
                                                onClick={() =>
                                                    setShowStudentDetails(
                                                        current =>
                                                            !current
                                                    )
                                                }
                                                className="rounded-lg border border-white/10 bg-white/[0.04] px-2.5 py-1.5 text-[0.68rem] font-black text-slate-300 transition hover:border-cyan-300/30 hover:text-white"
                                            >
                                                {showStudentDetails
                                                    ? 'Ocultar detalhes'
                                                    : 'Detalhes'}
                                            </button>
                                        </div>
                                    </div>

                                    {criteria.length ===
                                    0 ? (
                                        <div className="border-b border-amber-300/20 bg-amber-300/10 px-3 py-2 text-xs font-bold text-amber-100">
                                            Ainda não
                                            existem
                                            critérios de
                                            avaliação para
                                            esta disciplina
                                            ou UFCD. Pode
                                            criá-los no
                                            Menu.
                                        </div>
                                    ) : null}

                                    {showAssessmentDetails &&
                                    assessmentForm ? (
                                        <div className="border-b border-cyan-300/15 bg-cyan-300/[0.04] px-3 py-2.5">
                                            <label className="block text-[0.66rem] font-bold text-slate-400">
                                                Atividade avaliada · opcional

                                                <input
                                                    type="text"
                                                    value={
                                                        assessmentForm.description
                                                    }
                                                    onChange={event =>
                                                        setAssessmentForm(
                                                            current =>
                                                                current
                                                                    ? {
                                                                          ...current,
                                                                          description:
                                                                              event
                                                                                  .target
                                                                                  .value
                                                                      }
                                                                    : current
                                                        )
                                                    }
                                                    disabled={
                                                        saving
                                                    }
                                                    placeholder="Se ficar vazio, usa o sumário da aula"
                                                    className={`${compactInputClassName} mt-1`}
                                                />
                                            </label>
                                        </div>
                                    ) : null}

                                    <div className="min-h-0 flex-1 overflow-auto">
                                        <div
                                            className="sticky top-0 z-10 grid items-center gap-1.5 border-b border-white/10 bg-slate-900/95 px-2.5 py-1.5 text-[0.58rem] font-black uppercase tracking-[0.08em] text-slate-500"
                                            style={{
                                                gridTemplateColumns:
                                                    criteriaGridTemplate,
                                                minWidth:
                                                    criteriaGridMinWidth
                                            }}
                                        >
                                            <span className="text-center">
                                                N.º
                                            </span>

                                            <span>
                                                Aluno
                                            </span>

                                            <span className="text-center">
                                                Falta
                                            </span>

                                            {criteria.map(
                                                criterion => (
                                                    <span
                                                        key={
                                                            criterion.id
                                                        }
                                                        title={`${criterion.name} · ${criterion.weightPercent}%`}
                                                        className="min-w-0 text-center"
                                                    >
                                                        <span className="block truncate">
                                                            {
                                                                criterion.name
                                                            }
                                                        </span>
                                                        <span className="block text-[0.52rem] font-semibold normal-case tracking-normal text-slate-600">
                                                            {
                                                                criterion.weightPercent
                                                            }
                                                            %
                                                        </span>
                                                    </span>
                                                )
                                            )}

                                            <span className="text-center">
                                                Média
                                            </span>
                                        </div>

                                        <div className="divide-y divide-white/10">
                                            {students.map(
                                                (
                                                    row,
                                                    index
                                                ) => {
                                                    const absencePercent =
                                                        row
                                                            .absenceSummary
                                                            ?.absencePercent ??
                                                        null;

                                                    const hasAbsenceWarning =
                                                        absencePercent !==
                                                            null &&
                                                        absencePercent >=
                                                            10;

                                                    return (
                                                        <div
                                                            key={
                                                                row
                                                                    .student
                                                                    .id
                                                            }
                                                        >
                                                            <div
                                                                className="grid items-center gap-1.5 px-2.5 py-1.5"
                                                                style={{
                                                                    gridTemplateColumns:
                                                                        criteriaGridTemplate,
                                                                    minWidth:
                                                                        criteriaGridMinWidth
                                                                }}
                                                            >
                                                                <span className="text-center text-xs font-black text-slate-500">
                                                                    {row
                                                                        .student
                                                                        .number ||
                                                                        index +
                                                                            1}
                                                                </span>

                                                                <div className="min-w-0">
                                                                    <p className="truncate text-xs font-black text-white">
                                                                        {
                                                                            row
                                                                                .student
                                                                                .name
                                                                        }
                                                                    </p>

                                                                    {(hasAbsenceWarning ||
                                                                        row.provisionalAverage !==
                                                                            null) && (
                                                                        <p className="truncate text-[0.58rem] font-semibold text-slate-500">
                                                                            {row.provisionalAverage !==
                                                                            null
                                                                                ? `Média UFCD ${formatScore(
                                                                                      row.provisionalAverage
                                                                                  )}`
                                                                                : ''}

                                                                            {row.provisionalAverage !==
                                                                                null &&
                                                                            hasAbsenceWarning
                                                                                ? ' · '
                                                                                : ''}

                                                                            {hasAbsenceWarning
                                                                                ? `Faltas ${formatPercent(
                                                                                      absencePercent
                                                                                  )}`
                                                                                : ''}
                                                                        </p>
                                                                    )}
                                                                </div>

                                                                <button
                                                                    type="button"
                                                                    onClick={() =>
                                                                        toggleAttendance(
                                                                            row
                                                                        )
                                                                    }
                                                                    disabled={
                                                                        saving ||
                                                                        lessonForm.status ===
                                                                            'cancelled'
                                                                    }
                                                                    aria-pressed={
                                                                        row.attendanceStatus ===
                                                                        'absent'
                                                                    }
                                                                    className={`rounded-md border px-1.5 py-1 text-[0.68rem] font-black transition disabled:opacity-35 ${
                                                                        row.attendanceStatus ===
                                                                        'absent'
                                                                            ? 'border-rose-300/40 bg-rose-300/15 text-rose-100'
                                                                            : 'border-white/10 bg-white/[0.04] text-slate-400 hover:border-rose-300/30 hover:text-rose-100'
                                                                    }`}
                                                                >
                                                                    {row.attendanceStatus ===
                                                                    'absent'
                                                                        ? 'F'
                                                                        : '—'}
                                                                </button>

                                                                {criteria.map(
                                                                    (
                                                                        criterion,
                                                                        criterionIndex
                                                                    ) => {
                                                                        const inputIndex =
                                                                            index *
                                                                                criteria.length +
                                                                            criterionIndex;
                                                                        const absent =
                                                                            row.attendanceStatus ===
                                                                            'absent';

                                                                        return (
                                                                            <input
                                                                                key={
                                                                                    criterion.id
                                                                                }
                                                                                ref={element => {
                                                                                    quickGradeInputRefs.current[
                                                                                        inputIndex
                                                                                    ] =
                                                                                        element;
                                                                                }}
                                                                                data-daily-quick-grade-input="true"
                                                                                data-criterion-id={
                                                                                    criterion.id
                                                                                }
                                                                                type="text"
                                                                                inputMode="decimal"
                                                                                value={
                                                                                    absent
                                                                                        ? ''
                                                                                        : row.criterionScores[
                                                                                              criterion.id
                                                                                          ] ??
                                                                                          '10'
                                                                                }
                                                                                onChange={event =>
                                                                                    changeCriterionScore(
                                                                                        row,
                                                                                        criterion.id,
                                                                                        event
                                                                                            .target
                                                                                            .value
                                                                                    )
                                                                                }
                                                                                onKeyDown={event => {
                                                                                    if (
                                                                                        event.key ===
                                                                                            'Enter' ||
                                                                                        event.key ===
                                                                                            'ArrowDown'
                                                                                    ) {
                                                                                        event.preventDefault();
                                                                                        focusNextQuickGrade(
                                                                                            inputIndex
                                                                                        );
                                                                                    }
                                                                                }}
                                                                                disabled={
                                                                                    saving ||
                                                                                    lessonForm.status ===
                                                                                        'cancelled' ||
                                                                                    absent
                                                                                }
                                                                                placeholder={
                                                                                    absent
                                                                                        ? '—'
                                                                                        : '10'
                                                                                }
                                                                                aria-label={`${criterion.name} de ${row.student.name}`}
                                                                                className="w-full min-w-0 rounded-md border border-white/10 bg-slate-950 px-1.5 py-1 text-center text-[0.68rem] font-black text-white outline-none transition placeholder:text-slate-600 focus:border-cyan-300/55 focus:ring-2 focus:ring-cyan-300/10 disabled:cursor-not-allowed disabled:opacity-45"
                                                                            />
                                                                        );
                                                                    }
                                                                )}

                                                                <span className="rounded-md border border-white/10 bg-white/[0.035] px-1.5 py-1 text-center text-[0.68rem] font-black text-cyan-100">
                                                                    {row.attendanceStatus ===
                                                                    'absent'
                                                                        ? '—'
                                                                        : formatScore(
                                                                              calculateDailyCriteriaAverage(
                                                                                  row.criterionScores,
                                                                                  criteria
                                                                              )
                                                                          )}
                                                                </span>
                                                            </div>

                                                            {showStudentDetails ? (
                                                                <div
                                                                    className="grid gap-2 border-t border-white/[0.06] bg-white/[0.02] px-2.5 py-2 sm:grid-cols-2"
                                                                    style={{
                                                                        minWidth:
                                                                            criteriaGridMinWidth
                                                                    }}
                                                                >
                                                                    <label className="text-[0.62rem] font-bold text-slate-500">
                                                                        Código da
                                                                        falta

                                                                        <input
                                                                            type="text"
                                                                            value={
                                                                                row.attendanceCode
                                                                            }
                                                                            onChange={event =>
                                                                                updateStudent(
                                                                                    row
                                                                                        .student
                                                                                        .id,
                                                                                    {
                                                                                        attendanceCode:
                                                                                            event
                                                                                                .target
                                                                                                .value
                                                                                    }
                                                                                )
                                                                            }
                                                                            disabled={
                                                                                saving ||
                                                                                row.attendanceStatus !==
                                                                                    'absent' ||
                                                                                lessonForm.status ===
                                                                                    'cancelled'
                                                                            }
                                                                            placeholder="F"
                                                                            className={`${compactInputClassName} mt-1`}
                                                                        />
                                                                    </label>

                                                                    <label className="text-[0.62rem] font-bold text-slate-500">
                                                                        Observação
                                                                        da falta

                                                                        <input
                                                                            type="text"
                                                                            value={
                                                                                row.attendanceNote
                                                                            }
                                                                            onChange={event =>
                                                                                updateStudent(
                                                                                    row
                                                                                        .student
                                                                                        .id,
                                                                                    {
                                                                                        attendanceNote:
                                                                                            event
                                                                                                .target
                                                                                                .value
                                                                                    }
                                                                                )
                                                                            }
                                                                            disabled={
                                                                                saving ||
                                                                                row.attendanceStatus !==
                                                                                    'absent' ||
                                                                                lessonForm.status ===
                                                                                    'cancelled'
                                                                            }
                                                                            placeholder="Motivo ou nota"
                                                                            className={`${compactInputClassName} mt-1`}
                                                                        />
                                                                    </label>
                                                                </div>
                                                            ) : null}
                                                        </div>
                                                    );
                                                }
                                            )}

                                            {students.length ===
                                            0 ? (
                                                <div className="px-4 py-8 text-center text-sm text-slate-500">
                                                    Esta turma
                                                    ainda não
                                                    possui
                                                    alunos
                                                    ativos.
                                                </div>
                                            ) : null}
                                        </div>
                                    </div>
                                </section>
                            </div>
                            {showAdvanced ? (
                                <section className="mt-3 rounded-xl border border-amber-300/20 bg-amber-300/[0.05] p-4">
                                    <p className="text-[0.62rem] font-black uppercase tracking-[0.16em] text-amber-300">
                                        Opções menos
                                        frequentes
                                    </p>

                                    <h3 className="mt-1 text-base font-black">
                                        Estado,
                                        horário e notas
                                        internas
                                    </h3>

                                    <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                                        <label className="text-xs font-bold text-slate-400">
                                            Estado da
                                            aula

                                            <select
                                                value={
                                                    lessonForm.status
                                                }
                                                onChange={event =>
                                                    updateLessonForm(
                                                        'status',
                                                        event
                                                            .target
                                                            .value as LessonStatus
                                                    )
                                                }
                                                disabled={
                                                    saving
                                                }
                                                className={`${inputClassName} mt-1.5`}
                                            >
                                                <option value="planned">
                                                    Planeada
                                                </option>

                                                <option value="taught">
                                                    Dada
                                                </option>

                                                <option value="cancelled">
                                                    Cancelada
                                                </option>
                                            </select>
                                        </label>

                                        <label className="text-xs font-bold text-slate-400">
                                            Hora de
                                            início

                                            <input
                                                type="time"
                                                value={
                                                    lessonForm.startTime
                                                }
                                                onChange={event =>
                                                    updateLessonForm(
                                                        'startTime',
                                                        event
                                                            .target
                                                            .value
                                                    )
                                                }
                                                disabled={
                                                    saving
                                                }
                                                className={`${inputClassName} mt-1.5`}
                                            />
                                        </label>

                                        <label className="text-xs font-bold text-slate-400">
                                            Hora de
                                            fim

                                            <input
                                                type="time"
                                                value={
                                                    lessonForm.endTime
                                                }
                                                onChange={event =>
                                                    updateLessonForm(
                                                        'endTime',
                                                        event
                                                            .target
                                                            .value
                                                    )
                                                }
                                                disabled={
                                                    saving
                                                }
                                                className={`${inputClassName} mt-1.5`}
                                            />
                                        </label>

                                        <label className="text-xs font-bold text-slate-400">
                                            Número de
                                            tempos

                                            <input
                                                type="number"
                                                min="1"
                                                step="1"
                                                value={
                                                    lessonForm.periodCount
                                                }
                                                onChange={event =>
                                                    updateLessonForm(
                                                        'periodCount',
                                                        event
                                                            .target
                                                            .value
                                                    )
                                                }
                                                disabled={
                                                    saving
                                                }
                                                className={`${inputClassName} mt-1.5`}
                                            />
                                        </label>
                                    </div>

                                    <label className="mt-4 flex cursor-pointer items-center gap-2 text-sm font-bold text-slate-300">
                                        <input
                                            type="checkbox"
                                            checked={
                                                lessonForm.countTowardProgress
                                            }
                                            onChange={event =>
                                                updateLessonForm(
                                                    'countTowardProgress',
                                                    event
                                                        .target
                                                        .checked
                                                )
                                            }
                                            disabled={
                                                saving ||
                                                lessonForm.status ===
                                                    'cancelled'
                                            }
                                            className="h-4 w-4 accent-cyan-300"
                                        />

                                        Contabilizar
                                        estes tempos no
                                        progresso da
                                        UFCD
                                    </label>

                                    <div className="mt-4 grid gap-3 lg:grid-cols-2">
                                        <label className="text-xs font-bold text-slate-400">
                                            Atividade
                                            prevista

                                            <textarea
                                                value={
                                                    lessonForm.plannedActivity
                                                }
                                                onChange={event =>
                                                    updateLessonForm(
                                                        'plannedActivity',
                                                        event
                                                            .target
                                                            .value
                                                    )
                                                }
                                                disabled={
                                                    saving
                                                }
                                                rows={
                                                    3
                                                }
                                                placeholder="Atividade prevista para esta aula"
                                                className={`${inputClassName} mt-1.5 resize-y`}
                                            />
                                        </label>

                                        <label className="text-xs font-bold text-slate-400">
                                            Nota privada
                                            do professor

                                            <textarea
                                                value={
                                                    lessonForm.notes
                                                }
                                                onChange={event =>
                                                    updateLessonForm(
                                                        'notes',
                                                        event
                                                            .target
                                                            .value
                                                    )
                                                }
                                                disabled={
                                                    saving
                                                }
                                                rows={
                                                    3
                                                }
                                                placeholder="Observações que não fazem parte do sumário"
                                                className={`${inputClassName} mt-1.5 resize-y`}
                                            />
                                        </label>
                                    </div>
                                </section>
                            ) : null}
                        </div>

                        <footer className="flex flex-col gap-2 border-t border-white/10 bg-slate-900/95 px-4 py-2 backdrop-blur-xl sm:flex-row sm:items-center sm:justify-between sm:px-5">
                            <div className="min-h-5 text-xs">
                                {error ? (
                                    <p
                                        role="alert"
                                        className="font-bold text-rose-200"
                                    >
                                        {error}
                                    </p>
                                ) : null}

                                {success ? (
                                    <p className="font-bold text-emerald-200">
                                        {
                                            success
                                        }
                                    </p>
                                ) : null}

                                {!error &&
                                !success ? (
                                    <p
                                        className={
                                            hasPendingSave
                                                ? 'font-bold text-amber-200'
                                                : 'text-slate-500'
                                        }
                                    >
                                        {hasUnsavedChanges
                                            ? 'Existem alterações por guardar.'
                                            : hasCriteriaDefaultsToSave
                                              ? 'A avaliação está pronta com 10 por defeito. Guarde para registar.'
                                              : 'Sumário, faltas e notas estão guardados em conjunto.'}
                                    </p>
                                ) : null}
                            </div>

                            <div className="flex flex-wrap items-center justify-end gap-2">
                                {error &&
                                hasUnsavedChanges ? (
                                    <button
                                        type="button"
                                        onClick={() =>
                                            void downloadEmergencyBackup()
                                        }
                                        disabled={
                                            saving ||
                                            emergencyBackupBusy
                                        }
                                        title="Inclui os dados já guardados e o estado atual ainda não guardado. O ficheiro JSON não está cifrado."
                                        className="rounded-lg border border-amber-300/30 bg-amber-300/10 px-4 py-2 text-sm font-black text-amber-100 transition hover:border-amber-200/50 hover:bg-amber-300/15 disabled:cursor-wait disabled:opacity-50"
                                    >
                                        {emergencyBackupBusy
                                            ? 'A preparar cópia…'
                                            : 'Guardar cópia de segurança'}
                                    </button>
                                ) : null}

                                <button
                                    type="button"
                                    onClick={() =>
                                        void saveAll()
                                    }
                                    disabled={
                                        loading ||
                                        saving ||
                                        !hasPendingSave
                                    }
                                    className="rounded-lg bg-cyan-300 px-5 py-2 text-sm font-black text-slate-950 transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-40"
                                >
                                    {saving
                                        ? 'A guardar…'
                                        : hasPendingSave
                                          ? 'Guardar aula'
                                          : 'Aula guardada'}
                                </button>
                            </div>
                        </footer>
                    </article>
                ) : !loading &&
                  error ? (
                    <section className="rounded-2xl border border-rose-300/20 bg-rose-300/10 px-5 py-8 text-center text-sm font-bold text-rose-100">
                        {error}
                    </section>
                ) : null}
            </div>
        </main>
    );
}