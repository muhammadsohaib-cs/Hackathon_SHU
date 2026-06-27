import pandas as pd
import numpy as np
from sklearn.model_selection import train_test_split
from sklearn.preprocessing import OneHotEncoder, StandardScaler
import joblib
from sklearn.metrics import mean_squared_error, r2_score
import os

df = pd.read_csv('yield_df.csv').drop(columns=['Unnamed: 0'], errors='ignore')

X = df.drop(columns=['hg/ha_yield', 'category'], errors='ignore')
y = df['hg/ha_yield']

X['avg_temp'] = pd.to_numeric(X['avg_temp'], errors='coerce')
X = X.dropna(subset=['avg_temp'])
y = y[X.index]

ohe = OneHotEncoder(sparse_output=False, handle_unknown='ignore')
encoded_cols = pd.DataFrame(ohe.fit_transform(X[['Area', 'Item']]), columns=ohe.get_feature_names_out(), index=X.index)
X = pd.concat([X.drop(columns=['Area', 'Item']), encoded_cols], axis=1)

X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.2, random_state=42)

MODEL_DIR = 'models_cache'
rf_path = os.path.join(MODEL_DIR, 'rf_model.joblib')
svm_path = os.path.join(MODEL_DIR, 'svm_model.joblib')
gb_path = os.path.join(MODEL_DIR, 'gb_model.joblib')
scaler_path = os.path.join(MODEL_DIR, 'scaler.joblib')

if os.path.exists(scaler_path):
    scaler = joblib.load(scaler_path)
    X_test_scaled = scaler.transform(X_test)

    print("Evaluating Models on Test Data...")
    
    if os.path.exists(rf_path):
        rf = joblib.load(rf_path)
        rf_preds = rf.predict(X_test_scaled)
        print(f"Random Forest - R2: {r2_score(y_test, rf_preds):.4f}, RMSE: {np.sqrt(mean_squared_error(y_test, rf_preds)):.2f}")
        
    if os.path.exists(svm_path):
        svm = joblib.load(svm_path)
        svm_preds = svm.predict(X_test_scaled)
        print(f"SVM - R2: {r2_score(y_test, svm_preds):.4f}, RMSE: {np.sqrt(mean_squared_error(y_test, svm_preds)):.2f}")
        
    if os.path.exists(gb_path):
        gb = joblib.load(gb_path)
        try:
            gb_preds = gb.predict(X_test_scaled)
            print(f"Gradient Boosting - R2: {r2_score(y_test, gb_preds):.4f}, RMSE: {np.sqrt(mean_squared_error(y_test, gb_preds)):.2f}")
        except Exception as e:
            print(f"Gradient Boosting - Error during prediction: {e}")
else:
    print("Scaler not found. Please run predict.py first to train the models.")
