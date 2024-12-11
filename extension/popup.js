document.addEventListener('DOMContentLoaded', function() {
    // Get DOM elements
    const selectVoiceNoteBtn = document.getElementById('select-voice-note');
    const mainView = document.getElementById('main-view');
    const languageSelection = document.getElementById('language-selection');
    const processingView = document.getElementById('processing-view');
    const resultsView = document.getElementById('results-view');
    const urduBtn = document.getElementById('urdu-btn');
    const englishBtn = document.getElementById('english-btn');

    let selectedVoiceNote = null;
    let selectedLanguage = null;

    // Function to switch views
    function switchView(viewToShow) {
        [mainView, languageSelection, processingView, resultsView].forEach(view => {
            if (view) view.style.display = 'none';
        });
        if (viewToShow) {
            viewToShow.style.display = 'flex'; 
            viewToShow.style.flexDirection = 'column';
            //gap between the elements
            viewToShow.style.gap = '10px';

        }
    }

    // Reset to initial state
    function resetState() {
        selectedVoiceNote = null;
        selectedLanguage = null;
        switchView(mainView);
    }

    function displaySelectedVoiceNoteInfo() {
        // Remove any existing info to avoid duplicates
        const existingInfoDiv = document.getElementById('selected-voice-note-info');
        if (existingInfoDiv) {
          existingInfoDiv.remove();
        }
    
        // Create a container div for the selected voice note info
        const selectedVoiceNoteInfoDiv = document.createElement('div');
        selectedVoiceNoteInfoDiv.id = 'selected-voice-note-info';
        selectedVoiceNoteInfoDiv.className = 'selected-voice-note-info';
        selectedVoiceNoteInfoDiv.style.display = 'flex';
        selectedVoiceNoteInfoDiv.style.flexDirection = 'column';
        selectedVoiceNoteInfoDiv.style.alignItems = 'center';
        selectedVoiceNoteInfoDiv.style.marginBottom = '20px';
    
        // Create a title
        const infoTitle = document.createElement('p');
        infoTitle.textContent = 'Selected Voice Note';
        infoTitle.style.fontWeight = 'bold';
        infoTitle.style.fontSize = '18px';
        infoTitle.style.marginBottom = '10px';
    
        // Create image element for sender's image
        const senderImg = document.createElement('img');
        senderImg.src = selectedVoiceNote.senderImage || 'default-image.png'; // Provide a default image if none
        senderImg.alt = 'Sender Image';
        senderImg.style.width = '50px';
        senderImg.style.height = '50px';
        senderImg.style.borderRadius = '50%';
        senderImg.style.objectFit = 'cover';
    
        // Create text element for timestamp
        const timestampText = document.createElement('p');
        timestampText.textContent = 'Timestamp: ' + (selectedVoiceNote.timestamp || 'Unknown');
        timestampText.style.marginTop = '10px';

        // create text element for vnLength
        const vnLengthText = document.createElement('p');
        vnLengthText.textContent = 'Voice Note Length: ' + (selectedVoiceNote.vnLength || 'Unknown');
        vnLengthText.style.marginTop = '10px';

    
        // Append elements to the container div
        selectedVoiceNoteInfoDiv.appendChild(infoTitle);
        selectedVoiceNoteInfoDiv.appendChild(senderImg);
        selectedVoiceNoteInfoDiv.appendChild(timestampText);
        selectedVoiceNoteInfoDiv.appendChild(vnLengthText);
    
        // Append the container div to the languageSelection view
        languageSelection.insertBefore(selectedVoiceNoteInfoDiv, languageSelection.firstChild);
      }

    // Check if a voice note was previously selected
    function checkForSelectedVoiceNote() {
        chrome.storage.local.get("selectedVoiceNote", function(data) {
          if (data.selectedVoiceNote) {
            selectedVoiceNote = data.selectedVoiceNote;
            console.log("Selected voice note retrieved:", selectedVoiceNote);
            chrome.storage.local.remove("selectedVoiceNote");
            switchView(languageSelection);
            displaySelectedVoiceNoteInfo(); // Call the function to display info
          }
        });
      }

    // Initialize select voice note button
    if (selectVoiceNoteBtn) {
        selectVoiceNoteBtn.addEventListener('click', function() {
            console.log("Select Voice Note button clicked !!");
            chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
                if (tabs[0]) {
                    chrome.tabs.sendMessage(tabs[0].id, {type: 'ENTER_SELECTION_MODE'}, function(response) {
                        if (chrome.runtime.lastError) {
                            console.error('Error:', chrome.runtime.lastError);
                        } else {
                            console.log('Selection mode entered:', response);
                            // Set selection mode to true in localStorage
                            chrome.storage.local.set({selectionMode: true}, function() {
                                console.log("Selection mode set to true in chrome.storage.local");
                                // Hide the button when the selection mode is entered and show text instead
                                selectVoiceNoteBtn.style.display = 'none';
                                const selectionText = document.createElement('p');
                                selectionText.textContent = 'Please select a voice note from WhatsApp Web. Press ESC to exit selection mode.';
                                selectionText.style.fontSize = '14px';
                                selectionText.style.fontWeight = 'semibold';
                                selectionText.style.color = '#333';
                                selectionText.style.textAlign = 'center';
                                // Corrected the method name here
                                document.getElementById('main-view').appendChild(selectionText);
                            });
                        }
                    });
                }
            });
        });
    } else {
        console.log("Select Voice Note button not found");
    }

    // Handle ESC key to exit selection mode
    document.addEventListener('keydown', function(e) {
        if (e.key === 'Escape') {
            chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
                if (tabs[0]) {
                    chrome.tabs.sendMessage(tabs[0].id, {type: 'EXIT_SELECTION_MODE'});
                }
            });
        }
    });

    // Listen for voice note selection
    chrome.runtime.onMessage.addListener(function(request, sender, sendResponse) {
        if (request.type === 'VOICE_NOTE_SELECTED') {
            selectedVoiceNote = request.voiceNoteInfo;
            switchView(languageSelection);
            displaySelectedVoiceNoteInfo();
        }
    });

    // Language Selection
    [urduBtn, englishBtn].forEach(btn => {
        if (btn) {
            btn.addEventListener('click', function() {
                selectedLanguage = btn.id === 'urdu-btn' ? 'urdu' : 'english';
                switchView(processingView);
                const languageCode = selectedLanguage === 'urdu' ? 'ur' : 'en';
                processVoiceNote(languageCode);
            });
        }
    });

    async function analyzeLatestAudioFile(languageCode) {
        try {
            const response = await fetch(`http://localhost:5000/analyze-audio/${languageCode}`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                }
            });
    
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
    
            const data = await response.json();
            
            // Handle the response data
            console.log('Transcription:', data.transcription);
            console.log('Summary:', data.summary.summary);
            
            return data;
        } catch (error) {
            console.error('Error analyzing audio:', error);
            throw error;
        }
    }

    // Process voice note
    function processVoiceNote(languageCode) {
        // TODO: Replace with actual API call
        // analyzeLatestAudioFile(languageCode)
        // .then(result => {
        //     document.getElementById('transcription-text').textContent =result.transcription;
        //     document.getElementById('summary-text').textContent = result.summary;
        //     switchView(resultsView);
        // })
        // .catch(error => {
        //     console.error('Error processing voice note:', error);
        // });
               analyzeLatestAudioFile(languageCode)
            .then(result => {
                console.log(result);
                document.getElementById('transcription-text').textContent = result.transcription;
        
                // Create a bullet point list for the summary
                const summaryElement = document.getElementById('summary-text');
                summaryElement.innerHTML = ''; // Clear any existing content
                const ul = document.createElement('ul');
                for (const key in result.summary.summary) {
                    if (result.summary.summary.hasOwnProperty(key)) {
                        const li = document.createElement('li');
                        li.textContent = result.summary.summary[key]; // Render the value of each key-value pair
                        ul.appendChild(li);
                    }
                }
                summaryElement.appendChild(ul);
        
                switchView(resultsView);
            })
            .catch(error => {
                console.error('Error processing voice note:', error);
            });
        // setTimeout(() => {
        //     document.getElementById('transcription-text').textContent = 
        //         selectedLanguage === 'urdu' 
        //             ? 'یہ ایک مزے دار آواز نوٹ ہے۔' 
        //             : 'This is a fun voice note.';
            
        //     document.getElementById('summary-text').textContent = 
        //         selectedLanguage === 'urdu' 
        //             ? 'آواز نوٹ میں مزاح اور خوشی ہے۔' 
        //             : 'The voice note contains humor and joy.';

        //     switchView(resultsView);
        // }, 2000);
    }

    

    // Add reset button
    const resetButton = document.createElement('button');
    resetButton.textContent = 'Start Over';
    resetButton.className = 'secondary-button';
    resetButton.style.marginTop = '10px';
    resetButton.addEventListener('click', resetState);
    document.querySelector('.container').appendChild(resetButton);

    // Check for selected voice note on load
    checkForSelectedVoiceNote();
});