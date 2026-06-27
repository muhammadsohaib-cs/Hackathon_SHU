import pandas as pd
import numpy as np
from sklearn.model_selection import train_test_split
from sklearn.preprocessing import OneHotEncoder, StandardScaler
from sklearn.ensemble import RandomForestRegressor
from sklearn.svm import SVR
from sklearn.tree import DecisionTreeRegressor
from sklearn.metrics import mean_squared_error, r2_score

df = pd.read_csv('yield_df.csv').drop(columns=['Unnamed: 0'], errors='ignore')

# Remove any appended rows that don't have the real target data or filter them somehow?
# Actually, let's just train on the current data to see the inherent model performance.
X = df.drop(columns=['hg/ha_yield', 'category'], errors='ignore')
y = df['hg/ha_yield']

X['avg_temp'] = pd.to_numeric(X['avg_temp'], errors='coerce')
X = X.dropna(subset=['avg_temp'])
y = y[X.index]

ohe = OneHotEncoder(sparse_output=False, handle_unknown='ignore')
encoded_cols = pd.DataFrame(ohe.fit_transform(X[['Area', 'Item']]), columns=ohe.get_feature_names_out(), index=X.index)
X = pd.concat([X.drop(columns=['Area', 'Item']), encoded_cols], axis=1)

X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.2, random_state=42)

scaler = StandardScaler()
X_train_scaled = scaler.fit_transform(X_train)
X_test_scaled = scaler.transform(X_test)

print("Training & Evaluating Random Forest...")
rf = RandomForestRegressor(n_estimators=100, random_state=42)
rf.fit(X_train_scaled, y_train)
rf_preds = rf.predict(X_test_scaled)
print(f"Random Forest - R2: {r2_score(y_test, rf_preds):.4f}")

print("Training & Evaluating SVM (3000 subset)...")
svm = SVR(kernel='rbf')
if len(X_train_scaled) > 3000:
    indices = np.random.choice(len(X_train_scaled), 3000, replace=False)
    svm.fit(X_train_scaled[indices], y_train.iloc[indices])
else:
    svm.fit(X_train_scaled, y_train)
svm_preds = svm.predict(X_test_scaled)
print(f"SVM - R2: {r2_score(y_test, svm_preds):.4f}")

print("Training & Evaluating Decision Tree...")
dt = DecisionTreeRegressor(random_state=42)
dt.fit(X_train_scaled, y_train)
dt_preds = dt.predict(X_test_scaled)
print(f"Decision Tree - R2: {r2_score(y_test, dt_preds):.4f}")
