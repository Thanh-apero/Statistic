from flask import Flask, render_template, request, jsonify
from flask_sqlalchemy import SQLAlchemy
from datetime import datetime
from config import Config

app = Flask(__name__)
app.config.from_object(Config)
db = SQLAlchemy(app)


# Database Models
class Expense(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(100), nullable=False)
    amount = db.Column(db.Float, nullable=False)
    purpose = db.Column(db.String(200), nullable=False)
    date = db.Column(db.DateTime, default=datetime.utcnow)
    last_updated = db.Column(db.DateTime, default=datetime.utcnow)

    def to_dict(self):
        return {
            'id': self.id,
            'name': self.name,
            'amount': self.amount,
            'purpose': self.purpose,
            'date': self.date.strftime('%Y-%m-%d %H:%M:%S'),
            'last_updated': self.last_updated.strftime('%Y-%m-%d %H:%M:%S') if self.last_updated else None
        }


class History(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    timestamp = db.Column(db.DateTime, default=datetime.utcnow)
    action = db.Column(db.String(50), nullable=False)
    data = db.Column(db.Text, nullable=False)

    def to_dict(self):
        return {
            'id': self.id,
            'timestamp': self.timestamp.isoformat(),
            'action': self.action,
            'data': self.data
        }


class Archive(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    timestamp = db.Column(db.DateTime, default=datetime.utcnow)
    data = db.Column(db.Text, nullable=False)

    def to_dict(self):
        return {
            'id': self.id,
            'timestamp': self.timestamp.isoformat(),
            'data': self.data
        }


# Create tables
with app.app_context():
    db.create_all()

def add_to_history(action, data):
    import json
    history = History(action=action, data=json.dumps(data))
    db.session.add(history)
    db.session.commit()


@app.route('/')
def index():
    expenses = Expense.query.all()
    return render_template('index.html', expenses=[exp.to_dict() for exp in expenses])


@app.route('/api/expenses', methods=['GET'])
def get_expenses():
    expenses = Expense.query.all()
    return jsonify([exp.to_dict() for exp in expenses])


@app.route('/api/expenses', methods=['POST'])
def add_expense():
    data = request.json

    new_expense = Expense(
        name=data['name'],
        amount=float(data['amount']),
        purpose=data['purpose']
    )

    db.session.add(new_expense)
    db.session.commit()

    add_to_history('ADD', new_expense.to_dict())
    return jsonify(new_expense.to_dict())


@app.route('/api/expenses/<int:expense_id>', methods=['PUT'])
def update_expense(expense_id):
    data = request.json
    expense = Expense.query.get_or_404(expense_id)

    old_data = expense.to_dict()
    expense.name = data['name']
    expense.amount = float(data['amount'])
    expense.purpose = data['purpose']
    expense.last_updated = datetime.utcnow()

    db.session.commit()
    add_to_history('UPDATE', {'old': old_data, 'new': expense.to_dict()})

    return jsonify(expense.to_dict())


@app.route('/api/expenses/<int:expense_id>', methods=['DELETE'])
def delete_expense(expense_id):
    expense = Expense.query.get_or_404(expense_id)
    deleted_data = expense.to_dict()

    db.session.delete(expense)
    db.session.commit()

    add_to_history('DELETE', deleted_data)
    return jsonify({'success': True})


@app.route('/api/history', methods=['GET'])
def get_history():
    history = History.query.order_by(History.timestamp.desc()).all()
    return jsonify([h.to_dict() for h in history])


@app.route('/api/archive', methods=['POST'])
def archive_data():
    password = request.json.get('password')
    if password != app.config['ADMIN_PASSWORD']:
        return jsonify({'error': 'Invalid password'}), 401

    expenses = Expense.query.all()
    if expenses:
        import json
        archive_entry = Archive(data=json.dumps([exp.to_dict() for exp in expenses]))
        db.session.add(archive_entry)

        # Clear current expenses
        Expense.query.delete()
        db.session.commit()

        add_to_history('ARCHIVE', {'count': len(expenses)})

        return jsonify({'success': True, 'archived_items': len(expenses)})

    return jsonify({'success': True, 'archived_items': 0})


@app.route('/api/lock', methods=['POST'])
def toggle_lock():
    password = request.json.get('password')
    if password != app.config['ADMIN_PASSWORD']:
        return jsonify({'error': 'Invalid password'}), 401

    return jsonify({'success': True, 'message': 'Lock state toggled'})


@app.route('/api/stats', methods=['GET'])
def get_stats():
    expenses = Expense.query.all()
    if not expenses:
        return jsonify({'total': 0, 'count': 0, 'average': 0})

    total = sum(expense.amount for expense in expenses)
    count = len(expenses)
    average = total / count if count > 0 else 0

    return jsonify({
        'total': total,
        'count': count,
        'average': round(average, 2)
    })


@app.route('/api/stats/people', methods=['GET'])
def get_people_stats():
    expenses = Expense.query.all()
    if not expenses:
        return jsonify([])

    people_stats = {}
    for expense in expenses:
        name = expense.name
        if name not in people_stats:
            people_stats[name] = {
                'name': name,
                'total': 0,
                'count': 0,
                'expenses': []
            }
        people_stats[name]['total'] += expense.amount
        people_stats[name]['count'] += 1
        people_stats[name]['expenses'].append(expense.to_dict())

    result = list(people_stats.values())
    result.sort(key=lambda x: x['total'], reverse=True)

    return jsonify(result)


@app.route('/api/people/<name>/expenses', methods=['GET'])
def get_person_expenses(name):
    expenses = Expense.query.filter_by(name=name).all()

    if not expenses:
        return jsonify({'error': 'Person not found'}), 404

    total = sum(exp.amount for exp in expenses)

    return jsonify({
        'name': name,
        'expenses': [exp.to_dict() for exp in expenses],
        'total': total,
        'count': len(expenses)
    })


@app.route('/api/archive/stats', methods=['GET'])
def get_archive_stats():
    archives = Archive.query.order_by(Archive.timestamp.desc()).all()
    return jsonify([arch.to_dict() for arch in archives])


if __name__ == '__main__':
    app.run(debug=True, host='0.0.0.0', port=5000)
