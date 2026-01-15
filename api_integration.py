import requests
import json
from flask import current_app
import os
from dotenv import load_dotenv

load_dotenv()


class APIHandler:
    def __init__(self):
        self.gemini_api_key = os.getenv('GEMINI_API_KEY')
        self.offline_mode = os.getenv('OFFLINE_MODE', 'False').lower() == 'true'

    def call_gemini_api(self, prompt, is_image=False, image_data=None):
        """Call Gemini AI API"""
        if self.offline_mode or not self.gemini_api_key:
            return {"error": "API service unavailable in offline mode"}

        try:
            import google.generativeai as genai
            genai.configure(api_key=self.gemini_api_key)

            if is_image and image_data:
                # For image analysis
                model = genai.GenerativeModel('gemini-pro-vision')
                response = model.generate_content([prompt, image_data])
            else:
                # For text analysis
                model = genai.GenerativeModel('gemini-pro')
                response = model.generate_content(prompt)

            return {
                "success": True,
                "response": response.text,
                "model": "gemini-pro"
            }
        except Exception as e:
            return {"error": str(e)}

    def translate_text_api(self, text, target_lang):
        """Translate text using API"""
        if self.offline_mode:
            # Simple dictionary-based translation for offline
            translations = {
                'hello': {
                    'ta': 'வணக்கம்',
                    'hi': 'नमस्ते',
                    'fr': 'Bonjour',
                    'te': 'హలో',
                    'ml': 'ഹലോ',
                    'kn': 'ನಮಸ್ಕಾರ'
                }
            }

            word = text.lower().split()[0] if text else ''
            if word in translations and target_lang in translations[word]:
                return translations[word][target_lang]
            return text

        # Online translation API (using LibreTranslate or similar)
        try:
            # Example with LibreTranslate
            url = "https://libretranslate.com/translate"
            data = {
                "q": text,
                "source": "auto",
                "target": target_lang,
                "format": "text"
            }

            response = requests.post(url, json=data)
            if response.status_code == 200:
                return response.json()['translatedText']
            return text
        except:
            return text

    def get_health_news(self, language='en'):
        """Get latest health news"""
        if self.offline_mode:
            return {"news": []}

        try:
            # Example with NewsAPI
            api_key = os.getenv('NEWS_API_KEY', '')
            if api_key:
                url = f"https://newsapi.org/v2/everything?q=health&language={language}&apiKey={api_key}"
                response = requests.get(url)
                if response.status_code == 200:
                    return response.json()
            return {"news": []}
        except:
            return {"news": []}

    def check_service_status(self):
        """Check if online services are available"""
        return {
            "gemini_api": bool(self.gemini_api_key and not self.offline_mode),
            "translation_api": not self.offline_mode,
            "news_api": not self.offline_mode,
            "offline_mode": self.offline_mode
        }


# Global instance
api_handler = APIHandler()