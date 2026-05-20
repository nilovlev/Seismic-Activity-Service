import sqlite3
import pandas as pd
import numpy as np
import xgboost as xgb

def update_predictions():
    conn = sqlite3.connect('data/earthquakes.db')
    df = pd.read_sql_query("SELECT * FROM earthquakes WHERE time >= '2025-01-01'", conn)

    df = df[['time', 'latitude', 'longitude', 'depth', 'mag']]
    df['time'] = pd.to_datetime(df['time'], format='mixed', utc=True).dt.tz_convert(None)
    df = df.sort_values('time')
    df['week'] = df['time'].dt.to_period('W').dt.start_time

    df['grid_lat'] = np.floor(df['latitude'])
    df['grid_lon'] = np.floor(df['longitude'])

    df['energy'] = 10 ** (5.24 + 1.44 * df['mag'])

    df_grid = df[['depth', 'mag', 'energy', 'week', 'grid_lat', 'grid_lon']]

    df_grid_weeks = df_grid.groupby(['week', 'grid_lat', 'grid_lon']).agg({
        'mag': ['count', 'max', 'mean'],
        'depth': ['mean', 'max'],
        'energy': ['sum']
    })

    df_grid_weeks.columns = ['earthquakes_count', 'max_mag', 'mean_mag', 'mean_depth', 'max_depth', 'energy_sum']

    df_grid_weeks = df_grid_weeks.reset_index()

    df_grid_weeks = df_grid_weeks.sort_values(['grid_lat', 'grid_lon', 'week'])

    df_grid_weeks['grid_cell'] = df_grid_weeks['grid_lat'].astype(str) + '_' + df_grid_weeks['grid_lon'].astype(str)

    all_weeks = pd.date_range(df_grid_weeks['week'].min(), df_grid_weeks['week'].max(), freq='W-MON')
    all_cells = df_grid_weeks['grid_cell'].unique()

    dfs = []

    for cell in all_cells:
        cell_df = df_grid_weeks[df_grid_weeks['grid_cell'] == cell]

        weeks_df = pd.DataFrame({
            'week': all_weeks,
            'grid_cell': cell
        })

        merged = weeks_df.merge(cell_df, on=['week', 'grid_cell'], how='left')
        merged['grid_lat'] = cell_df['grid_lat'].iloc[0]
        merged['grid_lon'] = cell_df['grid_lon'].iloc[0]

        dfs.append(merged)

    df_all = pd.concat(dfs, ignore_index=True)

    df_all['earthquakes_count'] = df_all['earthquakes_count'].fillna(0)
    df_all['energy_sum'] = df_all['energy_sum'].fillna(0)

    cols = ['max_mag', 'mean_mag', 'mean_depth', 'max_depth']
    df_all[cols] = df_all[cols].fillna(df_all[cols].median())

    df_all['earthquakes_count'] = df_all['earthquakes_count'].astype(int)

    df_all = df_all.sort_values(['grid_cell', 'week'])

    base_cols = ['earthquakes_count','max_mag', 'mean_mag', 'mean_depth', 'max_depth', 'energy_sum']
    df_all[base_cols] = df_all.groupby('grid_cell')[base_cols].shift(1)

    windows = [4, 8, 12, 24, 36, 48, 60]
    features = ['earthquakes_count','max_mag', 'mean_mag', 'mean_depth', 'max_depth', 'energy_sum']
    
    for window in windows:
        df_all[f'mag_mean_{window}w'] = df_all.groupby('grid_cell')['mean_mag'].rolling(window, min_periods=1).mean().reset_index(level=0, drop=True)
        df_all[f'count_sum_{window}w'] = df_all.groupby('grid_cell')['earthquakes_count'].rolling(window, min_periods=1).sum().reset_index(level=0, drop=True)
        df_all[f'energy_sum_{window}w'] = df_all.groupby('grid_cell')['energy_sum'].rolling(window, min_periods=1).sum().reset_index(level=0, drop=True)
        df_all[f'energy_max_{window}w'] = df_all.groupby('grid_cell')['energy_sum'].rolling(window, min_periods=1).max().reset_index(level=0, drop=True)

        features += [f'mag_mean_{window}w', f'count_sum_{window}w', f'energy_sum_{window}w', f'energy_max_{window}w']

    df_all = df_all.fillna(0)

    last_week = df_all[df_all['week'] == df_all['week'].max()]
    X = last_week[features]

    model = xgb.XGBClassifier()
    model.load_model('models/model.json')

    pred = model.predict_proba(X)[:, 1]
    final = last_week.copy()
    final['pred'] = pred
    final = final[['grid_lat', 'grid_lon', 'pred']]
    final.to_json('static/data/pred.json', orient='records')

    conn.close()
