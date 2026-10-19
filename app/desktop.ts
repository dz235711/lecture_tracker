declare global {
  interface Window {
    lectureLedgerDesktop?: {
      quit(): void;
      onNavigate(callback: (view: 'overview' | 'schedule' | 'settings') => void): () => void;
    };
  }
}
export const desktop = window.lectureLedgerDesktop;
