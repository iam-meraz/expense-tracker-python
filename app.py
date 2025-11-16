from flask import Flask, render_template, request, jsonify
from datetime import datetime
import json
import os
import requests

app = Flask(__name__)

# Store expenses in a JSON file
EXPENSES_FILE = 'expenses.json'
RATES_FILE = 'exchange_rates.json'

# Default base currency
BASE_CURRENCY = 'USD'


def load_expenses():
    if os.path.exists(EXPENSES_FILE):
        with open(EXPENSES_FILE, 'r') as f:
            return json.load(f)
    return []


def save_expenses(expenses):
    with open(EXPENSES_FILE, 'w') as f:
        json.dump(expenses, f)


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
    return render_template('index.html')


@app.route('/api/exchange-rates', methods=['GET'])
def get_exchange_rates():
    """Get current exchange rates"""
    rates_data = fetch_exchange_rates()
    return jsonify(rates_data)


@app.route('/api/expenses', methods=['GET'])
def get_expenses():
    expenses = load_expenses()
    return jsonify(expenses)


@app.route('/api/expenses', methods=['POST'])
def add_expense():
    data = request.json
    expenses = load_expenses()

    new_expense = {
        'id': int(datetime.now().timestamp() * 1000),
        'amount': float(data['amount']),
        'currency': data.get('currency', BASE_CURRENCY),
        'category': data['category'],
        'description': data['description'],
        'date': data['date']
    }

    expenses.append(new_expense)
    save_expenses(expenses)

    return jsonify(new_expense), 201


@app.route('/api/expenses/<int:expense_id>', methods=['PUT'])
def update_expense(expense_id):
    data = request.json
    expenses = load_expenses()

    for expense in expenses:
        if expense['id'] == expense_id:
            expense['amount'] = float(data['amount'])
            expense['currency'] = data.get('currency', BASE_CURRENCY)
            expense['category'] = data['category']
            expense['description'] = data['description']
            expense['date'] = data['date']
            break

    save_expenses(expenses)
    return jsonify({'success': True})


@app.route('/api/expenses/<int:expense_id>', methods=['DELETE'])
def delete_expense(expense_id):
    expenses = load_expenses()
    expenses = [e for e in expenses if e['id'] != expense_id]
    save_expenses(expenses)
    return jsonify({'success': True})


if __name__ == '__main__':
    app.run(debug=True, port=5000)