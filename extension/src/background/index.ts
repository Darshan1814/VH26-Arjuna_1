/**
 * Arjuna Sarthi - Background Service Worker (Manifest V3).
 *
 * Configures Chrome Side Panel behavior and manages communication lifecycles.
 */

// Enable opening Side Panel on clicking the action toolbar icon where supported
if (chrome.sidePanel && chrome.sidePanel.setPanelBehavior) {
  chrome.sidePanel
    .setPanelBehavior({ openPanelOnActionClick: false })
    .catch((err) => {
      console.warn("Side panel behavior setup:", err);
    });
}

// Extension installation lifecycle
chrome.runtime.onInstalled.addListener((details) => {
  if (details.reason === "install") {
    console.log("Arjuna Sarthi Web Intelligence Extension installed successfully.");
  }
});

// Message hub for tab scripting and injection fallbacks
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === "GET_ACTIVE_TAB") {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs && tabs[0]) {
        sendResponse({ tab: tabs[0] });
      } else {
        sendResponse({ tab: null, error: "No active tab found" });
      }
    });
    return true; // Keep message channel open for async response
  }
});
