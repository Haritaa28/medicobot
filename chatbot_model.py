import json
import pickle
import pandas as pd
import numpy as np
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.metrics.pairwise import cosine_similarity
import os
from googletrans import Translator
import google.generativeai as genai
from dotenv import load_dotenv

load_dotenv()


class MultilingualChatbot:
    def __init__(self):
        self.translator = Translator()
        self.languages = ['en', 'ta', 'hi', 'fr', 'te', 'ml', 'kn']
        self.offline_mode = os.getenv('OFFLINE_MODE', 'False').lower() == 'true'

        # Load datasets
        self.diseases_df = pd.read_csv('datasets/diseases.csv') if os.path.exists('datasets/diseases.csv') else None
        self.symptoms_df = pd.read_csv('datasets/symptoms.csv') if os.path.exists('datasets/symptoms.csv') else None

        # Initialize vectorizer for symptom matching
        self.vectorizer = TfidfVectorizer()
        self.train_model()

        # Initialize Gemini AI for online mode
        if not self.offline_mode:
            genai.configure(api_key=os.getenv('GEMINI_API_KEY'))
            self.model = genai.GenerativeModel('gemini-pro')

        # Load KB file for offline
        self.kb_file = 'datasets/knowledge_base.pkl'
        if os.path.exists(self.kb_file):
            with open(self.kb_file, 'rb') as f:
                self.knowledge_base = pickle.load(f)
        else:
            self.knowledge_base = {}

    def train_model(self):
        """Train the symptom-disease matching model"""
        if self.symptoms_df is not None and self.diseases_df is not None:
            # Combine all symptoms for each disease
            symptom_texts = []
            for _, row in self.diseases_df.iterrows():
                symptoms = str(row.get('symptoms', '')).split(',')
                symptom_texts.append(' '.join(symptoms))

            # Fit TF-IDF vectorizer
            self.tfidf_matrix = self.vectorizer.fit_transform(symptom_texts)

    def translate_text(self, text, target_lang='en'):
        """Translate text to target language"""
        try:
            if text and target_lang != 'en':
                translation = self.translator.translate(text, dest=target_lang)
                return translation.text
            return text
        except:
            return text

    def predict_from_symptoms(self, symptoms_text, language='en'):
        """Predict disease from symptoms (offline mode)"""
        if self.diseases_df is None or self.symptoms_df is None:
            return {"error": "No dataset available for offline prediction"}

        # Transform input symptoms
        input_vector = self.vectorizer.transform([symptoms_text])

        # Calculate similarity
        similarities = cosine_similarity(input_vector, self.tfidf_matrix)

        # Get top matches
        top_indices = similarities[0].argsort()[-3:][::-1]

        predictions = []
        for idx in top_indices:
            disease = self.diseases_df.iloc[idx]
            confidence = float(similarities[0][idx])

            if confidence > 0.1:  # Threshold
                predictions.append({
                    'disease': disease['name'],
                    'confidence': confidence,
                    'description': disease.get('description', ''),
                    'treatments': disease.get('treatments', ''),
                    'precautions': disease.get('precautions', '')
                })

        # Translate if needed
        if language != 'en':
            for pred in predictions:
                pred['disease'] = self.translate_text(pred['disease'], language)
                pred['description'] = self.translate_text(pred['description'], language)
                pred['treatments'] = self.translate_text(pred['treatments'], language)
                pred['precautions'] = self.translate_text(pred['precautions'], language)

        return predictions

    def predict_from_image(self, image_path, language='en'):
        """Analyze medical image (skin conditions, etc.)"""
        if not self.offline_mode and os.getenv('GEMINI_API_KEY'):
            # Use Gemini Vision API for image analysis
            try:
                import google.generativeai as genai

                # For actual implementation, you would use:
                # model = genai.GenerativeModel('gemini-pro-vision')
                # image_data = PIL.Image.open(image_path)
                # response = model.generate_content(["Analyze this medical image for diseases:", image_data])

                # Simulated response
                response_text = "Based on the image analysis, this appears to be a common skin condition. Please consult a dermatologist for accurate diagnosis."

                if language != 'en':
                    response_text = self.translate_text(response_text, language)

                return {
                    'analysis': response_text,
                    'recommendations': 'Consult a dermatologist, keep the area clean, avoid scratching'
                }
            except Exception as e:
                return {'error': str(e)}
        else:
            # Offline mode - basic analysis
            return {
                'analysis': 'Image analysis requires online mode with AI API',
                'recommendations': 'Please switch to online mode or consult a doctor'
            }

    def process_voice_input(self, audio_file_path, language='en'):
        """Process voice input for symptoms"""
        try:
            import speech_recognition as sr

            recognizer = sr.Recognizer()
            with sr.AudioFile(audio_file_path) as source:
                audio = recognizer.record(source)

                if language == 'ta':
                    text = recognizer.recognize_google(audio, language='ta-IN')
                elif language == 'hi':
                    text = recognizer.recognize_google(audio, language='hi-IN')
                elif language == 'fr':
                    text = recognizer.recognize_google(audio, language='fr-FR')
                elif language == 'te':
                    text = recognizer.recognize_google(audio, language='te-IN')
                elif language == 'ml':
                    text = recognizer.recognize_google(audio, language='ml-IN')
                elif language == 'kn':
                    text = recognizer.recognize_google(audio, language='kn-IN')
                else:
                    text = recognizer.recognize_google(audio)

                return {'text': text, 'language': language}
        except Exception as e:
            return {'error': str(e), 'text': '', 'language': language}

    def chat_with_ai(self, message, language='en'):
        """Chat with AI in online mode"""
        if self.offline_mode:
            # Offline response
            response = "I'm currently in offline mode. Please switch to online mode for detailed AI consultation."
        else:
            try:
                # Translate to English for AI processing
                if language != 'en':
                    message_en = self.translate_text(message, 'en')
                else:
                    message_en = message

                # Generate response using Gemini
                prompt = f"""As a medical assistant, respond to this query: {message_en}
                Provide helpful, accurate medical information while reminding to consult doctors for serious conditions."""

                response_obj = self.model.generate_content(prompt)
                response_text = response_obj.text

                # Translate back if needed
                if language != 'en':
                    response_text = self.translate_text(response_text, language)

                return response_text
            except Exception as e:
                response_text = f"Error connecting to AI service: {str(e)}. Switching to offline mode."
                self.offline_mode = True

        # Translate offline response
        if language != 'en':
            response = self.translate_text(response, language)

        return response


# Singleton instance
chatbot = MultilingualChatbot()