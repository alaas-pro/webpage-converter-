// popup.js

document.getElementById('convertToWord').addEventListener('click', () => {
    sendMessageToBackground('convertToWord');
  });
  
  document.getElementById('convertToPDF').addEventListener('click', () => {
    sendMessageToBackground('convertToPDF');
  });
  
  function sendMessageToBackground(action) {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      chrome.runtime.sendMessage({ action, tabId: tabs[0].id }, (response) => {
        if (chrome.runtime.lastError) {
          showStatus('Error: ' + chrome.runtime.lastError.message);
        } else {
          showStatus(response.message || 'Conversion started...');
        }
      });
    });
  }
  
  function showStatus(message) {
    const statusDiv = document.getElementById('status');
    statusDiv.textContent = message;
  }
  