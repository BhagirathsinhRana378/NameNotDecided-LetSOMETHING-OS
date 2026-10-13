import { WEB_APPS } from './catalog.js';

// Strip frame-blocking headers ONLY for: sub-frames, requested by this extension's own pages,
// to hosts of apps the user has explicitly added. Nothing else in the browser is touched.
async function rebuild() {
  const { customApps = [] } = await chrome.storage.local.get('customApps');
  const hosts = [...new Set([...WEB_APPS, ...customApps]
    .filter(a => a.embed)
    .map(a => new URL(a.url).hostname))];
  await chrome.declarativeNetRequest.updateDynamicRules({
    removeRuleIds: [1],
    addRules: hosts.length ? [{
      id: 1,
      priority: 1,
      action: {
        type: 'modifyHeaders',
        responseHeaders: [
          { header: 'x-frame-options', operation: 'remove' },
          { header: 'content-security-policy', operation: 'remove' }
        ]
      },
      condition: {
        requestDomains: hosts,
        initiatorDomains: [chrome.runtime.id],
        resourceTypes: ['sub_frame']
      }
    }] : []
  });
}

chrome.runtime.onInstalled.addListener(rebuild);
chrome.runtime.onStartup.addListener(rebuild);
chrome.runtime.onMessage.addListener((msg, _s, reply) => {
  if (msg === 'rebuild') { rebuild().then(() => reply(true)); return true; }
});
