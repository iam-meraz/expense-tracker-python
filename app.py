from flask import Flask, render_template, request, jsonify, session, redirect, url_for
from datetime import datetime
import json
import os
import requests
from werkzeug.security import generate_password_hash, check_password_hash
from functools import wraps

app = Flask(__name__)
app.secret_key = os.environ.get('SECRET_KEY', 'change-this-secret-key-in-production')

# File paths
EXPENSES_FILE = 'expenses.json'
RATES_FILE = 'exchange_rates.json'
USERS_FILE = 'users.json'
BASE_CURRENCY = 'USD'


def init_files():
    """Initialize JSON files if they don't exist"""
    for file in [USERS_FILE, EXPENSES_FILE, RATES_FILE]:
        if not os.path.exists(file):
            with open(file, 'w') as f:
                json.dump({}, f)


def login_required(f):
    """Decorator to require login"""

    @wraps(f)
    def decorated_function(*args, **kwargs):
        if 'user_id' not in session:
            return redirect(url_for('login_page'))
        return f(*args, **kwargs)

    return decorated_function


def load_json(filename):
    """Load JSON file safely"""
    try:
        if os.path.exists(filename):
            with open(filename, 'r') as f:
                data = json.load(f)
                return data if isinstance(data, dict) else {}
    except:
        pass
    return {}


def save_json(filename, data):
    """Save JSON file"""
    with open(filename, 'w') as f:
        json.dump(data, f, indent=2)


def get_user_expenses(user_id):
    """Get expenses for a user"""
    all_expenses = load_json(EXPENSES_FILE)
    user_id_str = str(user_id)
    if user_id_str in all_expenses and isinstance(all_expenses[user_id_str], list):
        return all_expenses[user_id_str]
    return []


def save_user_expenses(user_id, expenses_list):
    """Save expenses for a user"""
    all_expenses = load_json(EXPENSES_FILE)
    all_expenses[str(user_id)] = expenses_list
    save_json(EXPENSES_FILE, all_expenses)


def fetch_exchange_rates():
    """Fetch exchange rates"""
    try:
        response = requests.get(f'https://api.exchangerate-api.com/v4/latest/{BASE_CURRENCY}', timeout=5)
        if response.status_code == 200:
            data = response.json()
            rates_data = {
                'base': data['base'],
                'rates': data['rates'],
                'last_update': datetime.now().isoformat()
            }
            save_json(RATES_FILE, rates_data)
            return rates_data
    except:
        pass

    # Return cached or default rates
    cached = load_json(RATES_FILE)
    if cached and 'rates' in cached:
        return cached

    return {
        'base': BASE_CURRENCY,
        'rates': {
            'USD': 1.0, 'EUR': 0.92, 'GBP': 0.79, 'JPY': 149.50,
            'CNY': 7.24, 'INR': 83.12, 'KRW': 1319.50, 'AUD': 1.53,
            'CAD': 1.36, 'CHF': 0.88, 'BDT': 110.50
        },
        'last_update': datetime.now().isoformat()
    }


# Routes
@app.route('/')
@login_required
def index():
    user = {
        'name': session.get('user_name', 'User'),
        'email': session.get('user_email', '')
    }
    rates = fetch_exchange_rates()
    rates_date = datetime.fromisoformat(rates['last_update']).strftime('%Y-%m-%d')
    return render_template('index.html', user=user, rates_date=rates_date)


@app.route('/login')
def login_page():
    if 'user_id' in session:
        return redirect(url_for('index'))
    return render_template('login.html')


@app.route('/api/register', methods=['POST'])
def register():
    try:
        data = request.json
        email = data.get('email', '').lower().strip()
        password = data.get('password', '')
        name = data.get('name', '').strip()

        if not email or not password or not name:
            return jsonify({'error': 'All fields required'}), 400

        if len(password) < 6:
            return jsonify({'error': 'Password must be at least 6 characters'}), 400

        users = load_json(USERS_FILE)

        if email in users:
            return jsonify({'error': 'Email already registered'}), 400

        user_id = str(int(datetime.now().timestamp() * 1000))
        users[email] = {
            'id': user_id,
            'name': name,
            'email': email,
            'password': generate_password_hash(password),
            'created_at': datetime.now().isoformat()
        }

        save_json(USERS_FILE, users)

        session['user_id'] = user_id
        session['user_name'] = name
        session['user_email'] = email

        return jsonify({'success': True}), 201
    except Exception as e:
        print(f"Registration error: {e}")
        return jsonify({'error': 'Registration failed'}), 500


@app.route('/api/login', methods=['POST'])
def login():
    try:
        data = request.json
        email = data.get('email', '').lower().strip()
        password = data.get('password', '')

        if not email or not password:
            return jsonify({'error': 'Email and password required'}), 400

        users = load_json(USERS_FILE)

        if email not in users:
            return jsonify({'error': 'Invalid email or password'}), 401

        user = users[email]

        if not check_password_hash(user['password'], password):
            return jsonify({'error': 'Invalid email or password'}), 401

        session['user_id'] = user['id']
        session['user_name'] = user['name']
        session['user_email'] = user['email']

        return jsonify({'success': True}), 200
    except Exception as e:
        print(f"Login error: {e}")
        return jsonify({'error': 'Login failed'}), 500


@app.route('/api/logout', methods=['GET', 'POST'])
def logout():
    session.clear()
    return redirect(url_for('login_page'))


@app.route('/api/user')
@login_required
def get_user():
    return jsonify({
        'id': session.get('user_id'),
        'name': session.get('user_name'),
        'email': session.get('user_email')
    })


@app.route('/api/exchange-rates')
@login_required
def get_exchange_rates():
    return jsonify(fetch_exchange_rates())


@app.route('/api/expenses', methods=['GET'])
@login_required
def get_expenses():
    try:
        user_id = session.get('user_id')
        expenses = get_user_expenses(user_id)
        return jsonify(expenses)
    except Exception as e:
        print(f"Error getting expenses: {e}")
        return jsonify([])


@app.route('/api/expenses', methods=['POST'])
@login_required
def add_expense():
    try:
        data = request.json
        user_id = session.get('user_id')
        expenses_list = get_user_expenses(user_id)

        new_expense = {
            'id': int(datetime.now().timestamp() * 1000),
            'amount': float(data.get('amount', 0)),
            'currency': data.get('currency', BASE_CURRENCY),
            'category': data.get('category', 'Other'),
            'description': data.get('description', ''),
            'date': data.get('date', datetime.now().strftime('%Y-%m-%d'))
        }

        expenses_list.append(new_expense)
        save_user_expenses(user_id, expenses_list)

        return jsonify(new_expense), 201
    except Exception as e:
        print(f"Error adding expense: {e}")
        return jsonify({'error': str(e)}), 500


@app.route('/api/expenses/<int:expense_id>', methods=['DELETE'])
@login_required
def delete_expense(expense_id):
    try:
        user_id = session.get('user_id')
        expenses_list = get_user_expenses(user_id)
        expenses_list = [e for e in expenses_list if e['id'] != expense_id]
        save_user_expenses(user_id, expenses_list)
        return jsonify({'success': True})
    except Exception as e:
        print(f"Error deleting expense: {e}")
        return jsonify({'error': str(e)}), 500


@app.route('/api/expenses/<int:expense_id>', methods=['PUT'])
@login_required
def update_expense(expense_id):
    try:
        data = request.json
        user_id = session.get('user_id')
        expenses_list = get_user_expenses(user_id)

        for expense in expenses_list:
            if expense['id'] == expense_id:
                expense['amount'] = float(data.get('amount', expense['amount']))
                expense['currency'] = data.get('currency', expense['currency'])
                expense['category'] = data.get('category', expense['category'])
                expense['description'] = data.get('description', expense['description'])
                expense['date'] = data.get('date', expense['date'])
                if 'type' in expense:
                    expense['type'] = data.get('type', expense['type'])
                break

        save_user_expenses(user_id, expenses_list)
        return jsonify({'success': True})
    except Exception as e:
        print(f"Error updating expense: {e}")
        return jsonify({'error': str(e)}), 500


@app.route('/api/income/transaction', methods=['POST'])
@login_required
def add_income_transaction():
    try:
        data = request.json
        user_id = session.get('user_id')
        expenses_list = get_user_expenses(user_id)

        new_income = {
            'id': int(datetime.now().timestamp() * 1000),
            'amount': -abs(float(data.get('amount', 0))),
            'currency': data.get('currency', BASE_CURRENCY),
            'category': 'Income',
            'description': data.get('description', ''),
            'date': data.get('date', datetime.now().strftime('%Y-%m-%d')),
            'type': 'income'
        }

        expenses_list.append(new_income)
        save_user_expenses(user_id, expenses_list)

        return jsonify(new_income), 201
    except Exception as e:
        print(f"Error adding income: {e}")
        return jsonify({'error': str(e)}), 500


if __name__ == '__main__':
    init_files()
    print("=" * 50)
    print("💰 Expense Tracker Started")
    print("=" * 50)
    app.run(debug=True, port=5000)