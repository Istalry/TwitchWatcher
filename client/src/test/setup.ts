import '@testing-library/jest-dom';
import { vi } from 'vitest';

// jsdom has no EventSource; useChatStream skips subscribing when it's undefined,
// but anything that constructs one directly needs a harmless stub.
class FakeEventSource {
    onerror: (() => void) | null = null;
    addEventListener() { /* noop */ }
    close() { /* noop */ }
}
vi.stubGlobal('EventSource', FakeEventSource);
