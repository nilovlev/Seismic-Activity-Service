from flask import Flask, request, render_template, jsonify
from flask_apscheduler import APScheduler
import sqlite3
import requests
from datetime import datetime, timedelta

from init_db import init_database
from predictions import update_predictions

app = Flask(__name__)
scheduler = APScheduler()

def get_db():
    conn = sqlite3.connect('data/earthquakes.db')
    conn.row_factory = sqlite3.Row
    return conn

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/earthquakes')
def earthquakes():
    max_earthquakes = int(request.args.get('maxEarthquakes', 1000))
    select_mode = request.args.get('selectMode')
    min_mag = float(request.args.get('minMag', 0))
    max_mag = float(request.args.get('maxMag', 10))
    start_time = request.args.get('startDate')
    end_time = request.args.get('endDate')
    min_depth = request.args.get('minDepth', 0)
    max_depth = request.args.get('maxDepth', 1000)

    query = '''
    SELECT time, latitude, longitude, depth, mag, place
    FROM earthquakes
    WHERE mag BETWEEN ? AND ? AND depth BETWEEN ? AND ?
    '''
    
    params = [min_mag, max_mag, min_depth, max_depth]

    if start_time:
        query += ' AND time >= ?'
        params.append(start_time)

    if end_time:
        query += ' AND time <= ?'
        params.append(end_time)

    mode = 'mag' if select_mode == 'biggest' else 'time'

    query += f' ORDER BY {mode} DESC LIMIT ?'

    params.append(max_earthquakes)

    conn = get_db()
    cur = conn.cursor()
    cur.execute(query, params)
    rows = cur.fetchall()
    conn.close()

    return jsonify([dict(row) for row in rows])

@app.route('/statistics')
def statistics():
    max_earthquakes = int(request.args.get('maxEarthquakes', 1000))
    min_mag = float(request.args.get('minMag', 0))
    max_mag = float(request.args.get('maxMag', 10))
    start_time = request.args.get('startDate')
    end_time = request.args.get('endDate')
    min_depth = float(request.args.get('minDepth', 0))
    max_depth = float(request.args.get('maxDepth', 1000))

    query = '''
    SELECT 
        substr(time, 1, 4) as year,
        COUNT(*) as count,
        SUM(CASE WHEN mag >= 3 THEN 1 ELSE 0 END) as count3,
        SUM(CASE WHEN mag >= 4 THEN 1 ELSE 0 END) as count4,
        SUM(CASE WHEN mag >= 5 THEN 1 ELSE 0 END) as count5,
        SUM(CASE WHEN mag >= 6 THEN 1 ELSE 0 END) as count6,
        AVG(mag) as avg_mag,
        AVG(depth) as avg_depth
    FROM earthquakes
    '''

    where = ' WHERE mag BETWEEN ? AND ? AND depth BETWEEN ? AND ?'
    params = [min_mag, max_mag, min_depth, max_depth]

    if start_time:
        where += ' AND time >= ?'
        params.append(start_time)

    if end_time:
        where += ' AND time <= ?'
        params.append(end_time)

    query += where + ' GROUP BY year ORDER BY year'

    conn = get_db()
    cur = conn.cursor()
    cur.execute(query, params)
    rows = cur.fetchall()
    years = [dict(row) for row in rows]

    mag_query = f'''
    SELECT 
        FLOOR(MAG) as mag_bin,
        COUNT(*) as count
    FROM earthquakes
    {where}
    GROUP BY mag_bin
    ORDER BY mag_bin
    '''

    cur.execute(mag_query, params)
    rows = cur.fetchall()
    mag_hist = [dict(row) for row in rows]

    depth_query = f'''
    SELECT
        FLOOR(depth / 50) * 50 as depth_bin,
        COUNT(*) as count
    FROM earthquakes
    {where}
    GROUP BY depth_bin
    ORDER BY depth_bin
    '''

    cur.execute(depth_query, params)
    rows = cur.fetchall()
    depth_hist = [dict(row) for row in rows]

    scatter_query = f'''
    SELECT depth, mag
    FROM earthquakes
    {where}
    LIMIT {max_earthquakes}
    '''

    cur.execute(scatter_query, params)
    rows = cur.fetchall()
    scatter_chart = [dict(row) for row in rows]

    conn.close()

    return jsonify({
        'years': years,
        'mag_hist': mag_hist,
        'depth_hist': depth_hist,
        'scatter_chart': scatter_chart
    })


@scheduler.task('interval', id='update_db', hours=1)
def update_db():
    update_database()

@scheduler.task('interval', id='update_preds', days=1)
def update_preds():
    update_predictions()

def update_database():
    conn = get_db()
    cur = conn.cursor()

    cur.execute('SELECT MAX(time) FROM earthquakes')
    last_time = cur.fetchone()[0]

    url = 'https://earthquake.usgs.gov/fdsnws/event/1/query'

    params = {
        'format': 'geojson',
        'starttime': (datetime.fromisoformat(last_time) + timedelta(seconds=1)).isoformat(),
        'endtime': datetime.now().isoformat(),
        'minmagnitude': 2.5,
        'orderby': 'time-asc'
    }

    response = requests.get(url, params=params).json()

    for feature in response['features']:
        properties = feature['properties']
        coords = feature['geometry']['coordinates']

        cur.execute('''
        INSERT INTO earthquakes
        (time, latitude, longitude, depth, mag, place)
        VALUES (?, ?, ?, ?, ?, ?)
        ''', [
            datetime.fromtimestamp(properties['time'] / 1000).isoformat(),
            coords[1],
            coords[0],
            coords[2],
            properties['mag'],
            properties['place']
        ])

    conn.commit()
    conn.close()

if __name__ == '__main__':
    init_database()
    update_database()
    update_predictions()

    scheduler.init_app(app)
    scheduler.start()
    app.run(debug=False)
