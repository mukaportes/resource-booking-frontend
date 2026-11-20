import { createBookingUseCases } from '../application/use-cases';
import { LocalData } from './repositories/local-data';
import {
  LocalBookingRepository,
  LocalSessionStore,
  LocalUserRepository,
} from './repositories/local-repositories';
import { capture, captureAsync } from './storage/safe-storage';

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
      initialize: async () =>
        capture(() => {
          data.local.probe();
          data.session.probe();
          return data.currentUser(data.read(true).users);
        }),
      exportRawData: async () => capture(() => data.exportRawData()),
      resetLocalData: async () =>
        capture(() => {
          data.reset();
        }),
    },
    clock,
  );
}
