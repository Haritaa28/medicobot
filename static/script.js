// Global variables
let mediaRecorder;
let audioChunks = [];
let isRecording = false;

// Initialize on page load
document.addEventListener('DOMContentLoaded', function() {
    initializeChat();
    checkBrowserSupport();
    loadChatHistory();
});

function initializeChat() {
    const chatContainer = document.getElementById('chat-container');
    if (chatContainer) {
        scrollToBottom();
    }
}

function scrollToBottom() {
    const chatContainer = document.getElementById('chat-container');
    if (chatContainer) {
        chatContainer.scrollTop = chatContainer.scrollHeight;
    }
}

// ==================== MESSAGE HANDLING ====================

function handleKeyPress(event) {
    if (event.key === 'Enter') {
        sendMessage();
    }
}

function quickQuestion(question) {
    const input = document.getElementById('message-input');
    if (input) {
        input.value = question;
        sendMessage();
    }
}

function sendMessage() {
    const input = document.getElementById('message-input');
    if (!input) return;

    const message = input.value.trim();

    if (!message) {
        alert('Please type a message');
        return;
    }

    // Add user message to chat
    addMessage(message, 'user');
    input.value = '';

    // Show typing indicator
    showTypingIndicator();

    // Send to server
    fetch('/api/chat', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({ message: message })
    })
    .then(response => {
        if (!response.ok) {
            throw new Error('Network response was not ok');
        }
        return response.json();
    })
    .then(data => {
        removeTypingIndicator();
        if (data.response) {
            addMessage(data.response, 'bot');
        } else {
            addMessage('Sorry, I could not process your request.', 'bot');
        }
        scrollToBottom();
    })
    .catch(error => {
        removeTypingIndicator();
        addMessage('Sorry, an error occurred. Please try again.', 'bot');
        console.error('Error:', error);
        scrollToBottom();
    });
}

function addMessage(text, sender) {
    const messagesDiv = document.getElementById('chat-messages');
    if (!messagesDiv) return;

    const messageDiv = document.createElement('div');
    messageDiv.className = `message ${sender}-message mb-3`;

    const now = new Date();
    const timeString = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    // Ensure text is a string
    const safeText = text || '';

    if (sender === 'user') {
        messageDiv.innerHTML = `
            <div class="d-flex justify-content-end">
                <div class="flex-grow-1 text-end me-3">
                    <div class="message-content bg-primary text-white p-3 rounded">
                        <p class="mb-0">${escapeHtml(safeText)}</p>
                    </div>
                    <small class="text-muted">${timeString}</small>
                </div>
                <div class="flex-shrink-0">
                    <i class="fas fa-user-circle fa-2x text-secondary"></i>
                </div>
            </div>
        `;
    } else {
        // Format bot response safely
        const formattedText = formatBotResponse(safeText);

        messageDiv.innerHTML = `
            <div class="d-flex">
                <div class="flex-shrink-0">
                    <i class="fas fa-robot fa-2x text-primary"></i>
                </div>
                <div class="flex-grow-1 ms-3">
                    <div class="message-content bg-light p-3 rounded">
                        <strong>MediCoBot:</strong>
                        <div class="mb-0 mt-2">${formattedText}</div>
                    </div>
                    <small class="text-muted">${timeString}</small>
                </div>
            </div>
        `;
    }

    messagesDiv.appendChild(messageDiv);
    scrollToBottom();
}

function formatBotResponse(text) {
    if (!text) return '';

    // Convert text to string if it's not
    const safeText = String(text);

    try {
        // Convert markdown-style formatting to HTML
        let formatted = safeText
            .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
            .replace(/\*(.*?)\*/g, '<em>$1</em>')
            .replace(/•/g, '&bull;')
            .replace(/\n/g, '<br>');

        // Convert URLs to links
        formatted = formatted.replace(/(https?:\/\/[^\s]+)/g, '<a href="$1" target="_blank" rel="noopener noreferrer">$1</a>');

        return formatted;
    } catch (e) {
        console.error('Error formatting text:', e);
        return safeText; // Return unformatted text if error occurs
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
    const messagesDiv = document.getElementById('chat-messages');
    if (!messagesDiv) return;

    // Remove existing indicator if any
    removeTypingIndicator();

    const indicator = document.createElement('div');
    indicator.id = 'typing-indicator';
    indicator.className = 'bot-message mb-3';
    indicator.innerHTML = `
        <div class="d-flex">
            <div class="flex-shrink-0">
                <i class="fas fa-robot fa-2x text-primary"></i>
            </div>
            <div class="flex-grow-1 ms-3">
                <div class="typing-indicator">
                    <span></span>
                    <span></span>
                    <span></span>
                </div>
            </div>
        </div>
    `;
    messagesDiv.appendChild(indicator);
    scrollToBottom();
}

function removeTypingIndicator() {
    const indicator = document.getElementById('typing-indicator');
    if (indicator) {
        indicator.remove();
    }
}

// ==================== IMAGE HANDLING ====================

function uploadImage(event) {
    const file = event.target.files[0];
    if (!file) return;

    // Check file type
    const validTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'];
    if (!validTypes.includes(file.type)) {
        alert('Please upload a valid image file (JPEG, PNG, GIF, WEBP)');
        return;
    }

    // Check file size (max 16MB)
    if (file.size > 16 * 1024 * 1024) {
        alert('File size too large. Maximum size is 16MB.');
        return;
    }

    // Preview image
    const reader = new FileReader();
    reader.onload = function(e) {
        addImagePreview(e.target.result);
    };
    reader.readAsDataURL(file);

    // Upload to server
    const formData = new FormData();
    formData.append('image', file);

    showTypingIndicator();

    fetch('/api/analyze-image', {
        method: 'POST',
        body: formData
    })
    .then(response => {
        if (!response.ok) {
            throw new Error('Upload failed');
        }
        return response.json();
    })
    .then(data => {
        removeTypingIndicator();
        if (data.success && data.response) {
            addMessage(data.response, 'bot');
        } else {
            addMessage('Image uploaded but analysis failed. Please try again.', 'bot');
        }
    })
    .catch(error => {
        removeTypingIndicator();
        addMessage('Image upload failed. Please try again.', 'bot');
        console.error('Error:', error);
    });

    // Clear the input
    event.target.value = '';
}

function addImagePreview(imageData) {
    const messagesDiv = document.getElementById('chat-messages');
    if (!messagesDiv) return;

    const previewDiv = document.createElement('div');
    previewDiv.className = 'message user-message mb-3';
    previewDiv.innerHTML = `
        <div class="d-flex justify-content-end">
            <div class="flex-grow-1 text-end me-3">
                <div class="message-content bg-primary text-white p-3 rounded">
                    <img src="${imageData}" class="image-preview" alt="Uploaded image" style="max-width: 200px; max-height: 200px; border-radius: 10px;">
                    <p class="mb-0 mt-2"><small>Image uploaded for analysis</small></p>
                </div>
                <small class="text-muted">Just now</small>
            </div>
            <div class="flex-shrink-0">
                <i class="fas fa-user-circle fa-2x text-secondary"></i>
            </div>
        </div>
    `;
    messagesDiv.appendChild(previewDiv);
    scrollToBottom();
}

// ==================== VOICE HANDLING ====================

function checkBrowserSupport() {
    const voiceBtn = document.querySelector('[onclick="startVoice()"]');

    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        console.log('Voice recording not supported in this browser');
        if (voiceBtn) {
            voiceBtn.disabled = true;
            voiceBtn.title = 'Voice recording not supported in this browser';
            voiceBtn.innerHTML = '<i class="fas fa-microphone-slash"></i> Voice Not Supported';
        }
    }
}

function startVoice() {
    if (isRecording) {
        stopRecording();
    } else {
        startRecording();
    }
}

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

            // Stop all tracks
            stream.getTracks().forEach(track => track.stop());
        };

        mediaRecorder.start();
        isRecording = true;

        // Update UI
        const voiceBtn = document.querySelector('[onclick="startVoice()"]');
        if (voiceBtn) {
            voiceBtn.innerHTML = '<i class="fas fa-stop"></i> Stop Recording';
            voiceBtn.classList.add('recording');
        }

        // Automatically stop after 10 seconds
        setTimeout(() => {
            if (isRecording) {
                stopRecording();
            }
        }, 10000);

    } catch (error) {
        console.error('Error accessing microphone:', error);
        alert('Could not access microphone. Please check permissions.');
    }
}

function stopRecording() {
    if (mediaRecorder && isRecording) {
        mediaRecorder.stop();
        isRecording = false;

        // Update UI
        const voiceBtn = document.querySelector('[onclick="startVoice()"]');
        if (voiceBtn) {
            voiceBtn.innerHTML = '<i class="fas fa-microphone"></i> Tap to speak';
            voiceBtn.classList.remove('recording');
        }
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
            // Add the transcribed text to input
            const input = document.getElementById('message-input');
            if (input) {
                input.value = data.text;
                // Optional: Auto-send after voice
                // sendMessage();
            }
            addMessage(`🎤 Voice transcribed: "${data.text}"`, 'bot');
        } else {
            addMessage('Voice input processed. Please type your message.', 'bot');
        }
    })
    .catch(error => {
        removeTypingIndicator();
        console.error('Error sending voice data:', error);
        addMessage('Voice processing failed. Please try again.', 'bot');
    });
}

// ==================== CHAT HISTORY ====================

function loadChatHistory() {
    fetch('/api/chat-history')
    .then(response => response.json())
    .then(data => {
        if (data.success && data.chats && data.chats.length > 0) {
            const messagesDiv = document.getElementById('chat-messages');
            if (messagesDiv) {
                // Clear welcome message
                messagesDiv.innerHTML = '';

                // Add history in reverse order
                data.chats.reverse().forEach(chat => {
                    if (chat.message) {
                        addMessage(chat.message, 'user');
                    }
                    if (chat.response) {
                        addMessage(chat.response, 'bot');
                    }
                });
            }
        }
    })
    .catch(error => console.error('Error loading chat history:', error));
}

// ==================== TEST IMAGES ====================

function loadTestImages() {
    fetch('/api/test-images')
    .then(response => response.json())
    .then(images => {
        let html = '';
        images.forEach(img => {
            html += `
                <div class="col-md-6 mb-3">
                    <div class="card">
                        <img src="${img.url}" class="card-img-top" alt="${img.name}" style="height: 150px; object-fit: cover;">
                        <div class="card-body">
                            <h6>${img.name}</h6>
                            <p class="small">${img.description}</p>
                            <button class="btn btn-sm btn-primary" onclick="useTestImage('${img.url}')">
                                Use This Image
                            </button>
                        </div>
                    </div>
                </div>
            `;
        });
        document.getElementById('test-images-container').innerHTML = html;

        // Show modal
        const modal = new bootstrap.Modal(document.getElementById('testImagesModal'));
        modal.show();
    })
    .catch(error => {
        console.error('Error loading test images:', error);
        alert('Could not load test images');
    });
}

function useTestImage(imageUrl) {
    fetch(imageUrl)
    .then(res => res.blob())
    .then(blob => {
        const file = new File([blob], "test-image.jpg", { type: "image/jpeg" });

        // Create form data
        const formData = new FormData();
        formData.append('image', file);

        // Show preview
        addImagePreview(imageUrl);

        // Upload
        showTypingIndicator();

        fetch('/api/analyze-image', {
            method: 'POST',
            body: formData
        })
        .then(response => response.json())
        .then(data => {
            removeTypingIndicator();
            if (data.success && data.response) {
                addMessage(data.response, 'bot');
            } else {
                addMessage('Image analysis completed', 'bot');
            }
        })
        .catch(error => {
            removeTypingIndicator();
            console.error('Error:', error);
            addMessage('Image analysis failed', 'bot');
        });
    })
    .catch(error => {
        console.error('Error loading test image:', error);
        alert('Could not load test image');
    });

    // Close modal
    const modal = bootstrap.Modal.getInstance(document.getElementById('testImagesModal'));
    if (modal) {
        modal.hide();
    }
}

// ==================== UTILITIES ====================

function exportChat() {
    const messages = [];
    document.querySelectorAll('.message').forEach(msg => {
        const textElement = msg.querySelector('.message-content');
        const text = textElement ? textElement.innerText : '';
        const isBot = msg.classList.contains('bot-message');
        const timeElement = msg.querySelector('small');
        const time = timeElement ? timeElement.innerText : '';

        messages.push({
            sender: isBot ? 'MediCoBot' : 'User',
            message: text,
            time: time
        });
    });

    const dataStr = JSON.stringify(messages, null, 2);
    const dataUri = 'data:application/json;charset=utf-8,'+ encodeURIComponent(dataStr);

    const exportFileDefaultName = `medicobot-chat-${new Date().toISOString().slice(0,10)}.json`;

    const linkElement = document.createElement('a');
    linkElement.setAttribute('href', dataUri);
    linkElement.setAttribute('download', exportFileDefaultName);
    linkElement.click();
}

// Global error handler
window.onerror = function(msg, url, lineNo, columnNo, error) {
    console.error('Global error:', {msg, url, lineNo, columnNo, error});

    // Show user-friendly message
    const errorDiv = document.createElement('div');
    errorDiv.className = 'alert alert-danger alert-dismissible fade show';
    errorDiv.role = 'alert';
    errorDiv.innerHTML = `
        An error occurred. Please refresh the page.
        <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
    `;

    const container = document.querySelector('.container');
    if (container) {
        container.prepend(errorDiv);
    }

    return false;
};