import google.generativeai as genai
import os
import json
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

# Configure Gemini API
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY", "")


def setup_gemini():
    """Setup Gemini AI with API key"""
    if not GEMINI_API_KEY:
        print("⚠️ Gemini API key not found. Using offline mode.")
        return None

    try:
        genai.configure(api_key=GEMINI_API_KEY)

        # Set up the model
        generation_config = {
            "temperature": 0.7,
            "top_p": 0.8,
            "top_k": 40,
            "max_output_tokens": 1024,
        }

        safety_settings = [
            {
                "category": "HARM_CATEGORY_HARASSMENT",
                "threshold": "BLOCK_MEDIUM_AND_ABOVE"
            },
            {
                "category": "HARM_CATEGORY_HATE_SPEECH",
                "threshold": "BLOCK_MEDIUM_AND_ABOVE"
            },
            {
                "category": "HARM_CATEGORY_SEXUALLY_EXPLICIT",
                "threshold": "BLOCK_MEDIUM_AND_ABOVE"
            },
            {
                "category": "HARM_CATEGORY_DANGEROUS_CONTENT",
                "threshold": "BLOCK_MEDIUM_AND_ABOVE"
            },
        ]

        model = genai.GenerativeModel(
            model_name="gemini-pro",
            generation_config=generation_config,
            safety_settings=safety_settings
        )

        print("✅ Gemini AI setup successful")
        return model
    except Exception as e:
        print(f"❌ Error setting up Gemini: {e}")
        return None


# Initialize Gemini model
gemini_model = setup_gemini()


def load_knowledge_base():
    """Load offline medical knowledge base"""
    try:
        with open('knowledge_base.json', 'r', encoding='utf-8') as f:
            return json.load(f)
    except FileNotFoundError:
        print("❌ knowledge_base.json not found")
        return []
    except json.JSONDecodeError as e:
        print(f"❌ Error parsing knowledge_base.json: {e}")
        return []


def get_offline_response(query, language='en'):
    """Get response from offline knowledge base"""
    kb = load_knowledge_base()
    query_lower = query.lower()

    for item in kb:
        keywords = item.get("keywords", [])
        for keyword in keywords:
            if keyword in query_lower:
                response_key = f"response_{language}"
                return item.get(response_key, item.get("response_en", ""))

    return None


def ask_gemini_medical(query, user_context=None):
    """Ask Gemini AI a medical question"""

    # First try offline knowledge base
    offline_response = get_offline_response(query, 'en')
    if offline_response:
        return offline_response

    # If Gemini is not available, return None
    if not gemini_model:
        return None

    try:
        # Prepare context for the AI
        context_prompt = """You are MediCoBot, a helpful and cautious AI medical assistant.

IMPORTANT RULES:
1. You are NOT a doctor - always emphasize consulting healthcare professionals
2. Never diagnose specific conditions
3. Never prescribe medications
4. Provide general health information only
5. For emergencies, advise calling emergency services immediately
6. Be clear, concise, and helpful
7. Format responses with bullet points for readability

User query: {query}

User context (if available): {user_context}

Please provide helpful medical information following the rules above."""

        # Format user context
        context_info = ""
        if user_context:
            context_parts = []
            if user_context.get('age'):
                context_parts.append(f"Age: {user_context['age']}")
            if user_context.get('gender'):
                context_parts.append(f"Gender: {user_context['gender']}")
            if user_context.get('allergies'):
                context_parts.append(f"Allergies: {user_context['allergies']}")
            if user_context.get('medications'):
                context_parts.append(f"Medications: {user_context['medications']}")

            if context_parts:
                context_info = "\n".join(context_parts)

        full_prompt = context_prompt.format(query=query, user_context=context_info)

        # Generate response
        response = gemini_model.generate_content(full_prompt)

        # Check if response is blocked
        if not response or not response.text:
            return "⚠️ I cannot provide a response to this query for safety reasons. Please consult a healthcare professional."

        # Add disclaimer
        disclaimer = "\n\n---\n⚠️ **Important**: This is AI-generated general information. Always consult a qualified healthcare professional for medical advice."

        return response.text + disclaimer

    except Exception as e:
        print(f"❌ Gemini API error: {e}")
        return None


def analyze_symptoms_with_gemini(symptoms, user_info=None):
    """Analyze symptoms with Gemini AI"""

    if not gemini_model:
        return get_offline_response(symptoms, 'en')

    try:
        prompt = f"""Analyze these symptoms: {symptoms}

Provide helpful information in this format:

1. **Possible general considerations** (not diagnosis)
2. **Recommended immediate actions**
3. **When to seek medical attention**
4. **Home care tips** (if appropriate)
5. **Emergency warning signs**

Important: Always advise consulting a doctor for proper diagnosis."""

        response = gemini_model.generate_content(prompt)
        if response and response.text:
            return response.text + "\n\n⚠️ **Note**: AI analysis only. Consult a doctor."
        return None

    except Exception as e:
        print(f"❌ Gemini symptom analysis error: {e}")
        return get_offline_response(symptoms, 'en')