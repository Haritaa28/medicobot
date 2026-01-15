import google.generativeai as genai
import os
from dotenv import load_dotenv
from PIL import Image
import io

load_dotenv()


class GeminiHelper:
    def __init__(self):
        self.api_key = os.getenv('GEMINI_API_KEY')
        if self.api_key:
            genai.configure(api_key=self.api_key)
            self.model_text = genai.GenerativeModel('gemini-pro')
            self.model_vision = genai.GenerativeModel('gemini-pro-vision')
        else:
            self.model_text = None
            self.model_vision = None

    def generate_text_response(self, prompt, context=""):
        """Generate text response using Gemini"""
        if not self.model_text:
            return "AI service is not configured. Please check your API key."

        try:
            full_prompt = f"""As a medical assistant, please respond to the following query.
            Context: {context}
            Query: {prompt}

            Guidelines:
            1. Provide accurate medical information
            2. Always recommend consulting a doctor for serious conditions
            3. Be empathetic and clear
            4. Do not provide definitive diagnoses
            5. Suggest preventive measures

            Response:"""

            response = self.model_text.generate_content(full_prompt)
            return response.text
        except Exception as e:
            return f"Error generating response: {str(e)}"

    def analyze_image(self, image_path, query=""):
        """Analyze medical image using Gemini Vision"""
        if not self.model_vision:
            return "Image analysis is not available in offline mode."

        try:
            # Open and prepare image
            img = Image.open(image_path)

            if query:
                prompt = f"""Analyze this medical image. Query: {query}

                Please provide:
                1. Observations about the image
                2. Possible conditions (with disclaimers)
                3. Recommendations for next steps
                4. Reminder to consult a doctor"""
            else:
                prompt = """Analyze this medical image for potential health conditions.
                Provide observations and recommendations, but remind to consult a doctor."""

            response = self.model_vision.generate_content([prompt, img])
            return response.text
        except Exception as e:
            return f"Error analyzing image: {str(e)}"

    def generate_multilingual_response(self, query, target_language='en'):
        """Generate response in specific language"""
        if target_language == 'en':
            return self.generate_text_response(query)

        # For other languages, generate in English then translate
        response_en = self.generate_text_response(query)

        # Simple translation dictionary (in production, use proper translation API)
        translations = {
            'ta': {'Consult a doctor': 'மருத்துவரைக் கலந்தாலோசிக்கவும்'},
            'hi': {'Consult a doctor': 'डॉक्टर से परामर्श करें'},
            'fr': {'Consult a doctor': 'Consultez un médecin'},
            'te': {'Consult a doctor': 'డాక్టర్‌ను సంప్రదించండి'},
            'ml': {'Consult a doctor': 'ഒരു ഡോക്ടറെ കാണുക'},
            'kn': {'Consult a doctor': 'ವೈದ್ಯರನ್ನು ಸಂಪರ್ಕಿಸಿ'}
        }

        if target_language in translations:
            for eng, trans in translations[target_language].items():
                response_en = response_en.replace(eng, trans)

        return response_en

    def is_available(self):
        """Check if Gemini API is available"""
        return self.api_key is not None and self.model_text is not None


# Singleton instance
gemini_helper = GeminiHelper()