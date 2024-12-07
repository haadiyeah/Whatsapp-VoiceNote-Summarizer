// content.js
console.log("WhatsApp Voice Note Extension loaded successfullaaaai");
let isSelectionMode = false;

// Debug logging function
function debugLog(message, data = null) {
  // if (data) {
  //   console.log(`[WhatsApp Extension] ${message}`, data);
  // } else {
  //   console.log(`[WhatsApp Extension] ${message}`);
  // }
}

// Modify the findVoiceNotes function to respect selection mode
function findVoiceNotes() {
  if (!isSelectionMode) return;

  debugLog("Searching for voice notes in selection mode...");

  const voiceNoteSelectors = [
    'div[data-testid="audio-player"]',
    'span[data-testid="audio-play"]',
    'div.message-in span[data-icon="audio-play"]',
    'div.message-out span[data-icon="audio-play"]',
  ];

  voiceNoteSelectors.forEach((selector) => {
    try {
      const elements = document.querySelectorAll(selector);
      debugLog(`Found ${elements.length} elements with selector: ${selector}`);

      elements.forEach((element) => {
        const container = findMessageContainer(element);
        if (
          container &&
          !container.classList.contains("voice-note-selection")
        ) {
          setupSelectionVoiceNote(container, element);
        }
      });
    } catch (e) {
      console.error(`Error with selector ${selector}:`, e);
    }
  });
}
function findMessageContainer(element) {
  return (
    element.closest('[data-testid="msg-container"]') ||
    element.closest(".message-in") ||
    element.closest(".message-out") ||
    element.closest('[role="row"]')
  );
}


async function findDownloadButton() {
  debugLog("Looking for download button...");

  // Wait for dropdown menu to appear
  await new Promise((resolve) => setTimeout(resolve, 500));

  // Look specifically for the button with aria-label="Download"
  const downloadButton = document.querySelector('[aria-label="Download"]');

  if (!downloadButton) {
    // Fallback: try to find any button containing "Download" in case the aria-label changes
    const buttons = Array.from(document.querySelectorAll('div[role="button"]'));
    const fallbackButton = buttons.find((btn) => {
      return (
        btn.getAttribute("aria-label")?.includes("Download") ||
        (btn.textContent || btn.innerText || "")
          .toLowerCase()
          .includes("download")
      );
    });

    if (!fallbackButton) {
      throw new Error("Download button not found in menu");
    }
    return fallbackButton;
  }

  debugLog("Found download button with aria-label");
  return downloadButton;
}

async function simulateMouseEvent(element, eventType) {
  // Add visual feedback
  if (eventType === "mouseover") {
    element.classList.add("debug-hover");
  } else if (eventType === "mouseout") {
    element.classList.remove("debug-hover");
  }

  const event = new MouseEvent(eventType, {
    view: window,
    bubbles: true,
    cancelable: true,
  });
  element.dispatchEvent(event);
  debugLog(`Simulated ${eventType} event on element`);

  // Show the hover outline for a moment even on mouseout
  if (eventType === "mouseover") {
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }
}

// function setupVoiceNoteDownload(container, voiceNoteElement) {
//   container.classList.add("voice-note-highlight");

//   if (!container.querySelector(".download-button")) {
//     const downloadBtn = document.createElement("button");
//     downloadBtn.className = "download-button";
//     downloadBtn.innerHTML = "⬇️ Save";
//     downloadBtn.addEventListener("click", async function (e) {
//       e.stopPropagation();
//       e.preventDefault();
//       await clickMenuAndDownload(container, voiceNoteElement);
//     });
//     container.appendChild(downloadBtn);
//   }
// }

async function findDownArrowButton(container, voiceNoteElement) {
  debugLog("Looking for down arrow button...");

  // Find the play button specifically
  const playButton =
    voiceNoteElement.querySelector('span[data-icon="audio-play"]') ||
    container.querySelector('span[data-icon="audio-play"]') ||
    container.querySelector('span[data-testid="audio-play"]') ||
    container.querySelector('[role="button"]');

  if (!playButton) {
    throw new Error("Play button not found");
  }

  // Add visual feedback to show which element we're hovering
  playButton.classList.add("debug-hover");

  // Simulate hover events on the play button
  const events = ["mouseenter", "mouseover", "mousemove"];
  for (const eventType of events) {
    const event = new MouseEvent(eventType, {
      view: window,
      bubbles: true,
      cancelable: true,
      clientX: playButton.getBoundingClientRect().left,
      clientY: playButton.getBoundingClientRect().top,
    });
    playButton.dispatchEvent(event);
  }

  // Wait for the menu button to appear
  await new Promise((resolve) => setTimeout(resolve, 1000));

  // Look for the down-context button that appears after hover
  const menuButton = container.querySelector('span[data-icon="down-context"]');

  if (!menuButton) {
    // Try to find it in parent containers
    const parentContainer = container.parentElement;
    const menuButtonInParent = parentContainer?.querySelector(
      'span[data-icon="down-context"]'
    );

    if (!menuButtonInParent) {
      playButton.classList.remove("debug-hover");
      throw new Error(
        "Menu button not found - please hover over the voice note manually"
      );
    }
    return menuButtonInParent;
  }

  return menuButton;
}

async function clickMenuAndDownload(container, voiceNoteElement) {
  const playButton =
    voiceNoteElement.querySelector('span[data-icon="audio-play"]') ||
    container.querySelector('span[data-icon="audio-play"]');

  try {
    console.log("Starting download process");
    container.classList.add("debug-active");

    // Find and click the menu button
    const menuButton = await findDownArrowButton(container, voiceNoteElement);
    console.log("Menu button found, clicking...");
    menuButton.click();

    // Find download button
    const downloadButton = await findDownloadButton();
    console.log("Download button found");

    // Get download URL if possible
    const downloadUrl =
      downloadButton.closest("a")?.href ||
      downloadButton.getAttribute("href") ||
      window.URL.createObjectURL(new Blob()); // Fallback

    // Click download button
    downloadButton.click();

    // Notify background script about the download
    console.log("Notifying background script about download");
    chrome.runtime.sendMessage(
      {
        type: "downloadVoiceNote",
        url: downloadUrl,
        filename: `voice_note_${Date.now()}.ogg`,
      },
      (response) => {
        console.log("Background script response:", response);
      }
    );

    // Clean up
    container.classList.remove("debug-active");
    if (playButton) {
      playButton.classList.remove("debug-hover");
    }

    console.log("Download process completed");
  } catch (error) {
    // Clean up in case of error
    container.classList.remove("debug-active");
    if (playButton) {
      playButton.classList.remove("debug-hover");
    }

    console.error("Error in download process:", error);
    console.log("Failed with error:", error.message);
    alert(`Failed to download: ${error.message}`);
  }
}


const styles = `
.voice-note-highlight {
  border: 3px solid #25D366 !important;
  border-radius: 8px !important;
  position: relative !important;
  margin: 5px !important;
  padding: 5px !important;
  background-color: rgba(37, 211, 102, 0.1) !important;
}

.download-button {
  position: absolute !important;
  right: 10px !important;
  top: 50% !important;
  transform: translateY(-50%) !important;
  background: #25D366 !important;
  color: white !important;
  border: none !important;
  padding: 5px 10px !important;
  border-radius: 4px !important;
  cursor: pointer !important;
  display: none !important;
  z-index: 9999 !important;
  font-size: 14px !important;
}

.voice-note-highlight:hover .download-button {
  display: block !important;
}

.debug-hover {
  outline: 3px solid red !important;
  background-color: rgba(255, 0, 0, 0.1) !important;
  transition: all 0.3s ease !important;
}

.debug-active {
  outline: 3px solid blue !important;
  background-color: rgba(0, 0, 255, 0.1) !important;
}`;


// function setupSelectionVoiceNote(container, voiceNoteElement) {
//   console.log("Setting up voice note selection for:", container);
//   container.classList.add("voice-note-selection");

//   if (!container.querySelector(".selection-download-button")) {
//     const downloadBtn = document.createElement("button");
//     downloadBtn.className = "selection-download-button";
//     downloadBtn.innerHTML = "Select";
//     downloadBtn.style.display = "block"; // Make sure button is visible
//     // In content.js - function setupSelectionVoiceNote
// downloadBtn.addEventListener("click", function (e) {
//   console.log("Selection button clicked");
//   e.stopPropagation();
//   e.preventDefault();

//   // Send selected voice note info to background script
//   chrome.runtime.sendMessage(
//     {
//       type: "VOICE_NOTE_SELECTED",
//       voiceNoteInfo: {
//         // Add any relevant info about the voice note
//         container: container.outerHTML,
//         element: voiceNoteElement.outerHTML,
//       },
//     },
//     function (response) {
//       if (chrome.runtime.lastError) {
//         console.error("Error sending message:", chrome.runtime.lastError);
//       } else {
//         console.log("Message sent successfully");
//       }
//     }
//   );
// });
//     container.appendChild(downloadBtn);
//   }
// }

function setupSelectionVoiceNote(container, voiceNoteElement) {
  console.log("Setting up voice note selection for:", container);
  container.classList.add("voice-note-selection");

  if (!container.querySelector(".selection-download-button")) {
    const downloadBtn = document.createElement("button");
    downloadBtn.className = "selection-download-button";
    downloadBtn.innerHTML = "Select";
    downloadBtn.style.display = "block"; // Make sure button is visible

    downloadBtn.addEventListener("click", async function (e) {
      console.log("Selection button clicked");
      e.stopPropagation();
      e.preventDefault();

      // Exit selection mode
      exitSelectionMode();

      try {
        // Initiate the download process
        await clickMenuAndDownload(container, voiceNoteElement);

        // After the download, send selected voice note info to background script
        chrome.runtime.sendMessage(
          {
            type: "VOICE_NOTE_SELECTED",
            voiceNoteInfo: {
              // Add any relevant info about the voice note
              container: container.outerHTML,
              element: voiceNoteElement.outerHTML,
            },
          },
          function (response) {
            if (chrome.runtime.lastError) {
              console.error("Error sending message:", chrome.runtime.lastError);
            } else {
              console.log("Message sent successfully");
            }
          }
        );
      } catch (error) {
        console.error("Failed to download voice note:", error);
        alert(`Failed to download voice note: ${error.message}`);
      }
    });

    container.appendChild(downloadBtn);
  }
}

function exitSelectionMode() {
  isSelectionMode = false;
  document.querySelectorAll('.voice-note-selection').forEach(el => {
    el.classList.remove('voice-note-selection');
    el.classList.remove('voice-note-selection-active');
    
    // Remove the select button
    const selectBtn = el.querySelector('.selection-download-button');
    if (selectBtn) {
      selectBtn.remove();
    }
  });
}

// Add to existing styles in content.js
const selectionStyles = `
.voice-note-selection {
  border: 3px dashed #005C4B !important;
  border-radius: 8px !important;
  transition: all 0.3s ease !important;
  position: relative !important;
}

.voice-note-selection-active {
  border-color: #25D366 !important;
  background-color: rgba(37, 211, 102, 0.2) !important;
}

.selection-download-button {
  position: absolute !important;
  right: 10px !important;
  top: 10px !important;
  z-index: 1000 !important;
  background: #005C4B !important;
  color: white !important;
  border: none !important;
  padding: 5px 10px !important;
  border-radius: 4px !important;
  cursor: pointer !important;
  display: block !important;
}
`;






function initializeExtension() {
  debugLog("Initializing extension...");

  findVoiceNotes();

  const observer = new MutationObserver((mutations) => {
    for (const mutation of mutations) {
      if (mutation.addedNodes.length > 0) {
        findVoiceNotes();
      }
    }
  });

  observer.observe(document.body, {
    childList: true,
    subtree: true,
  });
}

const styleSheet = document.createElement("style");
styleSheet.textContent = styles;
styleSheet.textContent += selectionStyles;
document.head.appendChild(styleSheet);

// Start the extension
document.addEventListener("DOMContentLoaded", initializeExtension);

window.addEventListener("load", initializeExtension);
// Add to existing content.js
document.addEventListener('keydown', function(e) {
    if (e.key === 'Escape' && isSelectionMode) {
        exitSelectionMode();
    }
});

// Update the message listener
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    console.log("Message received:", request);
    
    if (request.type === 'ENTER_SELECTION_MODE') {
        isSelectionMode = true;
        findVoiceNotes();
        sendResponse({success: true});
        return true;
    }
    
    if (request.type === 'EXIT_SELECTION_MODE') {
        exitSelectionMode();
        sendResponse({success: true});
        return true;
    }
});