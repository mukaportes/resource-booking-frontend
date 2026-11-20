import { ResourceCategory, ResourceType, type Resource } from './types';

export const RESOURCES: readonly Resource[] = [
  {
    id: 'room-1',
    name: 'Room 1',
    type: ResourceType.Room,
    category: ResourceCategory.Room,
    colorToken: 'resource-1',
  },
  {
    id: 'room-2',
    name: 'Room 2',
    type: ResourceType.Room,
    category: ResourceCategory.Room,
    colorToken: 'resource-2',
  },
  {
    id: 'room-3',
    name: 'Room 3',
    type: ResourceType.Room,
    category: ResourceCategory.Room,
    colorToken: 'resource-3',
  },
  {
    id: 'computer-1',
    name: 'Computer 1',
    type: ResourceType.Computer,
    category: ResourceCategory.Equipment,
    colorToken: 'resource-4',
  },
  {
    id: 'computer-2',
    name: 'Computer 2',
    type: ResourceType.Computer,
    category: ResourceCategory.Equipment,
    colorToken: 'resource-5',
  },
  {
    id: 'tablet-1',
    name: 'Tablet 1',
    type: ResourceType.Tablet,
    category: ResourceCategory.Equipment,
    colorToken: 'resource-6',
  },
  {
    id: 'tablet-2',
    name: 'Tablet 2',
    type: ResourceType.Tablet,
    category: ResourceCategory.Equipment,
    colorToken: 'resource-7',
  },
];
