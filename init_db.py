import os
import requests
from io import StringIO
import pandas as pd
import sqlite3

def init_database():
    if os.path.exists('data/earthquakes.db'):
        return

    if not os.path.exists('data'):
        os.makedirs('data')

    conn = sqlite3.connect('data/earthquakes.db')

    url = 'https://earthquake.usgs.gov/fdsnws/event/1/query'
    dfs = []

    for year in range(2000, 2026):
        for half in range(2):
            if half == 0:
                start_time = f'{year}-01-01'
                end_time = f'{year}-07-01'
            else:
                start_time = f'{year}-07-01'
                end_time = f'{year + 1}-01-01'
            
            params = {
                'format': 'csv',
                'starttime': start_time,
                'endtime': end_time,
                'minmagnitude': 2.5,
                'orderby': 'time-asc'
            }

            response = requests.get(url, params=params)
            df = pd.read_csv(StringIO(response.text))
            dfs.append(df)

    df_all = pd.concat(dfs, ignore_index=True)
    df_all = df_all.drop_duplicates()
    df_all = df_all[df_all['Error 400: Bad Request'].isna()]
    df_all = df_all.drop('Error 400: Bad Request', axis=1)
    df_all = df_all[['time', 'latitude', 'longitude', 'depth', 'mag', 'place']]
    df_all = df_all.sort_values('time')

    df_all.to_sql('earthquakes', conn, if_exists='replace', index=False)

    conn.close()
