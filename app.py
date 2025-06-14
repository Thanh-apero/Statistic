from flask import Flask, render_template, request, jsonify, redirect, url_for
from datetime import datetime
import json
import os

app = Flask(__name__)

# Data storage (in production, use a proper database)
DATA_FILE = 'expenses.json'
HISTORY_FILE = 'history.json'
ARCHIVE_FILE = 'archived_expenses.json'
ADMIN_PASSWORD = 'admin123'  # Thay đổi mật khẩu này


def load_data():
    if os.path.exists(DATA_FILE):
        with open(DATA_FILE, 'r', encoding='utf-8') as f:
            return json.load(f)
    return []


def load_archive():
    if os.path.exists(ARCHIVE_FILE):
        with open(ARCHIVE_FILE, 'r', encoding='utf-8') as f:
            return json.load(f)
    return []


def save_archive(archive_data):
    with open(ARCHIVE_FILE, 'w', encoding='utf-8') as f:
        json.dump(archive_data, f, ensure_ascii=False, indent=2)


def save_data(data):
    with open(DATA_FILE, 'w', encoding='utf-8') as f:
        json.dump(data, f, ensure_ascii=False, indent=2)


def load_history():
    if os.path.exists(HISTORY_FILE):
        with open(HISTORY_FILE, 'r', encoding='utf-8') as f:
            return json.load(f)
    return []


def save_history(history):
    with open(HISTORY_FILE, 'w', encoding='utf-8') as f:
        json.dump(history, f, ensure_ascii=False, indent=2)


def add_to_history(action, data):
    history = load_history()
    history.append({
        'timestamp': datetime.now().isoformat(),
        'action': action,
        'data': data
    })
    save_history(history)


@app.route('/')
def index():
    expenses = load_data()
    return render_template('index.html', expenses=expenses)


@app.route('/api/expenses', methods=['GET'])
def get_expenses():
    return jsonify(load_data())


@app.route('/api/expenses', methods=['POST'])
def add_expense():
    data = request.json
    expenses = load_data()

    new_expense = {
        'id': len(expenses) + 1,
        'name': data['name'],
        'amount': float(data['amount']),
        'purpose': data['purpose'],
        'date': datetime.now().strftime('%Y-%m-%d %H:%M:%S')
    }

    expenses.append(new_expense)
    save_data(expenses)
    add_to_history('ADD', new_expense)

    return jsonify(new_expense)


@app.route('/api/expenses/<int:expense_id>', methods=['PUT'])
def update_expense(expense_id):
    data = request.json
    expenses = load_data()

    for expense in expenses:
        if expense['id'] == expense_id:
            old_data = expense.copy()
            expense['name'] = data['name']
            expense['amount'] = float(data['amount'])
            expense['purpose'] = data['purpose']
            expense['last_updated'] = datetime.now().strftime('%Y-%m-%d %H:%M:%S')

            save_data(expenses)
            add_to_history('UPDATE', {'old': old_data, 'new': expense})
            return jsonify(expense)

    return jsonify({'error': 'Expense not found'}), 404


@app.route('/api/expenses/<int:expense_id>', methods=['DELETE'])
def delete_expense(expense_id):
    expenses = load_data()

    for i, expense in enumerate(expenses):
        if expense['id'] == expense_id:
            deleted_expense = expenses.pop(i)
            save_data(expenses)
            add_to_history('DELETE', deleted_expense)
            return jsonify({'success': True})

    return jsonify({'error': 'Expense not found'}), 404


@app.route('/api/history', methods=['GET'])
def get_history():
    return jsonify(load_history())


@app.route('/api/archive', methods=['POST'])
def archive_data():
    password = request.json.get('password')
    if password != ADMIN_PASSWORD:
        return jsonify({'error': 'Invalid password'}), 401

    current_data = load_data()
    archive_data = load_archive()

    if current_data:
        archive_data.append({
            'timestamp': datetime.now().isoformat(),
            'data': current_data
        })
        save_archive(archive_data)
        save_data([])  # Clear current data
        add_to_history('ARCHIVE', {'count': len(current_data)})

    return jsonify({'success': True, 'archived_items': len(current_data)})


@app.route('/api/lock', methods=['POST'])
def toggle_lock():
    password = request.json.get('password')
    if password != ADMIN_PASSWORD:
        return jsonify({'error': 'Invalid password'}), 401

    # In a real app, you'd implement actual locking logic here
    return jsonify({'success': True, 'message': 'Lock state toggled'})


@app.route('/api/stats', methods=['GET'])
def get_stats():
    expenses = load_data()
    if not expenses:
        return jsonify({'total': 0, 'count': 0, 'average': 0})

    total = sum(expense['amount'] for expense in expenses)
    count = len(expenses)
    average = total / count if count > 0 else 0

    return jsonify({
        'total': total,
        'count': count,
        'average': round(average, 2)
    })


@app.route('/api/stats/people', methods=['GET'])
def get_people_stats():
    expenses = load_data()
    if not expenses:
        return jsonify([])

    people_stats = {}
    for expense in expenses:
        name = expense['name']
        if name not in people_stats:
            people_stats[name] = {
                'name': name,
                'total': 0,
                'count': 0,
                'expenses': []
            }
        people_stats[name]['total'] += expense['amount']
        people_stats[name]['count'] += 1
        people_stats[name]['expenses'].append(expense)

    # Convert to list and sort by total amount (descending)
    result = list(people_stats.values())
    result.sort(key=lambda x: x['total'], reverse=True)

    return jsonify(result)


@app.route('/api/people/<name>/expenses', methods=['GET'])
def get_person_expenses(name):
    expenses = load_data()
    person_expenses = [exp for exp in expenses if exp['name'] == name]

    if not person_expenses:
        return jsonify({'error': 'Person not found'}), 404

    total = sum(exp['amount'] for exp in person_expenses)

    return jsonify({
        'name': name,
        'expenses': person_expenses,
        'total': total,
        'count': len(person_expenses)
    })


@app.route('/api/archive/stats', methods=['GET'])
def get_archive_stats():
    archive_data = load_archive()
    if not archive_data:
        return jsonify([])

    return jsonify(archive_data)


if __name__ == '__main__':
    app.run(debug=True, host='0.0.0.0', port=5000)
