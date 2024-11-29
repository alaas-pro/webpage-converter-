// background.js
importScripts('html-docx.js');

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  const { action, tabId } = request;

  if (action === 'convertToWord') {
    // Call the function to convert to Word
    convertToWord(tabId, sendResponse);
    return true; // Indicates asynchronous response
  } else if (action === 'convertToPDF') {
    // Call the function to convert to PDF
    convertToPDF(tabId, sendResponse);
    return true;
  }
});

// Function to convert to Word document
function convertToWord(tabId, sendResponse) {
  // Inject 'html-docx.js' and 'contentScript.js' into the current tab
  chrome.scripting.executeScript(
    {
      target: { tabId },
      files: ['html-docx.js', 'contentScript.js'],
    },
    () => {
      if (chrome.runtime.lastError) {
        console.error('Script injection failed: ' + chrome.runtime.lastError.message);
        sendResponse({ message: 'Failed to inject scripts.' });
        return;
      }

      // Send a message to the content script to start conversion
      chrome.tabs.sendMessage(tabId, { action: 'convertToDocx' }, (response) => {
        if (chrome.runtime.lastError) {
          console.error('Message sending failed: ' + chrome.runtime.lastError.message);
          sendResponse({ message: 'Failed to send message to content script.' });
          return;
        }

        if (response && response.blobUrl) {
          // Use the blob URL to download the file
          chrome.downloads.download(
            {
              url: response.blobUrl,
              filename: 'webpage.docx',
              saveAs: true,
            },
            (downloadId) => {
              if (chrome.runtime.lastError) {
                console.error('Download failed: ' + chrome.runtime.lastError.message);
                sendResponse({ message: 'Download failed.' });
                return;
              }

              // Optionally revoke the blob URL after download
              setTimeout(() => {
                chrome.tabs.sendMessage(tabId, { action: 'revokeBlobUrl', blobUrl: response.blobUrl });
              }, 60000);

              sendResponse({ message: 'Word document downloaded.' });
            }
          );
        } else if (response && response.error) {
          console.error('Error from content script:', response.error);
          sendResponse({ message: 'Error during conversion.' });
        } else {
          console.error('No response or blobUrl received from content script.');
          sendResponse({ message: 'Conversion failed.' });
        }
      });
    }
  );
}

// Function to convert to PDF
function convertToPDF(tabId, sendResponse) {
  // Attach to the tab
  chrome.debugger.attach({ tabId }, '1.3', () => {
    if (chrome.runtime.lastError) {
      console.error('Debugger attach failed: ' + chrome.runtime.lastError.message);
      sendResponse({ message: 'Failed to attach debugger.' });
      return;
    }

    // Issue the printToPDF command
    chrome.debugger.sendCommand({ tabId }, 'Page.printToPDF', {}, (result) => {
      if (chrome.runtime.lastError) {
        console.error('Print to PDF failed: ' + chrome.runtime.lastError.message);
        chrome.debugger.detach({ tabId });
        sendResponse({ message: 'Print to PDF failed.' });
        return;
      }

      const pdfData = result.data; // Base64-encoded PDF data

      // Create a data URL from the base64 PDF data
      const dataUrl = 'data:application/pdf;base64,' + pdfData;

      // Download the PDF
      chrome.downloads.download(
        {
          url: dataUrl,
          filename: 'webpage.pdf',
          saveAs: true,
        },
        (downloadId) => {
          if (chrome.runtime.lastError) {
            console.error('Download failed: ' + chrome.runtime.lastError.message);
            chrome.debugger.detach({ tabId });
            sendResponse({ message: 'Download failed.' });
            return;
          }

          chrome.debugger.detach({ tabId });
          sendResponse({ message: 'PDF downloaded.' });

          // No need to revoke data URLs
        }
      );
    });
  });
}
