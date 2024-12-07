// background.js
console.log("Background script loaded");

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

// Clean up processed downloads periodically
setInterval(() => {
  processedDownloads.clear();
}, 60000);
