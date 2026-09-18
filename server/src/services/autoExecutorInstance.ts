import { actionQueue } from '../store/actionQueue';
import { AutoExecutor } from './autoExecutor';
import { executeSanction, requestFromAction } from './sanctions';

/** The app's auto executor, listening to the real action queue. */
export const autoExecutor = new AutoExecutor({ actions: actionQueue, execute: executeSanction, requestFromAction });
