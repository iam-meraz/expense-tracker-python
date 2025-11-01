from flask import Flask, render_template, request, jsonify
from datetime import datetime
import json
import os

app = Flask(__name__)

# Store expenses in a JSON file
EXPENSES_FILE = 'expenses.json'


def load_expenses():
    if os.path.exists(EXPENSES_FILE):
        with open(EXPENSES_FILE, 'r') as f:
            return json.load(f)
    return []


def save_expenses(expenses):
    with open(EXPENSES_FILE, 'w') as f:
        json.dump(expenses, f)


@app.route('/')
def index():
    return render_template('index.html')


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