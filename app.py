import os
import json
import time
import socket
import base64
from flask import (
    Flask, render_template, request, redirect, url_for, flash,
    jsonify, send_from_directory, session, send_file
)
from flask_login import LoginManager, UserMixin, login_user, logout_user, login_required, current_user
from werkzeug.security import check_password_hash, generate_password_hash
from werkzeug.utils import secure_filename
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

# --- Uploads
UPLOAD_FOLDER = os.path.join(os.path.dirname(__file__), "uploads")
os.makedirs(UPLOAD_FOLDER, exist_ok=True)

# --- Flask app setup
app = Flask(__name__, static_folder="static", template_folder="templates")
app.config["SECRET_KEY"] = os.getenv("FLASK_SECRET_KEY", "super_secret_key")
app.config["UPLOAD_FOLDER"] = UPLOAD_FOLDER
app.config['SQLALCHEMY_DATABASE_URI'] = 'sqlite:///medicobot.db'
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False

# Define database models
from flask_sqlalchemy import SQLAlchemy

db = SQLAlchemy(app)


# User class inherits from UserMixin
class User(UserMixin, db.Model):
    id = db.Column(db.Integer, primary_key=True)
    email = db.Column(db.String(120), unique=True, nullable=False)
    password = db.Column(db.String(200), nullable=False)
    name = db.Column(db.String(100))
    primary_crop = db.Column(db.String(100))
    region = db.Column(db.String(100))
    preferred_language = db.Column(db.String(10), default='en')
    role = db.Column(db.String(20), default='user')
    created_at = db.Column(db.DateTime, default=db.func.current_timestamp())

    # Flask-Login requires these properties
    @property
    def is_active(self):
        return True

    @property
    def is_authenticated(self):
        return True

    @property
    def is_anonymous(self):
        return False

    def get_id(self):
        return str(self.id)


class ChatHistory(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('user.id'))
    user_message = db.Column(db.Text)
    bot_response = db.Column(db.Text)
    created_at = db.Column(db.DateTime, default=db.func.current_timestamp())


# Initialize database
with app.app_context():
    db.create_all()

# login manager
login_manager = LoginManager()
login_manager.init_app(app)
login_manager.login_view = "login"


@login_manager.user_loader
def load_user(user_id):
    try:
        return db.session.get(User, int(user_id))
    except Exception:
        return None


# ==================== SIMPLE SAFETY FUNCTIONS ====================
def contains_blocked(text):
    """Check if text contains blocked content"""
    if not text:
        return False
    blocked_words = ['hack', 'attack', 'malware', 'virus', 'exploit']
    text_lower = text.lower()
    return any(word in text_lower for word in blocked_words)


def sanitize_output(text):
    """Sanitize output text"""
    if not text:
        return ""
    # Remove script tags
    import re
    text = re.sub(r'<script.*?>.*?</script>', '', text, flags=re.IGNORECASE)
    text = re.sub(r'on\w+=".*?"', '', text)
    return text


# ==================== SIMPLE CHATBOT FUNCTIONS ====================
KB_PATH = os.path.join(os.path.dirname(__file__), "knowledge_base.json")


def load_kb():
    """Load knowledge base from JSON file"""
    try:
        with open(KB_PATH, "r", encoding="utf-8") as f:
            return json.load(f)
    except:
        # Create default knowledge base
        default_kb = [
            {
                "keywords": ["hello", "hi", "hey"],
                "answer_en": "Hello! How can I help you with medical questions today?",
                "answer_hi": "नमस्ते! मैं आपकी मदद कैसे कर सकता हूं?",
                "answer_ta": "வணக்கம்! நான் உங்களுக்கு எப்படி உதவ முடியும்?"
            },
            {
                "keywords": ["fever", "temperature"],
                "answer_en": "For fever: Rest, drink plenty of fluids, and take paracetamol if needed. Consult doctor if fever persists beyond 3 days.",
                "answer_hi": "बुखार के लिए: आराम करें, पर्याप्त तरल पदार्थ पिएं, और आवश्यकता पड़ने पर पैरासिटामोल लें। यदि बुखार 3 दिन से अधिक रहता है तो डॉक्टर से सलाह लें।",
                "answer_ta": "காய்ச்சலுக்கு: ஓய்வெடுக்கவும், நிறைய திரவங்களை குடிக்கவும், தேவைப்பட்டால் பாராசிட்டமால் எடுத்துக் கொள்ளுங்கள். 3 நாட்களுக்கு மேல் காய்ச்சல் தொடர்ந்தால் மருத்துவரைக் கலந்தாலோசிக்கவும்."
            },
            {
                "keywords": ["headache", "head pain"],
                "answer_en": "For headache: Rest in a dark room, drink water, and consider over-the-counter pain relief. See a doctor if severe or persistent.",
                "answer_hi": "सिरदर्द के लिए: अंधेरे कमरे में आराम करें, पानी पिएं, और ओवर-द-काउंटर दर्द निवारक पर विचार करें। यदि गंभीर या लगातार हो तो डॉक्टर से सलाह लें।",
                "answer_ta": "தலைவலிக்கு: இருண்ட அறையில் ஓய்வெடுக்கவும், தண்ணீர் குடிக்கவும், மேலும் ஓவர்-தெ-கவுண்டர் வலி நிவாரணியைக் கவனியுங்கள். கடுமையான அல்லது தொடர்ச்சியான வலி இருந்தால் மருத்துவரைக் காணவும்."
            }
        ]
        with open(KB_PATH, "w", encoding="utf-8") as f:
            json.dump(default_kb, f, ensure_ascii=False, indent=2)
        return default_kb


def process_message(user_profile, message):
    """Process user message and return response"""
    kb = load_kb()
    message_lower = message.lower()

    # Check knowledge base
    for entry in kb:
        keywords = entry.get("keywords", [])
        for keyword in keywords:
            if keyword.lower() in message_lower:
                lang = user_profile.get("preferred_language", "en")
                answer_key = f"answer_{lang}"
                if answer_key in entry:
                    return entry[answer_key]
                else:
                    return entry.get("answer_en", "I understand, but I need more information.")

    # Default response if no match
    lang = user_profile.get("preferred_language", "en")
    if lang == "hi":
        return "मैं आपकी समस्या समझता हूं। कृपया अधिक विवरण दें या डॉक्टर से सलाह लें।"
    elif lang == "ta":
        return "நான் உங்கள் பிரச்சனையைப் புரிந்துகொள்கிறேன். தயவுசெய்து மேலும் விவரங்களை வழங்கவும் அல்லது மருத்துவரைக் கலந்தாலோசிக்கவும்."
    else:
        return "I understand your concern. Please provide more details or consult a doctor."


# ==================== VOICE PROCESSING ====================
@app.route("/api/process-voice", methods=["POST"])
def process_voice():
    """Process voice input (simulated - in real app, use speech recognition)"""
    try:
        # For now, we'll simulate voice processing
        # In a real app, you would:
        # 1. Save the audio file
        # 2. Use speech recognition (Google Speech API, Whisper, etc.)
        # 3. Return the transcribed text

        # Check if audio file is uploaded
        if 'audio' in request.files:
            audio_file = request.files['audio']
            # Save audio file
            audio_path = os.path.join(app.config['UPLOAD_FOLDER'], 'voice_input.wav')
            audio_file.save(audio_path)

            # Simulate transcription
            simulated_text = "I said: This is a simulated voice message. Please type your message for better accuracy."

            return jsonify({
                "success": True,
                "text": simulated_text,
                "message": "Voice recorded successfully (simulated)"
            })

        # Check if base64 audio data is sent
        elif request.is_json:
            data = request.get_json()
            audio_data = data.get('audio_data', '')

            if audio_data:
                # Decode base64 audio (simulated)
                # In real app: audio_bytes = base64.b64decode(audio_data.split(',')[1])

                simulated_text = "I said: This is a simulated voice-to-text conversion."

                return jsonify({
                    "success": True,
                    "text": simulated_text,
                    "message": "Voice processed successfully (simulated)"
                })

        return jsonify({
            "success": False,
            "error": "No audio data received"
        }), 400

    except Exception as e:
        print("Voice processing error:", e)
        return jsonify({
            "success": False,
            "error": "Voice processing failed",
            "message": str(e)
        }), 500


# ==================== GEMINI HELPER (DUMMY) ====================
def analyze_with_gemini(prompt):
    """Dummy Gemini helper function"""
    return "Based on analysis: This appears to be a medical query. Please consult a healthcare professional for accurate diagnosis."


# ==================== ROUTES ====================
@app.route('/')
@app.route('/home')
def home():
    """Landing page with feature cards"""
    return render_template('home.html')


@app.route('/chat')
@login_required
def chat():
    """Dedicated chat interface"""
    recent_users = None
    if current_user.is_authenticated and getattr(current_user, "role", None) == 'admin':
        recent_users = User.query.order_by(User.id.desc()).limit(20).all()
    return render_template('chat.html', recent_users=recent_users)


# Register / Login / Logout / Profile
@app.route("/register", methods=["GET", "POST"])
def register():
    if request.method == "POST":
        email = request.form["email"].strip().lower()
        if User.query.filter_by(email=email).first():
            flash("Email already registered", "warning")
            return redirect(url_for("register"))

        user = User(
            email=email,
            password=generate_password_hash(request.form["password"]),
            name=request.form.get("name", ""),
            primary_crop=request.form.get("primary_crop", ""),
            region=request.form.get("region", ""),
            preferred_language=request.form.get("preferred_language", "en")
        )
        db.session.add(user)
        db.session.commit()
        flash("Registration successful — please log in", "success")
        return redirect(url_for("login"))
    return render_template("register.html")


@app.route("/login", methods=["GET", "POST"])
def login():
    if request.method == "POST":
        email = request.form["email"].strip().lower()
        user = User.query.filter_by(email=email).first()
        if user and check_password_hash(user.password, request.form["password"]):
            login_user(user, remember=True)
            flash("Welcome back, " + (user.name or "User") + "!", "success")
            return redirect(url_for("home"))
        flash("Invalid credentials", "danger")
    return render_template("login.html")


@app.route("/logout")
@login_required
def logout():
    logout_user()
    flash("Logged out", "info")
    return redirect(url_for("home"))


@app.route("/profile", methods=["GET", "POST"])
@login_required
def profile():
    if request.method == "POST":
        current_user.name = request.form.get("name", "")
        current_user.primary_crop = request.form.get("primary_crop", "")
        current_user.region = request.form.get("region", "")
        current_user.preferred_language = request.form.get("preferred_language", "en")
        db.session.commit()
        flash("Profile updated", "success")
    return render_template("profile.html")


# Chat API
@app.route("/api/chat", methods=["POST"])
def api_chat():
    try:
        data = request.get_json() or {}
        message = (data.get("message") or "").strip()

        if not message:
            return jsonify({"response": "Please type a question."})

        if contains_blocked(message):
            return jsonify({"response": "❌ Message contains prohibited content."}), 400

        user_profile = {
            "id": current_user.id if current_user.is_authenticated else None,
            "primary_crop": getattr(current_user, "primary_crop", None),
            "region": getattr(current_user, "region", None),
            "preferred_language": getattr(current_user, "preferred_language", "en")
        }

        # Process message
        reply = process_message(user_profile, message)

        # Fallback if no reply
        if not reply or not reply.strip():
            reply = analyze_with_gemini(message)

        reply = sanitize_output(reply or "I'm currently offline. Please try again later.")

        # Save chat history
        if user_profile["id"]:
            ch = ChatHistory(user_id=user_profile["id"], user_message=message, bot_response=reply)
            db.session.add(ch)
            db.session.commit()

        return jsonify({"response": reply})

    except Exception as e:
        print("Error /api/chat:", e)
        return jsonify({"response": "Internal server error"}), 500


# Admin
@app.route("/admin")
@login_required
def admin_dashboard():
    if getattr(current_user, "role", None) != "admin":
        flash("Access denied", "danger")
        return redirect(url_for("home"))

    users = User.query.order_by(User.id.desc()).all()
    chats = ChatHistory.query.order_by(ChatHistory.created_at.desc()).limit(500).all()
    kb_content = ""
    try:
        with open(KB_PATH, "r", encoding="utf-8") as f:
            kb_content = f.read()
    except Exception:
        kb_content = "[]"
    return render_template("admin_dashboard.html", users=users, chats=chats, kb_content=kb_content)


@app.route("/admin/edit_kb", methods=["POST"])
@login_required
def admin_edit_kb():
    if getattr(current_user, "role", None) != "admin":
        return jsonify({"ok": False, "error": "unauthorized"}), 403
    data = request.form.get("kb_data", "")
    try:
        parsed = json.loads(data)
        with open(KB_PATH, "w", encoding="utf-8") as f:
            json.dump(parsed, f, ensure_ascii=False, indent=2)
        flash("KB updated", "success")
    except Exception as e:
        flash("Invalid JSON: " + str(e), "danger")
    return redirect(url_for("admin_dashboard"))


# Image analysis endpoint
ALLOWED_EXT = {'png', 'jpg', 'jpeg'}


def allowed_file(filename):
    return '.' in filename and filename.rsplit('.', 1)[1].lower() in ALLOWED_EXT


@app.route("/api/analyze-image", methods=["POST"])
@login_required
def analyze_image():
    """Enhanced image analysis endpoint"""
    try:
        if 'image' not in request.files:
            return jsonify({"success": False, "error": "No image file provided"}), 400

        file = request.files['image']

        if file.filename == '':
            return jsonify({"success": False, "error": "No file selected"}), 400

        if not file or not allowed_file(file.filename):
            return jsonify({"success": False, "error": "Invalid file type"}), 400

        # Save file
        filename = secure_filename(file.filename)
        save_path = os.path.join(app.config['UPLOAD_FOLDER'], filename)
        file.save(save_path)

        # Simple analysis
        response = f"🌿 **Image Analysis Results:**\n\n"
        response += f"**Image:** {filename}\n"
        response += f"**Status:** Image uploaded successfully\n"
        response += f"**Recommendations:** Please consult the chat for detailed analysis.\n"

        # Save to chat history
        if current_user.is_authenticated:
            ch = ChatHistory(
                user_id=current_user.id,
                user_message=f"[Image Uploaded: {filename}]",
                bot_response=response
            )
            db.session.add(ch)
            db.session.commit()

        return jsonify({
            "success": True,
            "response": response,
            "filename": filename
        })

    except Exception as e:
        print("Image analysis error:", e)
        return jsonify({
            "success": False,
            "error": "Image analysis failed",
            "message": str(e)
        }), 500


@app.route("/admin/delete_user/<int:user_id>", methods=["POST"])
@login_required
def admin_delete_user(user_id):
    if getattr(current_user, "role", None) != "admin":
        flash("Access denied!", "danger")
        return redirect(url_for("home"))

    user = User.query.get_or_404(user_id)
    if getattr(user, "role", None) == "admin":
        flash("You cannot delete another admin.", "warning")
        return redirect(url_for("admin_dashboard"))

    db.session.delete(user)
    db.session.commit()
    flash("User deleted successfully!", "success")
    return redirect(url_for("admin_dashboard"))


if __name__ == "__main__":
    # Create a default admin user
    with app.app_context():
        if not User.query.filter_by(email="admin@example.com").first():
            admin = User(
                email="admin@example.com",
                password=generate_password_hash("admin123"),
                name="Admin",
                role="admin"
            )
            db.session.add(admin)
            db.session.commit()
            print("Default admin created: admin@example.com / admin123")

    app.run(debug=True, host="0.0.0.0", port=5000)