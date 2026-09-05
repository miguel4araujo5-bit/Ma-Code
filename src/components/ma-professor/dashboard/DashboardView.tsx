import {
  type ComponentProps,
  useEffect
} from 'react'
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
    <DashboardViewBase
      {...props}
    />
  )
}
