import pandas as pd
import sqlite3

df = pd.read_csv('data/earthquakes_all.csv')

conn = sqlite3.connect('data/earthquakes.db')

df.to_sql('earthquakes', conn, if_exists='replace', index=False)

conn.close()
