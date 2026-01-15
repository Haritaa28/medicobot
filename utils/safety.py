import re
from html import escape


def validate_input(text):
    """Validate user input for security"""
    if not text or not isinstance(text, str):
        return False

    # Check for SQL injection patterns
    sql_injection_patterns = [
        r'(\b(SELECT|INSERT|UPDATE|DELETE|DROP|UNION|ALTER)\b)',
        r'(\b(OR|AND)\b\s*\d+\s*=\s*\d+)',
        r'(\b(EXEC|EXECUTE|EXECSP)\b)',
        r'(\b(DECLARE|CAST|CONVERT)\b)'
    ]

    for pattern in sql_injection_patterns:
        if re.search(pattern, text, re.IGNORECASE):
            return False

    # Check for XSS patterns
    xss_patterns = [
        r'<script.*?>.*?</script>',
        r'javascript:',
        r'on\w+\s*=',
        r'data:text/html',
        r'<iframe.*?>.*?</iframe>'
    ]

    for pattern in xss_patterns:
        if re.search(pattern, text, re.IGNORECASE):
            return False

    # Check length
    if len(text) > 1000:
        return False

    return True


def sanitize_text(text):
    """Sanitize text by escaping HTML and removing dangerous characters"""
    if not text:
        return ""

    # Escape HTML
    text = escape(text)

    # Remove extra whitespace
    text = ' '.join(text.split())

    return text.strip()


def validate_file(filename, allowed_extensions=None):
    """Validate uploaded file"""
    if allowed_extensions is None:
        allowed_extensions = {'png', 'jpg', 'jpeg', 'gif', 'wav', 'mp3', 'ogg'}

    if '.' not in filename:
        return False

    ext = filename.rsplit('.', 1)[1].lower()

    # Check extension
    if ext not in allowed_extensions:
        return False

    # Check for path traversal
    if '..' in filename or '/' in filename or '\\' in filename:
        return False

    # Check filename length
    if len(filename) > 255:
        return False

    return True


def check_medical_terms(text):
    """Check if text contains medical terms (basic implementation)"""
    medical_keywords = [
        'pain', 'fever', 'cough', 'headache', 'nausea', 'vomit',
        'rash', 'itch', 'swelling', 'bleeding', 'fracture', 'wound',
        'diabetes', 'pressure', 'heart', 'lung', 'liver', 'kidney',
        'mental', 'stress', 'anxiety', 'depression', 'cancer', 'tumor'
    ]

    text_lower = text.lower()
    found_terms = []

    for term in medical_keywords:
        if term in text_lower:
            found_terms.append(term)

    return found_terms


def rate_limit_check(user_id, action, limit=10, time_window=60):
    """Simple rate limiting (to be implemented with Redis in production)"""
    # This is a basic implementation
    # In production, use Redis or similar for distributed rate limiting
    return True  # Placeholder