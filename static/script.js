// Global variables
let mediaRecorder;
let audioChunks = [];
let isRecording = false;
let recognition = null;
let currentLanguage = 'en-US';
let imageModal = null;

// Initialize on page load
document.addEventListener('DOMContentLoaded', function() {
    initializeChat();
    checkBrowserSupport();
    loadChatHistory();
    setupSpeechRecognition();

    // Set welcome time
    const welcomeTime = document.getElementById('welcomeTime');
    if (welcomeTime) {
        welcomeTime.textContent = getCurrentTime();
    }

    // Initialize image modal
    const modalElement = document.getElementById('imageModal');
    if (modalElement) {
        imageModal = new bootstrap.Modal(modalElement);
    }
});

function getCurrentTime() {
    const now = new Date();
    return now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function initializeChat() {
    const chatContainer = document.getElementById('chatMessages');
    if (chatContainer) {
        scrollToBottom();
    }
}

function scrollToBottom() {
    const chatContainer = document.getElementById('chatMessages');
    if (chatContainer) {
        chatContainer.scrollTop = chatContainer.scrollHeight;
    }
}

// ==================== SPEECH RECOGNITION ====================

function setupSpeechRecognition() {
    if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
        recognition = new SpeechRecognition();
        recognition.continuous = false;
        recognition.interimResults = true;
        recognition.lang = currentLanguage;

        recognition.onstart = function() {
            const voiceBtn = document.getElementById('voiceBtn');
            if (voiceBtn) {
                voiceBtn.classList.add('recording');
                voiceBtn.innerHTML = '<i class="fas fa-stop"></i>';
            }
            updateVoiceStatus('🎤 Listening... Speak now', 'active');
        };

        recognition.onresult = function(event) {
            const transcript = event.results[0][0].transcript;
            const messageInput = document.getElementById('messageInput');
            if (messageInput) {
                messageInput.value = transcript;
            }
            updateVoiceStatus(`🎤 Heard: "${transcript}"`, 'success');

            clearTimeout(window.voiceTimeout);
            window.voiceTimeout = setTimeout(() => {
                if (messageInput && messageInput.value.trim()) {
                    sendMessage();
                }
            }, 1500);
        };

        recognition.onerror = function(event) {
            console.error('Speech recognition error:', event.error);
            updateVoiceStatus('❌ Voice recognition error. Please try again.', 'error');
            stopSpeechRecognition();
        };

        recognition.onend = function() {
            stopSpeechRecognition();
        };
    }
}

function startSpeechRecognition() {
    if (recognition) {
        try {
            recognition.start();
        } catch (e) {
            console.error('Error starting speech recognition:', e);
            updateVoiceStatus('⚠️ Please click the microphone again', 'warning');
        }
    } else {
        updateVoiceStatus('⚠️ Voice recognition not supported in this browser', 'error');
    }
}

function stopSpeechRecognition() {
    if (recognition) {
        try {
            recognition.stop();
        } catch (e) {
            console.error('Error stopping speech recognition:', e);
        }
    }
    const voiceBtn = document.getElementById('voiceBtn');
    if (voiceBtn) {
        voiceBtn.classList.remove('recording');
        voiceBtn.innerHTML = '<i class="fas fa-microphone"></i>';
    }
    updateVoiceStatus('🎤 Tap the microphone to speak', 'idle');
}

function updateVoiceStatus(message, status) {
    const voiceStatus = document.getElementById('voiceStatus');
    if (voiceStatus) {
        voiceStatus.innerHTML = `<i class="fas fa-microphone-alt"></i> ${message}`;
        voiceStatus.className = `voice-status voice-status-${status}`;
        setTimeout(() => {
            if (voiceStatus.className !== 'voice-status-idle') {
                voiceStatus.className = 'voice-status-idle';
                voiceStatus.innerHTML = '<i class="fas fa-microphone-alt"></i> Tap the microphone to speak';
            }
        }, 3000);
    }
}

function toggleVoice() {
    if (recognition) {
        if (isRecording) {
            stopSpeechRecognition();
        } else {
            startSpeechRecognition();
        }
    } else if (isRecording) {
        stopRecording();
    } else {
        startRecording();
    }
}

// ==================== VOICE RECORDING (Fallback) ====================

async function startRecording() {
    try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        mediaRecorder = new MediaRecorder(stream);
        audioChunks = [];

        mediaRecorder.ondataavailable = event => {
            audioChunks.push(event.data);
        };

        mediaRecorder.onstop = () => {
            const audioBlob = new Blob(audioChunks, { type: 'audio/wav' });
            sendVoiceData(audioBlob);
            stream.getTracks().forEach(track => track.stop());
        };

        mediaRecorder.start();
        isRecording = true;

        const voiceBtn = document.getElementById('voiceBtn');
        if (voiceBtn) {
            voiceBtn.classList.add('recording');
            voiceBtn.innerHTML = '<i class="fas fa-stop"></i>';
        }
        updateVoiceStatus('🔴 Recording... Speak now (max 10 seconds)', 'recording');

        setTimeout(() => {
            if (isRecording) {
                stopRecording();
            }
        }, 10000);

    } catch (error) {
        console.error('Error accessing microphone:', error);
        updateVoiceStatus('❌ Could not access microphone. Please check permissions.', 'error');
        showNotification('Microphone access denied', 'error');
    }
}

function stopRecording() {
    if (mediaRecorder && isRecording) {
        mediaRecorder.stop();
        isRecording = false;

        const voiceBtn = document.getElementById('voiceBtn');
        if (voiceBtn) {
            voiceBtn.classList.remove('recording');
            voiceBtn.innerHTML = '<i class="fas fa-microphone"></i>';
        }
        updateVoiceStatus('🎤 Processing voice input...', 'processing');
    }
}

function sendVoiceData(audioBlob) {
    const formData = new FormData();
    formData.append('audio', audioBlob, 'recording.wav');

    showTypingIndicator();

    fetch('/api/process-voice', {
        method: 'POST',
        body: formData
    })
    .then(response => response.json())
    .then(data => {
        removeTypingIndicator();
        if (data.success && data.text) {
            const input = document.getElementById('messageInput');
            if (input) {
                input.value = data.text;
                updateVoiceStatus(`🎤 Transcribed: "${data.text}"`, 'success');
                setTimeout(() => sendMessage(), 500);
            }
        } else {
            updateVoiceStatus('🎤 Voice input received. Please type your message.', 'idle');
        }
    })
    .catch(error => {
        removeTypingIndicator();
        console.error('Error sending voice data:', error);
        updateVoiceStatus('❌ Voice processing failed. Please try again.', 'error');
        showNotification('Voice processing failed', 'error');
    });
}

function checkBrowserSupport() {
    const voiceBtn = document.getElementById('voiceBtn');

    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        console.log('Voice recording not supported in this browser');
        if (voiceBtn) {
            voiceBtn.disabled = true;
            voiceBtn.title = 'Voice recording not supported';
            voiceBtn.innerHTML = '<i class="fas fa-microphone-slash"></i>';
        }
        updateVoiceStatus('⚠️ Voice recording not supported in this browser', 'error');
    }
}

// ==================== MESSAGE HANDLING ====================

function handleKeyPress(event) {
    if (event.key === 'Enter' && !event.shiftKey) {
        event.preventDefault();
        sendMessage();
    }
}

function sendMessage() {
    const input = document.getElementById('messageInput');
    if (!input) return;

    const message = input.value.trim();

    if (!message) {
        showNotification('Please type a message', 'warning');
        return;
    }

    addMessage(message, 'user');
    input.value = '';
    showTypingIndicator();

    fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: message })
    })
    .then(response => {
        if (!response.ok) throw new Error('Network response was not ok');
        return response.json();
    })
    .then(data => {
        removeTypingIndicator();
        if (data.response) {
            addMessage(data.response, 'bot');
        } else {
            addMessage('I could not process your request. Please try again.', 'bot');
        }
        scrollToBottom();
    })
    .catch(error => {
        removeTypingIndicator();
        addMessage('Sorry, an error occurred. Please try again.', 'bot');
        console.error('Error:', error);
        showNotification('Connection error. Please check your network.', 'error');
        scrollToBottom();
    });
}

function addMessage(text, sender) {
    const messagesDiv = document.getElementById('chatMessages');
    if (!messagesDiv) return;

    const messageDiv = document.createElement('div');
    messageDiv.className = `message ${sender}-message`;
    messageDiv.style.animation = 'fadeInUp 0.3s ease';

    const now = new Date();
    const timeString = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const safeText = text || '';

    if (sender === 'user') {
        messageDiv.innerHTML = `
            <div class="message-bubble user-bubble">
                <div class="message-text">${escapeHtml(safeText)}</div>
                <div class="message-time">${timeString}</div>
            </div>
            <div class="message-avatar user-avatar">
                <i class="fas fa-user-circle"></i>
            </div>
        `;
    } else {
        const formattedText = formatBotResponse(safeText);
        messageDiv.innerHTML = `
            <div class="message-avatar bot-avatar">
                <i class="fas fa-heartbeat"></i>
            </div>
            <div class="message-bubble bot-bubble">
                <div class="message-sender">HealthMate AI</div>
                <div class="message-text">${formattedText}</div>
                <div class="message-time">${timeString}</div>
            </div>
        `;
    }

    messagesDiv.appendChild(messageDiv);
    scrollToBottom();
}

function formatBotResponse(text) {
    if (!text) return '';
    const safeText = String(text);

    try {
        let formatted = safeText
            .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
            .replace(/\*(.*?)\*/g, '<em>$1</em>')
            .replace(/✅/g, '<i class="fas fa-check-circle" style="color: #27ae60;"></i>')
            .replace(/⚠️/g, '<i class="fas fa-exclamation-triangle" style="color: #e67e22;"></i>')
            .replace(/🚨/g, '<i class="fas fa-ambulance" style="color: #e74c3c;"></i>')
            .replace(/💡/g, '<i class="fas fa-lightbulb" style="color: #f39c12;"></i>')
            .replace(/📷/g, '<i class="fas fa-camera"></i>')
            .replace(/🎤/g, '<i class="fas fa-microphone"></i>')
            .replace(/•/g, '&bull;')
            .replace(/\n/g, '<br>');

        formatted = formatted.replace(/(https?:\/\/[^\s]+)/g, '<a href="$1" target="_blank" rel="noopener noreferrer" class="chat-link">$1</a>');
        return formatted;
    } catch (e) {
        console.error('Error formatting text:', e);
        return escapeHtml(safeText);
    }
}

function escapeHtml(unsafe) {
    if (!unsafe) return '';
    return String(unsafe)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

function showTypingIndicator() {
    const messagesDiv = document.getElementById('chatMessages');
    if (!messagesDiv) return;
    removeTypingIndicator();

    const indicator = document.createElement('div');
    indicator.id = 'typing-indicator';
    indicator.className = 'message bot-message typing-indicator-container';
    indicator.style.animation = 'fadeInUp 0.3s ease';
    indicator.innerHTML = `
        <div class="message-avatar bot-avatar">
            <i class="fas fa-heartbeat"></i>
        </div>
        <div class="message-bubble bot-bubble">
            <div class="typing-indicator">
                <span></span>
                <span></span>
                <span></span>
                <span class="typing-text">HealthMate AI is thinking</span>
            </div>
        </div>
    `;
    messagesDiv.appendChild(indicator);
    scrollToBottom();
}

function removeTypingIndicator() {
    const indicator = document.getElementById('typing-indicator');
    if (indicator) indicator.remove();
}

// ==================== IMAGE HANDLING ====================

function attachImage() {
    document.getElementById('imageUpload').click();
}

function uploadImage(event) {
    const file = event.target.files[0];
    if (!file) return;

    const validTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'];
    if (!validTypes.includes(file.type)) {
        showNotification('Please upload a valid image file (JPEG, PNG, GIF, WEBP)', 'error');
        return;
    }

    if (file.size > 16 * 1024 * 1024) {
        showNotification('File size too large. Maximum size is 16MB.', 'error');
        return;
    }

    const reader = new FileReader();
    reader.onload = function(e) {
        addImagePreview(e.target.result);
        if (imageModal) {
            document.getElementById('previewImage').src = e.target.result;
            document.getElementById('analysisResult').innerHTML = '<div class="text-center"><div class="spinner-border text-primary"></div><p class="mt-2">Analyzing image...</p></div>';
            imageModal.show();
        }
    };
    reader.readAsDataURL(file);

    const formData = new FormData();
    formData.append('image', file);

    showTypingIndicator();

    fetch('/api/analyze-image', {
        method: 'POST',
        body: formData
    })
    .then(response => {
        if (!response.ok) throw new Error('Upload failed');
        return response.json();
    })
    .then(data => {
        removeTypingIndicator();
        if (data.success && data.response) {
            addMessage(data.response, 'bot');
            if (imageModal && document.getElementById('analysisResult')) {
                document.getElementById('analysisResult').innerHTML = `<div class="alert alert-success">${formatBotResponse(data.response)}</div>`;
            }
        } else {
            addMessage('Image uploaded. Analysis complete.', 'bot');
        }
    })
    .catch(error => {
        removeTypingIndicator();
        addMessage('Image upload failed. Please try again.', 'bot');
        console.error('Error:', error);
        showNotification('Image upload failed', 'error');
    });

    event.target.value = '';
}

function addImagePreview(imageData) {
    const messagesDiv = document.getElementById('chatMessages');
    if (!messagesDiv) return;

    const previewDiv = document.createElement('div');
    previewDiv.className = 'message user-message';
    previewDiv.style.animation = 'fadeInUp 0.3s ease';
    previewDiv.innerHTML = `
        <div class="message-bubble user-bubble">
            <div class="message-text">
                <img src="${imageData}" class="image-preview" alt="Uploaded image">
                <p class="mb-0 mt-2"><small>📷 Image uploaded for analysis</small></p>
            </div>
            <div class="message-time">Just now</div>
        </div>
        <div class="message-avatar user-avatar">
            <i class="fas fa-user-circle"></i>
        </div>
    `;
    messagesDiv.appendChild(previewDiv);
    scrollToBottom();
}

// ==================== CHAT UTILITIES ====================

function loadChatHistory() {
    fetch('/api/chat-history')
    .then(response => response.json())
    .then(data => {
        if (data.success && data.chats && data.chats.length > 0) {
            const messagesDiv = document.getElementById('chatMessages');
            if (messagesDiv && messagesDiv.children.length <= 1) {
                messagesDiv.innerHTML = '';
                const recentChats = data.chats.slice(0, 20).reverse();
                recentChats.forEach(chat => {
                    if (chat.message) addMessage(chat.message, 'user');
                    if (chat.response) addMessage(chat.response, 'bot');
                });
            }
        }
    })
    .catch(error => console.error('Error loading chat history:', error));
}

function clearChat() {
    if (confirm('Clear all chat messages? This will remove your conversation history.')) {
        const messagesDiv = document.getElementById('chatMessages');
        if (messagesDiv) {
            messagesDiv.innerHTML = `
                <div class="message bot-message">
                    <div class="message-avatar bot-avatar">
                        <i class="fas fa-heartbeat"></i>
                    </div>
                    <div class="message-bubble bot-bubble">
                        <div class="message-sender">HealthMate AI</div>
                        <div class="message-text">
                            <strong>👋 Chat cleared!</strong><br><br>
                            How can I help you today?
                        </div>
                        <div class="message-time">${getCurrentTime()}</div>
                    </div>
                </div>
            `;
            showNotification('Chat cleared successfully', 'success');
        }
    }
}

function showEmergencyInfo() {
    addMessage(`
        🚨 <strong>EMERGENCY INFORMATION</strong><br><br>
        <strong>📞 Emergency Numbers:</strong><br>
        • National Emergency: <strong>112</strong><br>
        • Ambulance: <strong>102</strong><br>
        • Police: <strong>100</strong><br>
        • Fire: <strong>101</strong><br><br>
        <strong>⚠️ Call Immediately if you have:</strong><br>
        • Chest pain or pressure<br>
        • Difficulty breathing<br>
        • Severe bleeding<br>
        • Loss of consciousness<br>
        • Sudden severe headache<br>
        • Signs of stroke (facial drooping, arm weakness, speech difficulty)<br><br>
        <strong class="text-danger">🚨 DO NOT wait for AI response in medical emergencies! Call emergency services immediately.</strong>
    `, 'bot');
}

function showHealthTips() {
    addMessage(`
        💡 <strong>Daily Health Tips from HealthMate AI</strong><br><br>
        ✅ <strong>Stay Hydrated:</strong> Drink 8-10 glasses of water daily<br>
        ✅ <strong>Balanced Diet:</strong> Include fruits, vegetables, and protein in meals<br>
        ✅ <strong>Regular Exercise:</strong> At least 30 minutes of physical activity daily<br>
        ✅ <strong>Adequate Sleep:</strong> 7-8 hours of quality sleep<br>
        ✅ <strong>Stress Management:</strong> Practice meditation or deep breathing<br>
        ✅ <strong>Regular Check-ups:</strong> Annual health screenings<br>
        ✅ <strong>Limit Screen Time:</strong> Take breaks every hour<br><br>
        <em>For personalized advice, consult a healthcare professional.</em>
    `, 'bot');
}

function exportChat() {
    const messages = [];
    const messageElements = document.querySelectorAll('#chatMessages .message');

    messageElements.forEach(msg => {
        const textElement = msg.querySelector('.message-text');
        const timeElement = msg.querySelector('.message-time');
        const isBot = msg.classList.contains('bot-message');

        if (textElement) {
            messages.push({
                sender: isBot ? 'HealthMate AI' : 'You',
                message: textElement.innerText.trim(),
                time: timeElement ? timeElement.innerText : ''
            });
        }
    });

    const dataStr = JSON.stringify(messages, null, 2);
    const dataUri = 'data:application/json;charset=utf-8,' + encodeURIComponent(dataStr);
    const exportFileName = `healthmate-chat-${new Date().toISOString().slice(0, 19).replace(/:/g, '-')}.json`;

    const linkElement = document.createElement('a');
    linkElement.setAttribute('href', dataUri);
    linkElement.setAttribute('download', exportFileName);
    linkElement.click();

    showNotification('Chat exported successfully!', 'success');
}

function showNotification(message, type = 'info') {
    const notification = document.createElement('div');
    notification.className = `alert alert-${type} alert-dismissible fade show position-fixed top-0 end-0 m-3`;
    notification.style.zIndex = '9999';
    notification.style.maxWidth = '350px';
    notification.style.borderRadius = '1rem';
    notification.style.boxShadow = '0 10px 25px rgba(0,0,0,0.1)';
    notification.innerHTML = `
        <i class="fas fa-${type === 'success' ? 'check-circle' : type === 'error' ? 'exclamation-triangle' : 'info-circle'} me-2"></i>
        ${message}
        <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
    `;
    document.body.appendChild(notification);
    setTimeout(() => {
        notification.style.transition = 'opacity 0.5s';
        notification.style.opacity = '0';
        setTimeout(() => notification.remove(), 500);
    }, 3000);
}

// Global error handler
window.onerror = function(msg, url, lineNo, columnNo, error) {
    console.error('Global error:', { msg, url, lineNo, columnNo, error });
    showNotification('An error occurred. Please refresh the page if issues persist.', 'error');
    return false;
};