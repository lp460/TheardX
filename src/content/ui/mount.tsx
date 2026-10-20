import { createRoot, type Root } from 'react-dom/client';
import css from './content.css?inline';
import { ContentApp, type PanelActions } from './FloatingPanel';
import type { UiMount } from '../controller';

/**
 * Mounts the React UI (floating panel + toasts) lazily, in one isolated Shadow DOM attached to <html>
 * (outside X's React tree). Nothing is rendered until the UI is first needed.
 */
export function createUiMount(getActions: () => PanelActions): UiMount {
  let host: HTMLElement | null = null;
  let root: Root | null = null;
  return {
    ensure() {
      if (host?.isConnected) return;
      host = document.createElement('threadshelf-root');
      host.style.cssText =
        'all:initial;position:fixed;top:0;left:0;width:0;height:0;z-index:2147483000;';
      const shadow = host.attachShadow({ mode: 'open' });
      const style = document.createElement('style');
      style.textContent = css;
      const container = document.createElement('div');
      shadow.append(style, container);
      document.documentElement.appendChild(host);
      root = createRoot(container);
      root.render(<ContentApp actions={getActions()} />);
    },
    destroy() {
      root?.unmount();
      root = null;
      host?.remove();
      host = null;
    },
  };
}
