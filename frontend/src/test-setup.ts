import '@testing-library/jest-dom';
import { vi } from 'vitest';

// Polyfill global fetch if needed in test environment
if (!globalThis.fetch) {
  // @ts-expect-error test mock
  globalThis.fetch = vi.fn();
}

// Polyfill WebSocket if needed in jsdom
if (!globalThis.WebSocket) {
  // @ts-expect-error test mock
  globalThis.WebSocket = class MockWebSocket {
    onopen: (() => void) | null = null;
    onmessage: ((ev: unknown) => void) | null = null;
    onclose: (() => void) | null = null;
    onerror: ((err: unknown) => void) | null = null;
    readyState = 1;
    send = vi.fn();
    close = vi.fn();
  };
}
