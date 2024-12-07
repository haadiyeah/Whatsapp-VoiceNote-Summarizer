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
        if (viewToShow) viewToShow.style.display = 'flex';
    }

    // Reset to initial state
    function resetState() {
        selectedVoiceNote = null;
        selectedLanguage = null;
        switchView(mainView);
    }

    // Check if a voice note was previously selected
    function checkForSelectedVoiceNote() {
        chrome.storage.local.get("selectedVoiceNote", function(data) {
            if (data.selectedVoiceNote) {
                selectedVoiceNote = data.selectedVoiceNote;
                console.log("Selected voice note retrieved:", selectedVoiceNote);
                chrome.storage.local.remove("selectedVoiceNote");
                switchView(languageSelection);
            }
        });
    }

    // Initialize select voice note button
    if (selectVoiceNoteBtn) {
        selectVoiceNoteBtn.addEventListener('click', function() {
            console.log("Select Voice Note button clicked");
            chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
                if (tabs[0]) {
                    chrome.tabs.sendMessage(tabs[0].id, {type: 'ENTER_SELECTION_MODE'}, function(response) {
                        if (chrome.runtime.lastError) {
                            console.error('Error:', chrome.runtime.lastError);
                        } else {
                            console.log('Selection mode entered:', response);
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
        }
    });

    // Language Selection
    [urduBtn, englishBtn].forEach(btn => {
        if (btn) {
            btn.addEventListener('click', function() {
                selectedLanguage = btn.id === 'urdu-btn' ? 'urdu' : 'english';
                switchView(processingView);
                processVoiceNote();
            });
        }
    });

    // Process voice note
    function processVoiceNote() {
        // TODO: Replace with actual API call
        setTimeout(() => {
            document.getElementById('transcription-text').textContent = 
                selectedLanguage === 'urdu' 
                    ? 'یہ ایک مزے دار آواز نوٹ ہے۔' 
                    : 'This is a fun voice note.';
            
            document.getElementById('summary-text').textContent = 
                selectedLanguage === 'urdu' 
                    ? 'آواز نوٹ میں مزاح اور خوشی ہے۔' 
                    : 'The voice note contains humor and joy.';

            switchView(resultsView);
        }, 2000);
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