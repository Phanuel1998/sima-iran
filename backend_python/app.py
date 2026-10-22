import sqlite3
import csv
import io
from datetime import datetime
from flask import Flask, request, jsonify, Response, send_file
from flask_cors import CORS

app = Flask(__name__)
CORS(app)

DB_FILE = 'field_sales.db'

def get_db_connection():
    conn = sqlite3.connect(DB_FILE)
    conn.row_factory = sqlite3.Row
    return conn

def init_db():
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS visits (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            shop_name TEXT NOT NULL,
            phone_number TEXT,
            sale_status TEXT NOT NULL CHECK(sale_status IN ('Sold', 'Rejected', 'Callback')),
            sale_amount REAL DEFAULT 0,
            notes TEXT,
            latitude REAL NOT NULL,
            longitude REAL NOT NULL,
            timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
        );
    ''')
    conn.commit()
    conn.close()

init_db()

@app.route('/api/visits', methods=['GET'])
def get_visits():
    try:
        conn = get_db_connection()
        visits = conn.execute('SELECT * FROM visits ORDER BY id DESC').fetchall()
        conn.close()
        return jsonify({
            'success': True,
            'visits': [dict(v) for v in visits]
        })
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500

@app.route('/api/visits', methods=['POST'])
def create_visit():
    try:
        data = request.get_json() or {}
        shop_name = data.get('shop_name', '').strip()
        phone_number = data.get('phone_number', '').strip()
        sale_status = data.get('sale_status', '')
        sale_amount = float(data.get('sale_amount', 0))
        notes = data.get('notes', '').strip()
        latitude = float(data.get('latitude'))
        longitude = float(data.get('longitude'))
        timestamp = data.get('timestamp') or datetime.now().strftime('%Y-%m-%d %H:%M:%S')

        if not shop_name:
            return jsonify({'success': False, 'error': 'Shop name is required'}), 400
        if sale_status not in ['Sold', 'Rejected', 'Callback']:
            return jsonify({'success': False, 'error': 'Invalid status'}), 400

        conn = get_db_connection()
        cursor = conn.cursor()
        cursor.execute('''
            INSERT INTO visits (shop_name, phone_number, sale_status, sale_amount, notes, latitude, longitude, timestamp)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        ''', (shop_name, phone_number, sale_status, sale_amount, notes, latitude, longitude, timestamp))
        conn.commit()
        visit_id = cursor.lastrowid
        new_visit = conn.execute('SELECT * FROM visits WHERE id = ?', (visit_id,)).fetchone()
        conn.close()

        return jsonify({'success': True, 'visit': dict(new_visit)}), 201
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500

@app.route('/api/visits/sync', methods=['POST'])
def sync_visits():
    try:
        data = request.get_json() or {}
        visits_list = data.get('visits', [])
        conn = get_db_connection()
        cursor = conn.cursor()
        synced_count = 0

        for v in visits_list:
            if v.get('shop_name') and v.get('sale_status') in ['Sold', 'Rejected', 'Callback']:
                cursor.execute('''
                    INSERT INTO visits (shop_name, phone_number, sale_status, sale_amount, notes, latitude, longitude, timestamp)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                ''', (
                    v.get('shop_name', '').strip(),
                    v.get('phone_number', '').strip(),
                    v.get('sale_status'),
                    float(v.get('sale_amount', 0)),
                    v.get('notes', '').strip(),
                    float(v.get('latitude', 0)),
                    float(v.get('longitude', 0)),
                    v.get('timestamp') or datetime.now().strftime('%Y-%m-%d %H:%M:%S')
                ))
                synced_count += 1
        conn.commit()
        all_visits = conn.execute('SELECT * FROM visits ORDER BY id DESC').fetchall()
        conn.close()

        return jsonify({
            'success': True,
            'syncedCount': synced_count,
            'visits': [dict(v) for v in all_visits]
        })
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500

@app.route('/api/export', methods=['GET'])
def export_csv():
    try:
        conn = get_db_connection()
        visits = conn.execute('SELECT * FROM visits ORDER BY timestamp ASC').fetchall()
        conn.close()

        output = io.StringIO()
        writer = csv.writer(output)
        writer.writerow(['id', 'shop_name', 'phone_number', 'sale_status', 'sale_amount', 'notes', 'latitude', 'longitude', 'timestamp'])

        for v in visits:
            writer.writerow([
                v['id'],
                v['shop_name'],
                v['phone_number'],
                v['sale_status'],
                f"{float(v['sale_amount'] or 0):.2f}",
                v['notes'],
                v['latitude'],
                v['longitude'],
                v['timestamp']
            ])

        output.seek(0)
        return Response(
            output.getvalue(),
            mimetype='text/csv',
            headers={'Content-Disposition': f'attachment; filename=visits_export_{datetime.now().strftime("%Y%m%d")}.csv'}
        )
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500

@app.route('/api/visits/<int:visit_id>', methods=['PUT'])
def update_visit(visit_id):
    try:
        data = request.get_json() or {}
        shop_name = data.get('shop_name', '').strip()
        phone_number = data.get('phone_number', '').strip()
        sale_status = data.get('sale_status', '')
        sale_amount = float(data.get('sale_amount', 0))
        notes = data.get('notes', '').strip()
        latitude = data.get('latitude')
        longitude = data.get('longitude')

        if not shop_name:
            return jsonify({'success': False, 'error': 'Shop name is required'}), 400

        conn = get_db_connection()
        conn.execute('''
            UPDATE visits
            SET shop_name = ?,
                phone_number = ?,
                sale_status = ?,
                sale_amount = ?,
                notes = ?,
                latitude = COALESCE(?, latitude),
                longitude = COALESCE(?, longitude)
            WHERE id = ?
        ''', (shop_name, phone_number, sale_status, sale_amount, notes, latitude, longitude, visit_id))
        conn.commit()
        updated = conn.execute('SELECT * FROM visits WHERE id = ?', (visit_id,)).fetchone()
        conn.close()

        if not updated:
            return jsonify({'success': False, 'error': 'Visit not found'}), 404
        return jsonify({'success': True, 'visit': dict(updated)})
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500

@app.route('/api/visits/<int:visit_id>', methods=['DELETE'])
def delete_visit(visit_id):
    try:
        conn = get_db_connection()
        conn.execute('DELETE FROM visits WHERE id = ?', (visit_id,))
        conn.commit()
        conn.close()
        return jsonify({'success': True, 'message': 'Visit deleted'})
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500

if __name__ == '__main__':
    print("Flask server running at http://127.0.0.1:5000")
    app.run(host='0.0.0.0', port=5000, debug=True)
