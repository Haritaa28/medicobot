import os
import json
from flask import (
    Flask, render_template, request, redirect, url_for, flash,
    jsonify, send_from_directory, session
)
from flask_login import LoginManager, UserMixin, login_user, logout_user, login_required, current_user
from werkzeug.security import check_password_hash, generate_password_hash
from werkzeug.utils import secure_filename
from dotenv import load_dotenv
from datetime import datetime

# Load environment variables
load_dotenv()

# Import Gemini helper
try:
    from gemini_helper import ask_gemini_medical, get_offline_response

    GEMINI_AVAILABLE = True
    print("✅ Gemini AI enabled")
except ImportError:
    GEMINI_AVAILABLE = False
    print("⚠️ Gemini AI not available - using offline mode only")

# --- Uploads
UPLOAD_FOLDER = os.path.join(os.path.dirname(__file__), "uploads")
os.makedirs(UPLOAD_FOLDER, exist_ok=True)

# --- Flask app setup
app = Flask(__name__, static_folder="static", template_folder="templates")
app.config["SECRET_KEY"] = os.getenv("FLASK_SECRET_KEY", "super_secret_key_123")
app.config["UPLOAD_FOLDER"] = UPLOAD_FOLDER
app.config['SQLALCHEMY_DATABASE_URI'] = 'sqlite:///medicobot.db'
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False
app.config['MAX_CONTENT_LENGTH'] = 16 * 1024 * 1024  # 16MB max file size

# Define database models
from flask_sqlalchemy import SQLAlchemy

db = SQLAlchemy(app)


# User class inherits from UserMixin
class User(UserMixin, db.Model):
    id = db.Column(db.Integer, primary_key=True)
    email = db.Column(db.String(120), unique=True, nullable=False)
    password = db.Column(db.String(200), nullable=False)
    username = db.Column(db.String(100), unique=True, nullable=False, default='')
    name = db.Column(db.String(100), default='')
    full_name = db.Column(db.String(100), default='')
    age = db.Column(db.Integer, default=0)
    gender = db.Column(db.String(10), default='')
    blood_group = db.Column(db.String(5), default='')
    allergies = db.Column(db.Text, default='')
    medications = db.Column(db.Text, default='')
    preferred_language = db.Column(db.String(10), default='en')
    role = db.Column(db.String(20), default='user')
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    def get_id(self):
        return str(self.id)


class ChatHistory(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('user.id'))
    user_message = db.Column(db.Text)
    bot_response = db.Column(db.Text)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)


class MedicalRecord(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('user.id'))
    symptom = db.Column(db.Text)
    diagnosis = db.Column(db.Text)
    prescription = db.Column(db.Text)
    image_path = db.Column(db.String(200))
    created_at = db.Column(db.DateTime, default=datetime.utcnow)


# Initialize database
with app.app_context():
    db.create_all()
    print("✅ Database tables created")

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


# ==================== OFFLINE RESPONSES ====================
def get_default_response(language='en'):
    """Get default response when no match found"""
    default_responses = {
        "en": """I understand your concern. For accurate medical advice:

🔍 **Please provide more details:**
• Duration of symptoms
• Severity (mild/moderate/severe)
• Other symptoms
• Any medications taken

⚠️ **For emergencies:**
• Chest pain
• Difficulty breathing
• Severe bleeding
• Loss of consciousness
→ Call emergency services immediately!

🏥 **Otherwise, consult a healthcare professional for proper diagnosis.**""",

        "hi": """मैं आपकी चिंता समझता हूं। सटीक चिकित्सा सलाह के लिए:

🔍 **कृपया अधिक विवरण दें:**
• लक्षणों की अवधि
• गंभीरता (हल्की/मध्यम/गंभीर)
• अन्य लक्षण
• कोई दवा ली गई

⚠️ **आपात स्थिति के लिए:**
• सीने में दर्द
• सांस लेने में तकलीफ
• गंभीर रक्तस्राव
• बेहोशी
→ तुरंत आपातकालीन सेवाओं को कॉल करें!

🏥 **अन्यथा, उचित निदान के लिए स्वास्थ्य देखभाल पेशेवर से परामर्श लें।**""",

        "ta": """உங்கள் கவலையை நான் புரிந்துகொள்கிறேன். துல்லியமான மருத்துவ ஆலோசனைக்கு:

🔍 **தயவுசெய்து மேலும் விவரங்களை வழங்கவும்:**
• அறிகுறிகளின் கால அளவு
• தீவிரம் (லேசான/மிதமான/கடுமையான)
• பிற அறிகுறிகள்
• எந்த மருந்துகள் எடுத்துக் கொள்ளப்படுகின்றன

⚠️ **அவசர நிலைமைகளுக்கு:**
• மார்பு வலி
• சுவாசிக்கும் சிரமம்
• கடுமையான இரத்தப்போக்கு
• உணர்விழப்பு
→ உடனடியாக அவசர சேவைகளை அழைக்கவும்!

🏥 **இல்லையெனில், சரியான நோய் கண்டறிதலுக்கு ஒரு சுகாதார நிபுணரைக் கலந்தாலோசிக்கவும்.**"""
    }
    return default_responses.get(language, default_responses["en"])


# ==================== ROUTES ====================
@app.route('/')
@app.route('/home')
@app.route('/index')
def home():
    """Landing page with feature cards"""
    return render_template('index.html')


@app.route('/chat')
@login_required
def chat():
    """Dedicated chat interface"""
    return render_template('chat.html')


# ==================== PROFILE ROUTE ====================
@app.route("/profile", methods=["GET", "POST"])
@login_required
def profile():
    """Profile page with editing functionality"""
    if request.method == 'POST':
        try:
            current_user.full_name = request.form.get('full_name', current_user.full_name)

            age_input = request.form.get('age')
            current_user.age = int(age_input) if age_input else 0

            current_user.gender = request.form.get('gender', current_user.gender)
            current_user.blood_group = request.form.get('blood_group', current_user.blood_group)
            current_user.allergies = request.form.get('allergies', current_user.allergies)
            current_user.medications = request.form.get('medications', current_user.medications)
            current_user.preferred_language = request.form.get('preferred_language', current_user.preferred_language)

            new_password = request.form.get('new_password')
            if new_password and new_password.strip():
                current_user.password = generate_password_hash(new_password)

            db.session.commit()
            flash('Profile updated successfully!', 'success')
            return redirect(url_for('profile'))

        except Exception as e:
            db.session.rollback()
            flash(f'Error updating profile: {str(e)}', 'danger')
            return redirect(url_for('profile'))

    return render_template('profile.html')


# ==================== REGISTER / LOGIN / LOGOUT ====================
@app.route("/register", methods=["GET", "POST"])
def register():
    if request.method == "POST":
        email = request.form["email"].strip().lower()
        password = request.form["password"]
        full_name = request.form.get("full_name", "")

        if User.query.filter_by(email=email).first():
            flash("Email already registered", "warning")
            return redirect(url_for("register"))

        # Generate username from email
        username = email.split('@')[0]

        user = User(
            email=email,
            username=username,
            password=generate_password_hash(password),
            full_name=full_name,
            name=full_name
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
        password = request.form["password"]

        user = User.query.filter_by(email=email).first()

        if user and check_password_hash(user.password, password):
            login_user(user, remember=True)
            flash(f"Welcome back, {user.full_name or user.name or 'User'}!", "success")
            return redirect(url_for("home"))

        flash("Invalid credentials", "danger")

    return render_template("login.html")


@app.route("/logout")
@login_required
def logout():
    logout_user()
    flash("Logged out", "info")
    return redirect(url_for("home"))


# ==================== CHAT API ====================
@app.route("/api/chat", methods=["POST"])
@login_required
def api_chat():
    try:
        data = request.get_json() or {}
        message = (data.get("message") or "").strip()

        if not message:
            return jsonify({"response": "Please type a question."})

        language = current_user.preferred_language or 'en'
        reply = ""

        # First try offline knowledge base
        if GEMINI_AVAILABLE:
            try:
                offline_reply = get_offline_response(message, language)
                if offline_reply:
                    reply = offline_reply
            except:
                pass

        # If no offline response, try Gemini AI
        if not reply and GEMINI_AVAILABLE:
            try:
                # Prepare user context for Gemini
                user_context = {}
                if current_user.age:
                    user_context['age'] = current_user.age
                if current_user.gender:
                    user_context['gender'] = current_user.gender
                if current_user.allergies:
                    user_context['allergies'] = current_user.allergies
                if current_user.medications:
                    user_context['medications'] = current_user.medications

                gemini_reply = ask_gemini_medical(message, user_context)
                if gemini_reply:
                    reply = f"🤖 **AI Analysis:**\n\n{gemini_reply}"
            except Exception as e:
                print(f"Gemini error: {e}")
                reply = get_default_response(language)

        # Fallback to default response
        if not reply:
            reply = get_default_response(language)

        # Add language indicator for non-English
        if language != 'en' and "🤖 **AI Analysis:**" in reply:
            lang_names = {'hi': 'Hindi', 'ta': 'Tamil'}
            reply = f"🌐 Response in {lang_names.get(language, 'English')}:\n\n{reply}"

        # Save to chat history
        ch = ChatHistory(
            user_id=current_user.id,
            user_message=message,
            bot_response=reply
        )
        db.session.add(ch)
        db.session.commit()

        return jsonify({"response": reply})

    except Exception as e:
        print("Error /api/chat:", e)
        return jsonify({"response": "Internal server error. Please try again."}), 500


# ==================== IMAGE UPLOAD ====================
ALLOWED_EXTENSIONS = {'png', 'jpg', 'jpeg', 'gif'}


def allowed_file(filename):
    return '.' in filename and filename.rsplit('.', 1)[1].lower() in ALLOWED_EXTENSIONS


@app.route("/api/analyze-image", methods=["POST"])
@login_required
def analyze_image():
    """Analyze medical image"""
    try:
        if 'image' not in request.files:
            return jsonify({"success": False, "error": "No image file provided"}), 400

        file = request.files['image']

        if file.filename == '':
            return jsonify({"success": False, "error": "No image selected"}), 400

        if not file or not allowed_file(file.filename):
            return jsonify({"success": False, "error": "Invalid file type. Allowed: PNG, JPG, JPEG, GIF"}), 400

        # Save file
        filename = secure_filename(file.filename)
        filepath = os.path.join(app.config['UPLOAD_FOLDER'], filename)
        file.save(filepath)

        # Simple analysis
        response = f"**📷 Image Analysis Results:**\n\n"
        response += f"**Image:** {filename}\n"
        response += f"**Status:** Uploaded successfully\n"
        response += f"**Size:** {os.path.getsize(filepath) // 1024} KB\n\n"
        response += "**📋 Recommendations:**\n"
        response += "• Please describe the symptoms related to this image\n"
        response += "• For medical diagnosis, consult a healthcare professional\n"
        response += "• Keep the original image for doctor's reference\n\n"
        response += "⚠️ **Note:** AI image analysis is for preliminary review only."

        # Save to chat history
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
            "filename": filename,
            "filepath": f"/uploads/{filename}"
        })

    except Exception as e:
        print("Image analysis error:", e)
        return jsonify({
            "success": False,
            "error": "Image analysis failed",
            "message": str(e)
        }), 500


# ==================== VOICE PROCESSING ====================
@app.route("/api/process-voice", methods=["POST"])
@login_required
def process_voice():
    """Process voice input (simulated)"""
    try:
        # In a real app, you would process audio file
        # For now, we'll return a simulated response
        return jsonify({
            "success": True,
            "text": "Voice input received. Please type your symptoms for detailed assistance.",
            "message": "Voice processing simulated. Please type your message."
        })
    except Exception as e:
        return jsonify({
            "success": False,
            "error": str(e)
        }), 500


# ==================== ADDITIONAL ENDPOINTS ====================
@app.route("/api/chat-history")
@login_required
def get_chat_history():
    """Get user's chat history"""
    chats = ChatHistory.query.filter_by(user_id=current_user.id).order_by(ChatHistory.created_at.desc()).limit(50).all()

    chats_list = []
    for chat in chats:
        chats_list.append({
            'id': chat.id,
            'message': chat.user_message,
            'response': chat.bot_response,
            'date': chat.created_at.strftime('%Y-%m-%d %H:%M') if chat.created_at else ''
        })

    return jsonify({'chats': chats_list})


@app.route("/api/medical-records")
@login_required
def get_medical_records():
    """Get user's medical records"""
    # Get both chat history and medical records
    chats = ChatHistory.query.filter_by(user_id=current_user.id).order_by(ChatHistory.created_at.desc()).limit(20).all()

    records = []
    for chat in chats:
        # Check if it looks like a medical query
        medical_keywords = ['pain', 'fever', 'headache', 'cough', 'cold', 'symptom', 'hurt', 'doctor']
        if any(keyword in chat.user_message.lower() for keyword in medical_keywords):
            records.append({
                'id': chat.id,
                'symptom': chat.user_message[:100] + ('...' if len(chat.user_message) > 100 else ''),
                'diagnosis': 'AI Preliminary Analysis',
                'prescription': 'Consult healthcare professional',
                'date': chat.created_at.strftime('%Y-%m-%d %H:%M') if chat.created_at else '',
                'image': None
            })

    return jsonify({'records': records})


@app.route("/uploads/<filename>")
@login_required
def uploaded_file(filename):
    """Serve uploaded files"""
    return send_from_directory(app.config['UPLOAD_FOLDER'], filename)


# ==================== CREATE DEFAULT ADMIN ====================
with app.app_context():
    if not User.query.filter_by(email="admin@medicobot.com").first():
        admin = User(
            email="admin@medicobot.com",
            username="admin",
            password=generate_password_hash("admin123"),
            full_name="Administrator",
            name="Admin",
            role="admin"
        )
        db.session.add(admin)
        db.session.commit()
        print("✅ Default admin created: admin@medicobot.com / admin123")


# ==================== ERROR HANDLERS ====================
@app.errorhandler(404)
def not_found_error(error):
    return render_template('404.html'), 404


@app.errorhandler(500)
def internal_error(error):
    db.session.rollback()
    return render_template('500.html'), 500


# ==================== RUN APPLICATION ====================
if __name__ == "__main__":
    print("\n" + "=" * 50)
    print("🚀 MediCoBot AI Medical Assistant")
    print("=" * 50)
    print(f"🔐 Flask Secret Key: {'✅ SET' if app.config['SECRET_KEY'] else '❌ NOT SET'}")
    print(f"🤖 Gemini AI: {'✅ ENABLED' if GEMINI_AVAILABLE else '⚠️ OFFLINE MODE'}")
    print(f"💾 Database: medicobot.db")
    print(f"📁 Uploads: {app.config['UPLOAD_FOLDER']}")
    print("=" * 50)
    print("🌐 Server running at: http://localhost:5000")
    print("=" * 50 + "\n")

    app.run(debug=True, host='0.0.0.0', port=5000)