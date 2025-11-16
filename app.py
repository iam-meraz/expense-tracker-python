from flask import Flask, render_template, request, jsonify, session, redirect, url_for
from datetime import datetime
import json
import os
import requests
from werkzeug.security import generate_password_hash, check_password_hash
from functools import wraps

app = Flask(__name__)
app.secret_key = 'your-secret-key-change-this-in-production'  # Change this!

# Store data in JSON files
EXPENSES_FILE = 'expenses.json'
RATES_FILE = 'exchange_rates.json'
USERS_FILE = 'users.json'

# Default base currency
BASE_CURRENCY = 'USD'


def login_required(f):
    """Decorator to require login for routes"""

    @wraps(f)
    def decorated_function(*args, **kwargs):
        if 'user_id' not in session:
            return jsonify({'error': 'Authentication required'}), 401
        return f(*args, **kwargs)

    return decorated_function


def load_users():
    """Load users from file"""
    if os.path.exists(USERS_FILE):
        with open(USERS_FILE, 'r') as f:
            return json.load(f)
    return {}


def save_users(users):
    """Save users to file"""
    with open(USERS_FILE, 'w') as f:
        json.dump(users, f)


def load_expenses():
    """Load all expenses from file"""
    if os.path.exists(EXPENSES_FILE):
        with open(EXPENSES_FILE, 'r') as f:
            return json.load(f)
    return {}


def save_expenses(expenses):
    """Save all expenses to file"""
    with open(EXPENSES_FILE, 'w') as f:
        json.dump(expenses, f)


def get_user_expenses(user_id):
    """Get expenses for a specific user"""
    all_expenses = load_expenses()
    return all_expenses.get(str(user_id), [])


def save_user_expenses(user_id, expenses):
    """Save expenses for a specific user"""
    all_expenses = load_expenses()
    all_expenses[str(user_id)] = expenses
    save_expenses(all_expenses)


def load_exchange_rates():
    """Load cached exchange rates from file"""
    if os.path.exists(RATES_FILE):
        with open(RATES_FILE, 'r') as f:
            data = json.load(f)
            # Check if rates are less than 24 hours old
            last_update = datetime.fromisoformat(data.get('last_update', '2000-01-01'))
            if (datetime.now() - last_update).total_seconds() < 86400:
                return data
    return None


def save_exchange_rates(rates_data):
    """Save exchange rates to file with timestamp"""
    rates_data['last_update'] = datetime.now().isoformat()
    with open(RATES_FILE, 'w') as f:
        json.dump(rates_data, f)


def fetch_exchange_rates():
    """Fetch latest exchange rates from API"""
    try:
        # Using exchangerate-api.com (free tier available)
        response = requests.get(f'https://api.exchangerate-api.com/v4/latest/{BASE_CURRENCY}', timeout=5)
        if response.status_code == 200:
            data = response.json()
            rates_data = {
                'base': data['base'],
                'rates': data['rates'],
                'last_update': datetime.now().isoformat()
            }
            save_exchange_rates(rates_data)
            return rates_data
    except:
        pass

    # Return cached rates or default rates if API fails
    cached = load_exchange_rates()
    if cached:
        return cached

    # Fallback default rates
    return {
        'base': BASE_CURRENCY,
        'rates': {
            'USD': 1.0,
            'EUR': 0.92,
            'GBP': 0.79,
            'JPY': 149.50,
            'CNY': 7.24,
            'INR': 83.12,
            'KRW': 1319.50,
            'AUD': 1.53,
            'CAD': 1.36,
            'CHF': 0.88,
            'BDT': 110.50
        },
        'last_update': datetime.now().isoformat()
    }


@app.route('/')
def index():
    if 'user_id' not in session:
        return redirect(url_for('login_page'))
    return render_template('index.html')


@app.route('/login')
def login_page():
    if 'user_id' in session:
        return redirect(url_for('index'))
    return render_template('login.html')


@app.route('/register')
def register_page():
    if 'user_id' in session:
        return redirect(url_for('index'))
    return render_template('login.html')


@app.route('/api/register', methods=['POST'])
def register():
    """Register a new user"""
    data = request.json
    email = data.get('email', '').lower().strip()
    password = data.get('password', '')
    name = data.get('name', '').strip()

    if not email or not password or not name:
        return jsonify({'error': 'All fields are required'}), 400

    if len(password) < 6:
        return jsonify({'error': 'Password must be at least 6 characters'}), 400

    users = load_users()

    # Check if user already exists
    if email in users:
        return jsonify({'error': 'Email already registered'}), 400

    # Create new user
    user_id = str(int(datetime.now().timestamp() * 1000))
    users[email] = {
        'id': user_id,
        'name': name,
        'email': email,
        'password': generate_password_hash(password),
        'created_at': datetime.now().isoformat()
    }

    save_users(users)

    # Log the user in
    session['user_id'] = user_id
    session['user_name'] = name
    session['user_email'] = email

    return jsonify({'success': True, 'user': {'id': user_id, 'name': name, 'email': email}}), 201


@app.route('/api/login', methods=['POST'])
def login():
    """Login a user"""
    data = request.json
    email = data.get('email', '').lower().strip()
    password = data.get('password', '')

    if not email or not password:
        return jsonify({'error': 'Email and password are required'}), 400

    users = load_users()

    if email not in users:
        return jsonify({'error': 'Invalid email or password'}), 401

    user = users[email]

    if not check_password_hash(user['password'], password):
        return jsonify({'error': 'Invalid email or password'}), 401

    # Log the user in
    session['user_id'] = user['id']
    session['user_name'] = user['name']
    session['user_email'] = user['email']

    return jsonify({'success': True, 'user': {'id': user['id'], 'name': user['name'], 'email': user['email']}}), 200


@app.route('/api/logout', methods=['POST'])
def logout():
    """Logout a user"""
    session.clear()
    return jsonify({'success': True}), 200


@app.route('/api/user', methods=['GET'])
@login_required
def get_user():
    """Get current user info"""
    return jsonify({
        'id': session.get('user_id'),
        'name': session.get('user_name'),
        'email': session.get('user_email')
    }), 200


@app.route('/api/exchange-rates', methods=['GET'])
@login_required
def get_exchange_rates():
    """Get current exchange rates"""
    rates_data = fetch_exchange_rates()
    return jsonify(rates_data)


@app.route('/api/expenses', methods=['GET'])
@login_required
def get_expenses():
    """Get expenses for current user"""
    user_id = session.get('user_id')
    expenses = get_user_expenses(user_id)
    return jsonify(expenses)


@app.route('/api/expenses', methods=['POST'])
@login_required
def add_expense():
    """Add expense for current user"""
    data = request.json
    user_id = session.get('user_id')
    expenses = get_user_expenses(user_id)

    new_expense = {
        'id': int(datetime.now().timestamp() * 1000),
        'amount': float(data['amount']),
        'currency': data.get('currency', BASE_CURRENCY),
        'category': data['category'],
        'description': data['description'],
        'date': data['date']
    }

    expenses.append(new_expense)
    save_user_expenses(user_id, expenses)

    return jsonify(new_expense), 201


@app.route('/api/expenses/<int:expense_id>', methods=['PUT'])
@login_required
def update_expense(expense_id):
    """Update expense for current user"""
    data = request.json
    user_id = session.get('user_id')
    expenses = get_user_expenses(user_id)

    for expense in expenses:
        if expense['id'] == expense_id:
            expense['amount'] = float(data['amount'])
            expense['currency'] = data.get('currency', BASE_CURRENCY)
            expense['category'] = data['category']
            expense['description'] = data['description']
            expense['date'] = data['date']
            break

    save_user_expenses(user_id, expenses)
    return jsonify({'success': True})


@app.route('/api/expenses/<int:expense_id>', methods=['DELETE'])
@login_required
def delete_expense(expense_id):
    """Delete expense for current user"""
    user_id = session.get('user_id')
    expenses = get_user_expenses(user_id)
    expenses = [e for e in expenses if e['id'] != expense_id]
    save_user_expenses(user_id, expenses)
    return jsonify({'success': True})


if __name__ == '__main__':
    app.run(debug=True, port=5000)