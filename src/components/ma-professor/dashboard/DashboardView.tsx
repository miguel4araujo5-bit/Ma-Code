import {
  type ComponentProps,
  useEffect
} from 'react'
import DashboardDutyPendingPanel from './DashboardDutyPendingPanel'
import DashboardViewBase from './DashboardViewBase'
import {
  getDashboardDataRevision
} from './dashboardRefreshSignal'

let acknowledgedDashboardRevision = 0

type DashboardViewProps =
  ComponentProps<
    typeof DashboardViewBase
  >

export default function DashboardView(
  props: DashboardViewProps
) {
  const dashboardRevision =
    getDashboardDataRevision()

  useEffect(
    () => {
      const revision =
        getDashboardDataRevision()

      if (
        !props.onRefresh ||
        revision <=
          acknowledgedDashboardRevision
      ) {
        return
      }

      acknowledgedDashboardRevision =
        revision

      void Promise.resolve(
        props.onRefresh()
      )
    },
    []
  )

  return (
    <>
      <DashboardDutyPendingPanel
        academicYearId={
          props.snapshot.academicYear.id
        }
        academicYearStartDate={
          props.snapshot.academicYear.startDate
        }
        referenceDate={
          props.snapshot.referenceDate
        }
        refreshToken={
          dashboardRevision
        }
      />

      <DashboardViewBase
        {...props}
      />
    </>
  )
}
