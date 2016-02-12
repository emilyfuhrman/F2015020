# In The Same Boats:
# Converter using Pandas

# Load the necessary libraries

import pandas as pd
from datetime import date, timedelta as td, datetime
import numpy as np
import json

# I. PRELIMINARY DATA PREPARATION FROM CSV

# 1. Open CSV file as a Data Frame

df = pd.read_csv('itinerary.csv')

# 2. Concatanate the City and Country for departure and arrival
df["ArCiCo"] = df["ArCity"] + "_" + df["ArCountry"]
df["DptCiCo"] = df["DptCity"] + "_" + df["DptCountry"]
df["Date"] = df["DateAr"] + " : " + df["DateDpt"]

# 3. Convert dates from txt to datetime data type
df.DateDpt = pd.to_datetime(df.DateDpt)
df.DateAr = pd.to_datetime(df.DateAr)

# II. GENERATE TRAJECTORIES JSON (trajectories.json):
# The trajectories are the trips from one place to another on a given date. They will be represented as lines on the D3 map

# 1. Create Dafa Frame for trajectories (df1) with only four columns and automatically generated index

df1 = pd.DataFrame(df, columns = ['AuthorID', 'ArCiCo', 'DptCiCo', 'Date'])

# 2. Create empty dictionary
json_dict = {}

# 3. Populate dictionary
for date_range, flights in df1.groupby('Date'):
    # Purge out repeated dates in the list
    dup_date = flights.drop('Date', axis=1)
    # Map values into the dictionary
    json_dict[date_range] = map(list, dup_date.values)

# 4. Convert into json and save
with open('trajectories.json', 'w') as f:
     json.dump(json_dict, f, indent=4, sort_keys=True)

# GENERATE INTERSECIONS JSON
# Intersections are points in time and space shared by two or more persons

# 1. Use Date of Arrival (DateAr) as the index
df = df.set_index('DateAr')

# 2. Create empty Data Frame for intersections
df2 = pd.DataFrame()

# 3. Expand the dates

#iterate through every row
for i, data in df.iterrows():
    # grab each line (series) and transpose it from row to column
    data = data.to_frame().transpose()
    
    data = data.reindex(pd.date_range(start=data.index[0], end=data.DateDpt[0])).fillna(method='ffill').reset_index().rename(columns={'index': 'DateAr'})
    df2 = pd.concat([df2, data])
    df2 = df2[['AuthorID', 'ArCiCo', 'DptCiCo', 'DateAr', 'DateDpt']]

df2 = df2.drop_duplicates(['AuthorID', 'DateAr'], keep='last')
#print df2

json_dict = {}

for arrival_date, data in df2.groupby('DateAr'):
    #matching_dates = data[data.DateDpt==arrival_date]
    #not_matching_dates = data[data.DateDpt!=arrival_date]
    #print data
    json_dict[arrival_date.strftime('%Y-%m-%d')] = {}
    #if not matching_dates.empty:
       # for city, flights in matching_dates.groupby('ArCiCo'):
         #   json_dict[arrival_date.strftime('%Y-%m-%d')][city] = [str(v) for v in flights.AuthorID]
    #if not not_matching_dates.empty:
    for city, flights in data.groupby('DptCiCo'):
        #print flights
        json_dict[arrival_date.strftime('%Y-%m-%d')][city] = [str(v) for v in flights.AuthorID]
            

with open('json_dict.json', 'w') as f:
     json.dump(json_dict, f, indent=4, sort_keys=True)


