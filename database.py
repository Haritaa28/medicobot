from flask_sqlalchemy import SQLAlchemy
from flask_login import UserMixin
from datetime import datetime

db = SQLAlchemy()


class User(UserMixin, db.Model):
    id = db.Column(db.Integer, primary_key=True)
    username = db.Column(db.String(80), unique=True, nullable=False)
    email = db.Column(db.String(120), unique=True, nullable=False)
    password = db.Column(db.String(200), nullable=False)
    phone = db.Column(db.String(20))
    language = db.Column(db.String(10), default='en')
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    # Relationships
    chat_history = db.relationship('ChatHistory', backref='user', lazy=True)
    predictions = db.relationship('Prediction', backref='user', lazy=True)


class ChatHistory(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=False)
    message = db.Column(db.Text, nullable=False)
    response = db.Column(db.Text, nullable=False)
    modality = db.Column(db.String(20))  # text, voice, image
    language = db.Column(db.String(10))
    timestamp = db.Column(db.DateTime, default=datetime.utcnow)


class Prediction(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=False)
    symptoms = db.Column(db.Text, nullable=False)
    prediction = db.Column(db.Text, nullable=False)
    confidence = db.Column(db.Float)
    modality = db.Column(db.String(20))
    image_path = db.Column(db.String(255))
    timestamp = db.Column(db.DateTime, default=datetime.utcnow)


class Disease(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(200), nullable=False)
    category = db.Column(db.String(50))  # skin, fever, chronic, mental, etc.
    symptoms = db.Column(db.Text)
    description = db.Column(db.Text)
    treatments = db.Column(db.Text)
    precautions = db.Column(db.Text)
    severity = db.Column(db.String(20))
    multilingual_name = db.Column(db.Text)  # JSON string with translations


class Symptom(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(200), nullable=False)
    category = db.Column(db.String(50))
    multilingual_name = db.Column(db.Text)


def init_db(app):
    db.init_app(app)
    with app.app_context():
        db.create_all()
        # Load initial data from CSV files
        load_initial_data()


def load_initial_data():
    import pandas as pd
    import os
    import json

    # Load diseases
    if os.path.exists('datasets/diseases.csv'):
        df = pd.read_csv('datasets/diseases.csv')
        for _, row in df.iterrows():
            if not Disease.query.filter_by(name=row['name']).first():
                disease = Disease(
                    name=row['name'],
                    category=row.get('category', 'general'),
                    symptoms=row.get('symptoms', ''),
                    description=row.get('description', ''),
                    treatments=row.get('treatments', ''),
                    precautions=row.get('precautions', ''),
                    severity=row.get('severity', 'medium'),
                    multilingual_name=json.dumps({
                        'en': row['name'],
                        'ta': row.get('name_ta', row['name']),
                        'hi': row.get('name_hi', row['name']),
                        'fr': row.get('name_fr', row['name']),
                        'te': row.get('name_te', row['name']),
                        'ml': row.get('name_ml', row['name']),
                        'kn': row.get('name_kn', row['name'])
                    })
                )
                db.session.add(disease)

    # Load symptoms
    if os.path.exists('datasets/symptoms.csv'):
        df = pd.read_csv('datasets/symptoms.csv')
        for _, row in df.iterrows():
            if not Symptom.query.filter_by(name=row['name']).first():
                symptom = Symptom(
                    name=row['name'],
                    category=row.get('category', 'general'),
                    multilingual_name=json.dumps({
                        'en': row['name'],
                        'ta': row.get('name_ta', row['name']),
                        'hi': row.get('name_hi', row['name']),
                        'fr': row.get('name_fr', row['name']),
                        'te': row.get('name_te', row['name']),
                        'ml': row.get('name_ml', row['name']),
                        'kn': row.get('name_kn', row['name'])
                    })
                )
                db.session.add(symptom)

    db.session.commit()