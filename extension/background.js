// background.js
console.log("Background script loaded");
if (chrome.storage && chrome.storage.local) {
  console.log("chrome.storage.local is available");
} else {
  console.error("chrome.storage.local is undefined");
}

chrome.runtime.onInstalled.addListener(() => {
  console.log("Extension installed");
});


let processedDownloads = new Set();

chrome.downloads.onChanged.addListener((delta) => {
  console.log("Download change detected:", delta);

  if (
    delta.state &&
    delta.state.current === "complete" &&
    !processedDownloads.has(delta.id)
  ) {
    processedDownloads.add(delta.id);
    console.log("Processing download ID:", delta.id);

    chrome.downloads.search({ id: delta.id }, function (downloads) {
      if (downloads && downloads[0]) {
        const filename = downloads[0].filename;
        console.log("Downloaded file:", filename);

        if (filename.toLowerCase().endsWith(".ogg")) {
          console.log("Found .ogg file, sending to server:", filename);

          fetch("http://localhost:5000/process_downloaded_file", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              filename: filename.split("\\").pop(),
              filepath: filename,
            }),
          })
            .then((response) => {
              console.log("Server response status:", response.status);
              return response.json();
            })
            .then((data) => {
              console.log("Server response data:", data);
            })
            .catch((error) => {
              console.error("Error sending to server:", error);
            });
        } else {
          console.log("Ignoring non-ogg file:", filename);
        }
      }
    });
  }
});
chrome.runtime.onMessage.addListener(function (request, sender, sendResponse) {
  if (request.type === "VOICE_NOTE_SELECTED") {
    console.log("Received VOICE_NOTE_SELECTED message in background script");

    console.log("REQUEST: ", request);
    // You can store the voice note info if needed
    chrome.storage.local.set({ selectedVoiceNote: request.voiceNoteInfo }, function () {
      console.log("Voice note info stored in chrome.storage.local");
    });

    if (chrome.runtime.lastError) {
      console.error("Error storing data:", chrome.runtime.lastError);
    } else {
      console.log("Voice note info stored in chrome.storage.local");
    }
    // Send a response back to the sender
    sendResponse({ success: true });
  }
});
// Clean up processed downloads periodically
setInterval(() => {
  processedDownloads.clear();
}, 60000);
