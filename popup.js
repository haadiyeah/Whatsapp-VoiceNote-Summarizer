document.addEventListener('DOMContentLoaded', function() {
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
            view.style.display = 'none';
        });
        viewToShow.style.display = 'flex';
    }

    // Reset to initial state
    function resetState() {
        selectedVoiceNote = null;
        selectedLanguage = null;
        switchView(mainView);
    }

    // Select Voice Note Button
    selectVoiceNoteBtn.addEventListener('click', function() {
        chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
            if (tabs[0]) {
                chrome.tabs.sendMessage(tabs[0].id, {type: 'ENTER_SELECTION_MODE'}, function(response) {
                    if (chrome.runtime.lastError) {
                        console.error('Error:', chrome.runtime.lastError);
                    }
                    // Don't close popup
                });
            }
        });
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
        btn.addEventListener('click', function() {
            selectedLanguage = btn.id === 'urdu-btn' ? 'urdu' : 'english';
            
            // Show processing view
            switchView(processingView);

            // Simulate processing (replace with actual processing in future)
            simulateProcessing();
        });
    });

    // Simulated processing function
    function simulateProcessing() {
        setTimeout(() => {
            // Update results (mock data for now)
            document.getElementById('transcription-text').textContent = 
                selectedLanguage === 'urdu' 
                    ? 'یہ ایک مزے دار آواز نوٹ ہے۔' 
                    : 'This is a fun voice note.';
            
            document.getElementById('summary-text').textContent = 
                selectedLanguage === 'urdu' 
                    ? 'آواز نوٹ میں مزاح اور خوشی ہے۔' 
                    : 'The voice note contains humor and joy.';

            switchView(resultsView);
        }, 2000);  // Simulate 2-second processing
    }

    // Add a reset button to go back to main view
    const resetButton = document.createElement('button');
    resetButton.textContent = 'Start Over';
    resetButton.className = 'secondary-button';
    resetButton.style.marginTop = '10px';
    resetButton.addEventListener('click', resetState);
    document.querySelector('.container').appendChild(resetButton);
});