from flask import Flask, request, jsonify
from flask_cors import CORS
from predict import predict_yield

app = Flask(__name__)
CORS(app)

@app.route('/execute', methods=['POST'])
def execute():
    try:
        data = request.json
        prediction = predict_yield(
            area=data['Area'],
            item=data['Item'],
            year=data['Year'],
            avg_rainfall=data['average_rain_fall_mm_per_year'],
            pesticides=data['pesticides_tonnes'],
            avg_temp=data['avg_temp']
        )
        return jsonify({'prediction': prediction})
    except Exception as e:
        print(f"Error occurred: {e}")
        return jsonify({"error": str(e)}), 500

if __name__ == '__main__':
    app.run(port=8867)
