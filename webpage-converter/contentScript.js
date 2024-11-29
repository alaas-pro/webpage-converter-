// contentScript.js

// Helper function to fetch CSS content
async function fetchCSS(href) {
  try {
    const response = await fetch(href, { mode: 'cors', credentials: 'omit' });
    if (response.ok) {
      return await response.text();
    } else {
      console.error(`Failed to fetch CSS from ${href}: ${response.statusText}`);
      return '';
    }
  } catch (error) {
    console.error(`Error fetching CSS from ${href}:`, error);
    return '';
  }
}

// Function to get the HTML content with styles and images
async function getHTMLWithStylesAndImages() {
  // Clone the current document to avoid modifying the original page
  const clonedDoc = document.cloneNode(true);

  // Inline CSS styles
  const head = clonedDoc.querySelector('head');
  const styleElements = [...document.querySelectorAll('style')];
  const linkElements = [...document.querySelectorAll('link[rel="stylesheet"]')];

  // Clone <style> elements
  for (const styleElement of styleElements) {
    head.appendChild(styleElement.cloneNode(true));
  }

  // Process <link> elements
  for (const linkElement of linkElements) {
    const href = linkElement.href;
    if (href) {
      // First, try to fetch the CSS content
      const cssText = await fetchCSS(href);
      if (cssText) {
        // Create a new <style> element with the fetched CSS
        const newStyleElement = document.createElement('style');
        newStyleElement.textContent = cssText;
        head.appendChild(newStyleElement);
      } else {
        // If fetching failed, try to access the stylesheet's cssRules
        try {
          for (const sheet of document.styleSheets) {
            if (sheet.href === href) {
              let cssText = '';
              for (const rule of sheet.cssRules) {
                cssText += rule.cssText + '\n';
              }
              const newStyleElement = document.createElement('style');
              newStyleElement.textContent = cssText;
              head.appendChild(newStyleElement);
              break;
            }
          }
        } catch (e) {
          console.warn(`Cannot access stylesheet at ${href}:`, e);
        }
      }
    }
  }

  // Process all images in the cloned document
  const imgElements = clonedDoc.querySelectorAll('img');

  const imagePromises = Array.from(imgElements).map(async (img) => {
    const src = img.getAttribute('src');
    if (src && !src.startsWith('data:')) {
      const absoluteSrc = new URL(src, document.baseURI).href;
      const dataUrl = await fetchImageAsDataURL(absoluteSrc);
      if (dataUrl) {
        img.setAttribute('src', dataUrl);
      }
    }
  });

  // Wait for all images to be processed
  await Promise.all(imagePromises);

  // Return the outer HTML of the cloned document
  return clonedDoc.documentElement.outerHTML;
}

// Existing helper functions and message listener...

// Helper function to fetch image and convert it to a data URL
async function fetchImageAsDataURL(src) {
  try {
    const response = await fetch(src, { mode: 'cors', credentials: 'omit' });
    const blob = await response.blob();

    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = function () {
        resolve(reader.result);
      };
      reader.onerror = function () {
        reject(new Error('Failed to convert image to data URL'));
      };
      reader.readAsDataURL(blob);
    });
  } catch (error) {
    console.error(`Error fetching image ${src}:`, error);
    return null;
  }
}

// Message listener remains the same
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "convertToDocx") {
    // Ensure that htmlDocx is loaded
    if (window.htmlDocx) {
      // Process the HTML content
      getHTMLWithStylesAndImages().then((htmlContent) => {
        // Convert HTML to Word document blob
        const converted = window.htmlDocx.asBlob(htmlContent);

        // Create a blob URL
        const blobUrl = URL.createObjectURL(converted);

        // Send the blob URL back to the background script
        sendResponse({ blobUrl });

        // Optionally revoke the blob URL after some time
        // setTimeout(() => URL.revokeObjectURL(blobUrl), 60000);

      }).catch((error) => {
        console.error('Error processing HTML:', error);
        sendResponse({ error: error.message });
      });

      // Indicate that the response is sent asynchronously
      return true;
    } else {
      console.error('htmlDocx is not loaded.');
      sendResponse({ error: 'htmlDocx is not loaded.' });
    }
  } else if (request.action === 'revokeBlobUrl' && request.blobUrl) {
    // Revoke the blob URL when instructed by the background script
    URL.revokeObjectURL(request.blobUrl);
    sendResponse({ success: true });
  }
});
