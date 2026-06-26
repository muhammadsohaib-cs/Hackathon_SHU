import pandas as pd
import numpy as np
from sklearn.model_selection import train_test_split
from sklearn.preprocessing import LabelEncoder, StandardScaler
from sklearn.ensemble import RandomForestRegressor, GradientBoostingRegressor
from sklearn.svm import SVR
# Load and preprocess your dataset
df = pd.read_csv('yield_df.csv').drop(columns=['Unnamed: 0'], errors='ignore')

# Ensure no categorical values remain in the data for scaling
X = df.drop(columns=['hg/ha_yield', 'category'], errors='ignore')
y = df['hg/ha_yield']  # Target (Yield)

# Encode categorical variables (Area and Item)
label_encoder_area = LabelEncoder()
label_encoder_item = LabelEncoder()

X['Area'] = label_encoder_area.fit_transform(X['Area'])
X['Item'] = label_encoder_item.fit_transform(X['Item'])

# Ensure avg_temp is numeric
X['avg_temp'] = pd.to_numeric(X['avg_temp'], errors='coerce')
X = X.dropna(subset=['avg_temp'])  # Drop rows with missing 'avg_temp'

# Split data into train and test sets
X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.2, random_state=42)

# Standardize the numerical columns
scaler = StandardScaler()
X_train_scaled = scaler.fit_transform(X_train)
X_test_scaled = scaler.transform(X_test)

import os
import joblib

MODEL_DIR = 'models_cache'
if not os.path.exists(MODEL_DIR):
    os.makedirs(MODEL_DIR)

# Paths for cached models and scaler
rf_path = os.path.join(MODEL_DIR, 'rf_model.joblib')
svm_path = os.path.join(MODEL_DIR, 'svm_model.joblib')
gb_path = os.path.join(MODEL_DIR, 'gb_model.joblib')
scaler_path = os.path.join(MODEL_DIR, 'scaler.joblib')

# Check if models exist
if os.path.exists(rf_path) and os.path.exists(svm_path) and os.path.exists(gb_path) and os.path.exists(scaler_path):
    print("Loading cached models...")
    rf_model = joblib.load(rf_path)
    svm_model = joblib.load(svm_path)
    gb_model = joblib.load(gb_path)
    scaler = joblib.load(scaler_path)
else:
    # Train the models
    print("Initializing models...")
    rf_model = RandomForestRegressor(n_estimators=100, random_state=42)
    svm_model = SVR(kernel='rbf')
    gb_model = GradientBoostingRegressor(n_estimators=100, random_state=42)

    print("Training Random Forest...")
    rf_model.fit(X_train_scaled, y_train)
    print("Training SVM (on sampled data to save time)...")
    if len(X_train_scaled) > 3000:
        indices = np.random.choice(len(X_train_scaled), 3000, replace=False)
        svm_model.fit(X_train_scaled[indices], y_train.iloc[indices])
    else:
        svm_model.fit(X_train_scaled, y_train)
    print("Training Gradient Boosting...")
    gb_model.fit(X_train_scaled, y_train)
    print("Models trained successfully.")
    
    # Cache them for next time
    joblib.dump(rf_model, rf_path)
    joblib.dump(svm_model, svm_path)
    joblib.dump(gb_model, gb_path)
    joblib.dump(scaler, scaler_path)


# Function to categorize predicted yield into 'Low', 'Medium', 'High'
def categorize_yield(yield_value, bins):
    if yield_value < bins[1]:
        return 'Low'
    elif yield_value < bins[2]:
        return 'Medium'
    else:
        return 'High'

# Helper function to handle unseen labels in new data
def handle_unseen_labels(data, encoder, column_name):
    for val in data[column_name]:
        if val not in encoder.classes_:
            encoder.classes_ = np.append(encoder.classes_, val)
    return encoder.transform(data[column_name])

# Decode function to convert encoded labels back to original strings
def decode_labels(encoded_value, encoder):
    return encoder.inverse_transform([encoded_value])[0]

# Prediction function
def predict_yield(area, item, year, avg_rainfall, pesticides, avg_temp):
    # Prepare the new data
    new_data = pd.DataFrame({
        'Area': [area],
        'Item': [item],
        'Year': [year],
        'average_rain_fall_mm_per_year': [avg_rainfall],
        'pesticides_tonnes': [pesticides],
        'avg_temp': [avg_temp]
    })

    # Handle unseen labels in 'Area' and 'Item'
    new_data['Area'] = handle_unseen_labels(new_data, label_encoder_area, 'Area')
    new_data['Item'] = handle_unseen_labels(new_data, label_encoder_item, 'Item')

    # Standardize the new data
    new_data_scaled = scaler.transform(new_data)

    # Make predictions with the models
    rf_prediction = rf_model.predict(new_data_scaled)[0].item()
    svm_prediction = svm_model.predict(new_data_scaled)[0].item()
    gb_prediction = gb_model.predict(new_data_scaled)[0].item()

    # Define bins for categorizing the yield predictions
    min_value = y.min()
    max_value = y.max()
    bins = [min_value, (min_value + max_value) / 3, 2 * (min_value + max_value) / 3, max_value]

    # Categorize the predictions
    rf_category = categorize_yield(rf_prediction, bins)
    svm_category = categorize_yield(svm_prediction, bins)
    gb_category = categorize_yield(gb_prediction, bins)

    # Decode the labels back to original strings
    decoded_area = decode_labels(new_data['Area'][0], label_encoder_area)
    decoded_item = decode_labels(new_data['Item'][0], label_encoder_item)

    # Load the existing CSV to get the last index
    try:
        df = pd.read_csv('yield_df.csv')
        last_index = df.index[-1]  # Get the last index number
    except (FileNotFoundError, IndexError):
        last_index = -1  # Start from -1 if the file does not exist or is empty

    # Prepare the new row to save
    new_row = {
        '': [last_index + 1],
        'Area': [decoded_area],
        'Item': [decoded_item],
        'Year': [year],
        'hg/ha_yield': [int(rf_prediction)],
        'average_rain_fall_mm_per_year': [avg_rainfall],
        'pesticides_tonnes': [pesticides],
        'avg_temp': [avg_temp],
        'category': [rf_category]
    }

    # DO NOT append the new row to the original CSV to prevent data corruption
    # new_data_df = pd.DataFrame(new_row)
    # new_data_df.to_csv('yield_df.csv', mode='a', header=False, index=False)

    # Calculate Risk/Opportunity Matrix & Historical Data
    historical_stats = {'total_crops': 0, 'yearly_data': []}
    try:
        df_full = pd.read_csv('yield_df.csv')
        item_data = df_full[df_full['Item'] == decoded_item]
        avg_yield = item_data['hg/ha_yield'].mean()
        if pd.isna(avg_yield) or avg_yield == 0:
            avg_yield = rf_prediction
            
        # Compile Historical Data for Charts
        area_data = df_full[df_full['Area'] == decoded_area]
        historical_stats['total_crops'] = int(area_data['Item'].nunique())
        
        item_area_data = area_data[area_data['Item'] == decoded_item]
        if not item_area_data.empty:
            yearly_stats = item_area_data.groupby('Year').agg({
                'hg/ha_yield': 'mean',
                'pesticides_tonnes': 'mean',
                'average_rain_fall_mm_per_year': 'mean',
                'avg_temp': 'mean'
            }).reset_index()
            # Sort by year
            yearly_stats = yearly_stats.sort_values('Year')
            
            historical_stats['yearly_data'] = [{
                'year': int(row['Year']),
                'yield': float(row['hg/ha_yield']),
                'pesticides': float(row['pesticides_tonnes']),
                'rainfall': float(row['average_rain_fall_mm_per_year']),
                'temp': float(row['avg_temp'])
            } for _, row in yearly_stats.iterrows()]
            
    except Exception as e:
        avg_yield = rf_prediction

    yield_diff = rf_prediction - avg_yield
    diff_percent = (yield_diff / avg_yield) * 100 if avg_yield > 0 else 0
    
    # 1 hg/ha = 0.0001 tonnes/ha. Hypothetical avg market price $300/tonne
    tonnes_diff = yield_diff * 0.0001
    economic_impact = tonnes_diff * 300

    if yield_diff >= 0:
        matrix_status = "Opportunity"
        matrix_action = "Export Surplus"
        matrix_msg = f"Projected {diff_percent:.1f}% surplus vs historical average. Positive economic impact of +${abs(economic_impact):.2f}/ha."
    else:
        matrix_status = "Risk"
        matrix_action = "Supply Deficit"
        matrix_msg = f"Projected {abs(diff_percent):.1f}% deficit vs historical average. Expected economic loss of -${abs(economic_impact):.2f}/ha."

    risk_matrix = {
        'status': matrix_status,
        'action': matrix_action,
        'message': matrix_msg,
        'baseline': int(avg_yield),
        'impact_usd': economic_impact
    }

    # Dynamic analysis based on outputs
    rf_analysis = f"Highly Reliable Forecast: We expect a harvest of around {int(rf_prediction / 10):,} kilograms per hectare (kg/ha). This is {'better' if rf_prediction >= avg_yield else 'worse'} than your usual historical average."
    gb_analysis = f"Strong Second Opinion: This model expects a slightly {'larger' if gb_prediction > rf_prediction else 'smaller'} yield of {int(gb_prediction / 10):,} kg/ha under these same weather conditions."
    svm_analysis = f"Experimental Estimate: Take this {int(svm_prediction / 10):,} kg/ha number with a grain of salt, as this model can sometimes overreact to extreme weather."

    # Return predictions and categories for all models
    return {
        'models': {
            'Random Forest': {'yield': int(rf_prediction), 'category': rf_category, 'analysis': rf_analysis},
            'Gradient Boosting': {'yield': int(gb_prediction), 'category': gb_category, 'analysis': gb_analysis},
            'SVM': {'yield': int(svm_prediction), 'category': svm_category, 'analysis': svm_analysis}
        },
        'risk_matrix': risk_matrix,
        'historical_stats': historical_stats
    }

