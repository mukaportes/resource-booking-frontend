import { createBookingUseCases } from '../application/use-cases';
import { LocalData } from './repositories/local-data';
import {
  LocalBookingRepository,
  LocalSessionStore,
  LocalUserRepository,
} from './repositories/local-repositories';
import { StorageFault, capture, captureAsync } from './storage/safe-storage';

export function createApplication(
  localStorage: Storage,
  sessionStorage: Storage,
  clock: () => number = Date.now,
) {
  const data = new LocalData(localStorage, sessionStorage);
  return createBookingUseCases(
    new LocalBookingRepository(data, clock),
    new LocalUserRepository(data, clock),
    new LocalSessionStore(data),
    {
      run: captureAsync,
      assertWritable: () => data.assertWritable(),
      isReadOnly: () => data.readOnly,
      initialize: async () =>
        capture(() => {
          data.readOnly = false;
          for (const storage of [data.local, data.session]) {
            try {
              storage.probe();
            } catch (error) {
              if (
                !(error instanceof StorageFault) ||
                error.domainError.code !== 'STORAGE_QUOTA_EXCEEDED'
              )
                throw error;
              data.readOnly = true;
            }
          }
          const snapshot = data.read(!data.readOnly);
          const identity = data.currentUser(snapshot.users);
          return data.readOnly ? { ...identity, readOnly: true } : identity;
        }, 'storage.initialize'),
      exportRawData: async () =>
        capture(() => data.exportRawData(), 'storage.export'),
      resetLocalData: async () =>
        capture(() => {
          data.assertWritable();
          data.reset();
        }),
    },
    clock,
  );
}
