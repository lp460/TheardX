/// <reference types="chrome" />
import { repository } from '@/storage/repository';
import { handleMessage, type BackgroundDeps } from './handlers';
import type { ContentMessage } from '@/messaging/protocol';

const deps: BackgroundDeps = {
  repo: repository,
  openTab: async (url) => {
    await chrome.tabs.create({ url });
  },
  extensionUrl: (path) => chrome.runtime.getURL(path),
  extensionId: chrome.runtime.id,
  version: chrome.runtime.getManifest().version,
};

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  // Messages addressed to content scripts are ignored here.
  if (typeof message?.type === 'string' && message.type.startsWith('content.')) return false;
  handleMessage(message, sender, deps).then(sendResponse);
  return true; // async response
});

async function activeTab(): Promise<chrome.tabs.Tab | undefined> {
  const [tab] = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
  return tab;
}

async function sendToTab(tabId: number, msg: ContentMessage): Promise<void> {
  try {
    await chrome.tabs.sendMessage(tabId, msg);
  } catch {
    // No content script on this tab (not an X page, or extension reloaded before the page).
  }
}

chrome.commands?.onCommand.addListener(async (command) => {
  if (command === 'open-library') {
    await chrome.tabs.create({ url: chrome.runtime.getURL('library/index.html') });
    return;
  }
  const tab = await activeTab();
  if (!tab?.id) return;
  if (command === 'save-thread')
    await sendToTab(tab.id, { type: 'content.run', action: 'save-thread' });
  if (command === 'copy-thread')
    await sendToTab(tab.id, { type: 'content.run', action: 'copy-thread' });
});

const STATUS_PATTERNS = [
  'https://x.com/*/status/*',
  'https://twitter.com/*/status/*',
  'https://mobile.x.com/*/status/*',
  'https://mobile.twitter.com/*/status/*',
];
const X_PAGES = [
  'https://x.com/*',
  'https://twitter.com/*',
  'https://mobile.x.com/*',
  'https://mobile.twitter.com/*',
];

function setupContextMenus() {
  if (!chrome.contextMenus) return;
  chrome.contextMenus.removeAll(() => {
    chrome.contextMenus.create({
      id: 'ts-save-link',
      title: 'Enregistrer cette publication dans ThreadShelf',
      contexts: ['link'],
      targetUrlPatterns: STATUS_PATTERNS,
      documentUrlPatterns: X_PAGES,
    });
    chrome.contextMenus.create({
      id: 'ts-save-thread',
      title: 'Enregistrer le thread dans ThreadShelf',
      contexts: ['page', 'selection'],
      documentUrlPatterns: STATUS_PATTERNS,
    });
    chrome.contextMenus.create({
      id: 'ts-open-library',
      title: 'Ouvrir la bibliothèque ThreadShelf',
      contexts: ['action'],
    });
  });
}

chrome.contextMenus?.onClicked.addListener(async (info, tab) => {
  if (info.menuItemId === 'ts-open-library') {
    await chrome.tabs.create({ url: chrome.runtime.getURL('library/index.html') });
    return;
  }
  if (!tab?.id) return;
  if (info.menuItemId === 'ts-save-link' && info.linkUrl)
    await sendToTab(tab.id, { type: 'content.save-link', url: info.linkUrl });
  if (info.menuItemId === 'ts-save-thread')
    await sendToTab(tab.id, { type: 'content.run', action: 'save-thread' });
});

chrome.runtime.onInstalled.addListener((details) => {
  setupContextMenus();
  if (details.reason === 'install') {
    void chrome.tabs.create({ url: chrome.runtime.getURL('library/index.html#welcome') });
  }
});
chrome.runtime.onStartup?.addListener(setupContextMenus);
