# Personal Expense Tracker 💰

A web-based expense tracking application built with Python Flask.

🔗 **Live Demo**: https://merazulislam.pythonanywhere.com

## Features

- 👤 **User Authentication** - Secure login and registration
- 💰 **Income Tracking** - Track both expenses and income
- 💱 **Multi-Currency Support** - Real-time exchange rates for 11+ currencies
- 🎤 **Voice Input** - Add expenses hands-free using voice commands
- 📝 **Edit Transactions** - Modify expenses and income entries
- 📊 **Visual Charts** - Spending by category and monthly trends
- 📅 **Monthly Summaries** - Track savings percentage and spending patterns
- 🌓 **Dark Mode** - Easy on the eyes
- 🗑️ **Delete Transactions** - Remove unwanted entries
- 💡 **Clean & Intuitive Interface** - Modern responsive design

## Technologies Used

- **Backend:** Python 3, Flask
- **Frontend:** HTML5, CSS3, JavaScript
- **Charts:** Chart.js
- **Authentication:** Werkzeug Security
- **API:** ExchangeRate-API for currency conversion
- **Hosting:** PythonAnywhere

## Supported Currencies

USD, EUR, GBP, JPY, CNY, INR, KRW, BDT, AUD, CAD, CHF

## Categories

- Food & Dining
- Transportation
- Shopping
- Entertainment
- Bills & Utilities
- Healthcare
- Education
- Income
- Other

## Installation & Setup

1. Clone the repository:
```bash
git clone https://github.com/iam-meraz/expense-tracker-python.git
cd expense-tracker-python
```

2. Create a virtual environment (recommended):
```bash
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate
```

3. Install dependencies:
```bash
pip install -r requirements.txt
```

4. Set secret key (optional, for production):
```bash
export SECRET_KEY='your-secret-key-here'  # On Windows: set SECRET_KEY=your-secret-key-here
```

5. Run the app:
```bash
python app.py
```

6. Open your browser and go to: `http://127.0.0.1:5000`

## Project Structure
```
expense-tracker-python/
├── app.py                 # Main Flask application
├── requirements.txt       # Python dependencies
├── .gitignore            # Git ignore file
├── README.md             # Project documentation
├── templates/
│   ├── index.html        # Main dashboard
│   └── login.html        # Authentication page
├── static/
│   ├── app.js           # Frontend JavaScript
│   └── style.css        # Styling
└── *.json               # Data files (auto-generated)
```

## Features in Detail

### Voice Input
Use the 🎤 Voice Add button to add expenses hands-free:
- "I spent 50 dollars on food"
- "I received 1000 rupees as salary"
- Automatically detects amount, currency, category, and type

### Multi-Currency
- Supports 11+ major currencies
- Real-time exchange rates
- Shows converted amounts
- Displays both original and converted currency

### Dark Mode
Toggle between light and dark themes with persistent preference storage.

## Deployment

Deployed on PythonAnywhere using Flask WSGI.

For deployment instructions, see: [PythonAnywhere Flask Tutorial](https://help.pythonanywhere.com/pages/Flask/)

## Future Enhancements

- [ ] Export data to CSV/Excel
- [ ] Budget planning with alerts
- [ ] Recurring expense tracking
- [ ] Mobile app version
- [ ] Receipt upload and OCR
- [ ] Financial insights and predictions

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## License

MIT License - feel free to use this project!

## Authors

**Cloud Crafters Team**
- Meraz Merazul Islam
- Mozumder Saif Al Mahmud
- Kabi Malla
- Upasna Khulal
- Aswin Phuyal

---

⭐ If you like this project, please give it a star!