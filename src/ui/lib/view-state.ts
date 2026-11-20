import { RESOURCES, resourceIdSchema, type ResourceId } from '../../domain';
import { toDateInput } from './time';

export type ScheduleView = 'week' | 'day' | 'list';
export interface ViewState {
  view: ScheduleView;
  date: string;
  resourceIds: ResourceId[];
  showCancelled: boolean;
  mine: boolean;
}
export function readViewState(
  search: string,
  mobile = false,
  now = new Date(),
) {
  const params = new URLSearchParams(search);
  const requestedView = params.get('view');
  const requestedDate = params.get('date') ?? '';
  const validDate =
    /^\d{4}-\d{2}-\d{2}$/.test(requestedDate) &&
    Number.isFinite(new Date(`${requestedDate}T12:00:00`).getTime()) &&
    toDateInput(new Date(`${requestedDate}T12:00:00`)) === requestedDate;
  const requestedResources = params.has('resources')
    ? (params.get('resources')?.split(',').filter(Boolean) ?? [])
    : RESOURCES.map((resource) => resource.id);
  const unknownResources = requestedResources.filter(
    (id) => !resourceIdSchema.safeParse(id).success,
  );
  const resourceIds = [
    ...new Set(
      requestedResources.flatMap((id) => {
        const parsed = resourceIdSchema.safeParse(id);
        return parsed.success ? [parsed.data] : [];
      }),
    ),
  ];
  const state: ViewState = {
    view:
      requestedView === 'week' ||
      requestedView === 'day' ||
      requestedView === 'list'
        ? requestedView
        : mobile
          ? 'day'
          : 'week',
    date: validDate ? requestedDate : toDateInput(now),
    resourceIds,
    showCancelled: params.get('showCancelled') === '1',
    mine: params.get('scope') === 'mine',
  };
  return { state, unknownResources };
}
export function writeViewState(state: ViewState, search = '') {
  const params = new URLSearchParams(search);
  params.set('view', state.view);
  params.set('date', state.date);
  params.set('resources', state.resourceIds.join(','));
  if (state.showCancelled) params.set('showCancelled', '1');
  else params.delete('showCancelled');
  if (state.mine) params.set('scope', 'mine');
  else params.delete('scope');
  return `?${params.toString()}`;
}
