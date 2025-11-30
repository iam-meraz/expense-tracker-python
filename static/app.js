let expenses = [];
let categoryChart = null;
let trendChart = null;
let isEditMode = false;
let isEditIncomeMode = false;
let recognition = null;
let voiceData = null;
let exchangeRates = {
    base: 'USD',
    rates: {
        USD: 1,
        EUR: 0.863,
        GBP: 0.756,
        JPY: 156.18,
        CNY: 7.08,
        INR: 89.44,
        KRW: 1467.67,
        BDT: 122.22,
        NPR: 143.10,
        AUD: 1.53,
        CAD: 1.4,
        CHF: 0.804
    }
};

const currencySymbols = {
    'USD': '$', 'EUR': '€', 'GBP': '£', 'JPY': '¥', 'CNY': '¥',
    'INR': '₹', 'KRW': '₩', 'BDT': '৳', 'NPR': 'Rs', 'AUD': 'A$', 'CAD': 'C$', 'CHF': 'Fr'
};

document.addEventListener('DOMContentLoaded', async function() {
    const today = new Date();
    const dateInput = document.getElementById('date');
    const incomeDateInput = document.getElementById('incomeDate');
    if (dateInput) dateInput.valueAsDate = today;
    if (incomeDateInput) incomeDateInput.valueAsDate = today;

    generateMonthOptions();
    loadUserInfo();
    loadDarkModePreference();
    loadCurrencyPreference();
    initVoiceRecognition();

    // CRITICAL: Load exchange rates BEFORE expenses
    await loadExchangeRates();
    await loadExpenses();
});

async function loadUserInfo() {
    try {
        const response = await fetch('/api/user');
        if (response.ok) {
            const user = await response.json();
            document.getElementById('userName').textContent = user.name;
            document.getElementById('userEmail').textContent = user.email;
        } else {
            window.location.href = '/login';
        }
    } catch (error) {
        console.error('Failed to load user info:', error);
        window.location.href = '/login';
    }
}

function showUserMenu() {
    const menu = document.getElementById('userMenu');
    menu.style.display = menu.style.display === 'none' ? 'block' : 'none';
}

async function handleLogout() {
    try {
        await fetch('/api/logout', { method: 'POST' });
        window.location.href = '/login';
    } catch (error) {
        console.error('Logout failed:', error);
    }
}

document.addEventListener('click', function(event) {
    const menu = document.getElementById('userMenu');
    const btn = document.getElementById('userMenuBtn');
    if (menu && btn && !menu.contains(event.target) && !btn.contains(event.target)) {
        menu.style.display = 'none';
    }
});

async function loadExchangeRates() {
    try {
        const response = await fetch('/api/exchange-rates');
        const data = await response.json();

        // Only update if we got valid data with rates
        if (data && data.rates && Object.keys(data.rates).length > 1) {
            exchangeRates = data;
            console.log('Exchange rates loaded:', Object.keys(exchangeRates.rates).length, 'currencies');
        } else {
            console.warn('Invalid rates data, keeping defaults');
        }

        const date = new Date(exchangeRates.last_update);
        document.getElementById('ratesUpdate').textContent = date.toLocaleDateString();

        // Refresh display if expenses are already loaded
        if (expenses.length > 0) {
            updateDisplay();
        }
    } catch (error) {
        console.error('Failed to load exchange rates:', error);
        document.getElementById('ratesUpdate').textContent = 'Using default rates';
    }
}

function convertCurrency(amount, fromCurrency, toCurrency) {
    if (fromCurrency === toCurrency) return amount;
    if (!exchangeRates.rates[fromCurrency] || !exchangeRates.rates[toCurrency]) return amount;
    const amountInBase = amount / exchangeRates.rates[fromCurrency];
    return amountInBase * exchangeRates.rates[toCurrency];
}

function formatCurrency(amount, currency) {
    const symbol = currencySymbols[currency] || currency;
    const decimals = (currency === 'JPY' || currency === 'KRW') ? 0 : 2;
    return `${symbol}${amount.toFixed(decimals)}`;
}

function generateMonthOptions() {
    const selector = document.getElementById('monthSelector');
    const today = new Date();
    const months = [];
    for (let i = -12; i <= 12; i++) {
        const date = new Date(today.getFullYear(), today.getMonth() + i, 1);
        const yearMonth = date.toISOString().slice(0, 7);
        const monthName = date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
        months.push({ value: yearMonth, label: monthName });
    }
    selector.innerHTML = months.map(m =>
        `<option value="${m.value}" ${m.value === today.toISOString().slice(0, 7) ? 'selected' : ''}>${m.label}</option>`
    ).join('');
    selector.addEventListener('change', updateDisplay);
}

function toggleDarkMode() {
    document.body.classList.toggle('dark-mode');
    const isDark = document.body.classList.contains('dark-mode');
    document.getElementById('darkModeIcon').textContent = isDark ? '☀️' : '🌙';
    localStorage.setItem('darkMode', isDark ? 'enabled' : 'disabled');
    updateDisplay();
}

function loadDarkModePreference() {
    if (localStorage.getItem('darkMode') === 'enabled') {
        document.body.classList.add('dark-mode');
        document.getElementById('darkModeIcon').textContent = '☀️';
    }
}

function loadCurrencyPreference() {
    const saved = localStorage.getItem('displayCurrency');
    if (saved) document.getElementById('displayCurrency').value = saved;
}

function saveCurrencyPreference() {
    localStorage.setItem('displayCurrency', document.getElementById('displayCurrency').value);
}

function toggleAddForm() {
    const form = document.getElementById('expenseForm');
    const incomeForm = document.getElementById('incomeForm');
    const isVisible = form.style.display !== 'none';

    if (incomeForm) incomeForm.style.display = 'none';
    document.getElementById('addIncomeBtn').textContent = '💰 Add Income';

    form.style.display = isVisible ? 'none' : 'flex';
    document.getElementById('addBtn').textContent = isVisible ? '+ Add Expense' : '✕ Close';

    if (!isVisible) {
        isEditMode = false;
        document.getElementById('editExpenseId').value = '';
        document.getElementById('amount').value = '';
        document.getElementById('expenseCurrency').value = document.getElementById('displayCurrency').value;
        document.getElementById('category').value = 'Food & Dining';
        document.getElementById('description').value = '';
        document.getElementById('date').valueAsDate = new Date();
        document.getElementById('saveBtn').textContent = 'Save';
        document.getElementById('expenseRateHint').textContent = '';
    }
}

function toggleIncomeForm() {
    const form = document.getElementById('incomeForm');
    const expenseForm = document.getElementById('expenseForm');
    const isVisible = form.style.display !== 'none';

    if (expenseForm) expenseForm.style.display = 'none';
    document.getElementById('addBtn').textContent = '+ Add Expense';

    form.style.display = isVisible ? 'none' : 'flex';
    document.getElementById('addIncomeBtn').textContent = isVisible ? '💰 Add Income' : '✕ Close';

    if (!isVisible) {
        isEditIncomeMode = false;
        document.getElementById('editIncomeId').value = '';
        document.getElementById('incomeAmount').value = '';
        document.getElementById('incomeCurrency').value = document.getElementById('displayCurrency').value;
        document.getElementById('incomeDescription').value = '';
        document.getElementById('incomeDate').valueAsDate = new Date();
        document.getElementById('incomeRateHint').textContent = '';
        document.getElementById('saveIncomeBtn').textContent = 'Save Income';
    }
}

function updateExpenseRate() {
    const amount = parseFloat(document.getElementById('amount').value);
    const fromCurrency = document.getElementById('expenseCurrency').value;
    const toCurrency = document.getElementById('displayCurrency').value;
    const hint = document.getElementById('expenseRateHint');

    if (!amount || amount <= 0 || fromCurrency === toCurrency) {
        hint.textContent = '';
        return;
    }

    const converted = convertCurrency(amount, fromCurrency, toCurrency);
    hint.textContent = `≈ ${formatCurrency(converted, toCurrency)}`;
}

function updateIncomeRate() {
    const amount = parseFloat(document.getElementById('incomeAmount').value);
    const fromCurrency = document.getElementById('incomeCurrency').value;
    const toCurrency = document.getElementById('displayCurrency').value;
    const hint = document.getElementById('incomeRateHint');

    if (!amount || amount <= 0 || fromCurrency === toCurrency) {
        hint.textContent = '';
        return;
    }

    const converted = convertCurrency(amount, fromCurrency, toCurrency);
    hint.textContent = `≈ ${formatCurrency(converted, toCurrency)}`;
}

function initVoiceRecognition() {
    if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
        recognition = new SpeechRecognition();
        recognition.continuous = false;
        recognition.interimResults = false;
        recognition.lang = 'en-US';
        recognition.onresult = function(event) {
            const transcript = event.results[0][0].transcript;
            console.log('Voice transcript:', transcript);
            parseVoiceCommand(transcript);
        };
        recognition.onerror = function(event) {
            console.error('Voice error:', event.error);
            const statusDiv = document.getElementById('voiceStatus');
            if (statusDiv) statusDiv.style.display = 'none';
        };
        recognition.onend = function() {
            const statusDiv = document.getElementById('voiceStatus');
            if (statusDiv) statusDiv.style.display = 'none';
        };
        console.log('Voice recognition initialized');
    } else {
        console.warn('Voice recognition not supported');
        const voiceBtn = document.getElementById('voiceBtn');
        if (voiceBtn) {
            voiceBtn.disabled = true;
            voiceBtn.title = 'Voice not supported in your browser';
        }
    }
}

function startVoiceRecognition() {
    if (!recognition) {
        alert('Voice recognition not available. Use Chrome, Edge, or Safari.');
        return;
    }

    const statusDiv = document.getElementById('voiceStatus');
    const resultDiv = document.getElementById('voiceResult');
    const expenseForm = document.getElementById('expenseForm');
    const incomeForm = document.getElementById('incomeForm');

    if (statusDiv) statusDiv.style.display = 'flex';
    if (resultDiv) resultDiv.style.display = 'none';
    if (expenseForm) expenseForm.style.display = 'none';
    if (incomeForm) incomeForm.style.display = 'none';

    document.getElementById('addBtn').textContent = '+ Add Expense';
    document.getElementById('addIncomeBtn').textContent = '💰 Add Income';

    try {
        recognition.start();
    } catch (e) {
        console.error('Failed to start:', e);
        if (statusDiv) statusDiv.style.display = 'none';
    }
}

function stopVoiceRecognition() {
    if (recognition) recognition.stop();
    const statusDiv = document.getElementById('voiceStatus');
    if (statusDiv) statusDiv.style.display = 'none';
}

function parseVoiceCommand(transcript) {
    const text = transcript.toLowerCase();
    console.log('Raw transcript:', transcript);

    // Check if income or expense
    const incomeKeywords = ['received', 'got', 'earned', 'income', 'salary', 'payment', 'paid me', 'gave me', 'gift'];
    const isIncome = incomeKeywords.some(keyword => text.includes(keyword));

    // Extract amount with improved number parsing
    let amount = 0;

    // Convert text numbers to digits
    const textToNumber = {
        'zero': 0, 'one': 1, 'two': 2, 'three': 3, 'four': 4,
        'five': 5, 'six': 6, 'seven': 7, 'eight': 8, 'nine': 9,
        'ten': 10, 'eleven': 11, 'twelve': 12, 'thirteen': 13, 'fourteen': 14,
        'fifteen': 15, 'sixteen': 16, 'seventeen': 17, 'eighteen': 18, 'nineteen': 19,
        'twenty': 20, 'thirty': 30, 'forty': 40, 'fifty': 50,
        'sixty': 60, 'seventy': 70, 'eighty': 80, 'ninety': 90,
        'hundred': 100, 'thousand': 1000, 'million': 1000000
    };

    // Method 1: Look for number with multipliers (e.g., "200 thousand", "5 hundred")
    const multiplierPattern = /(\d+(?:\.\d+)?)\s*(hundred|thousand|million|lakh|crore)/i;
    const multiplierMatch = text.match(multiplierPattern);

    if (multiplierMatch) {
        const baseNumber = parseFloat(multiplierMatch[1]);
        const multiplier = multiplierMatch[2].toLowerCase();

        const multipliers = {
            'hundred': 100,
            'thousand': 1000,
            'million': 1000000,
            'lakh': 100000,
            'crore': 10000000
        };

        amount = baseNumber * (multipliers[multiplier] || 1);
        console.log('Found multiplier:', baseNumber, 'x', multiplier, '=', amount);
    }
    // Method 2: Look for text numbers (e.g., "twenty five", "one hundred")
    else {
        let tempAmount = 0;
        let currentNumber = 0;

        const words = text.split(/\s+/);
        for (let i = 0; i < words.length; i++) {
            const word = words[i];
            if (textToNumber.hasOwnProperty(word)) {
                const value = textToNumber[word];

                if (value >= 100) {
                    // Multiplier (hundred, thousand, etc.)
                    currentNumber = currentNumber === 0 ? value : currentNumber * value;
                } else if (value >= 10 && value < 20) {
                    // Teen numbers
                    currentNumber += value;
                } else if (value >= 20) {
                    // Tens (twenty, thirty, etc.)
                    currentNumber += value;
                } else {
                    // Single digits
                    currentNumber += value;
                }

                // Check if next word is also a number or if we're at the end
                const nextWord = words[i + 1];
                if (!nextWord || !textToNumber.hasOwnProperty(nextWord)) {
                    tempAmount += currentNumber;
                    currentNumber = 0;
                }
            }
        }

        if (tempAmount > 0) {
            amount = tempAmount;
            console.log('Parsed text number:', amount);
        }
    }

    // Method 3: Simple numeric extraction (fallback)
    if (amount === 0) {
        const numericMatch = text.match(/(\d+(?:,\d{3})*(?:\.\d{1,2})?)/);
        if (numericMatch) {
            amount = parseFloat(numericMatch[1].replace(/,/g, ''));
            console.log('Found numeric:', amount);
        }
    }

    // Detect currency - check specific words first
    let currency = null;
    const currencyKeywords = {
        'dollars': 'USD', 'dollar': 'USD', '$': 'USD', 'usd': 'USD',
        'euros': 'EUR', 'euro': 'EUR', '€': 'EUR', 'eur': 'EUR',
        'pounds': 'GBP', 'pound': 'GBP', '£': 'GBP', 'gbp': 'GBP',
        'yen': 'JPY', '¥': 'JPY', 'jpy': 'JPY',
        'yuan': 'CNY', 'cny': 'CNY',
        'rupees': 'INR', 'rupee': 'INR', 'inr': 'INR',
        'won': 'KRW', '₩': 'KRW', 'krw': 'KRW',
        'taka': 'BDT', '৳': 'BDT', 'bdt': 'BDT',
        'nepalese rupees': 'NPR', 'nepalese rupee': 'NPR', 'npr': 'NPR'
    };

    for (const [keyword, curr] of Object.entries(currencyKeywords)) {
        if (text.includes(keyword)) {
            currency = curr;
            console.log('Currency detected:', currency);
            break;
        }
    }

    if (!currency) {
        currency = document.getElementById('displayCurrency').value;
    }

    // Detect category
    let category = isIncome ? 'Income' : 'Other';
    if (!isIncome) {
        const categoryKeywords = {
            'food': 'Food & Dining', 'lunch': 'Food & Dining', 'dinner': 'Food & Dining',
            'breakfast': 'Food & Dining', 'meal': 'Food & Dining', 'ate': 'Food & Dining',
            'burger': 'Food & Dining', 'pizza': 'Food & Dining', 'coffee': 'Food & Dining',
            'restaurant': 'Food & Dining', 'cafe': 'Food & Dining',
            'transport': 'Transportation', 'uber': 'Transportation', 'taxi': 'Transportation',
            'bus': 'Transportation', 'train': 'Transportation', 'flight': 'Transportation',
            'gas': 'Transportation', 'fuel': 'Transportation', 'parking': 'Transportation',
            'shopping': 'Shopping', 'clothes': 'Shopping', 'bought': 'Shopping',
            'shoes': 'Shopping', 'shirt': 'Shopping',
            'entertainment': 'Entertainment', 'movie': 'Entertainment', 'game': 'Entertainment',
            'concert': 'Entertainment', 'show': 'Entertainment',
            'bills': 'Bills & Utilities', 'rent': 'Bills & Utilities', 'electricity': 'Bills & Utilities',
            'water': 'Bills & Utilities', 'internet': 'Bills & Utilities', 'phone': 'Bills & Utilities',
            'healthcare': 'Healthcare', 'doctor': 'Healthcare', 'medicine': 'Healthcare',
            'hospital': 'Healthcare', 'pharmacy': 'Healthcare',
            'education': 'Education', 'school': 'Education', 'course': 'Education',
            'book': 'Education', 'tuition': 'Education'
        };
        for (const [keyword, cat] of Object.entries(categoryKeywords)) {
            if (text.includes(keyword)) {
                category = cat;
                break;
            }
        }
    }

    // Clean description - keep the original transcript but remove numbers and currency words
    let description = transcript;

    // Remove common phrases
    const phrasesToRemove = [
        'i spent', 'i received', 'i got', 'i earned', 'i paid', 'i bought',
        'for a', 'for the', 'for', 'on a', 'on the', 'on'
    ];

    phrasesToRemove.forEach(phrase => {
        const regex = new RegExp('\\b' + phrase + '\\b', 'gi');
        description = description.replace(regex, '');
    });

    // Remove numbers (with multipliers)
    description = description.replace(/\d+(?:\.\d+)?\s*(hundred|thousand|million|lakh|crore)?/gi, '');

    // Remove currency words
    description = description.replace(/\b(dollars?|euros?|pounds?|taka|rupees?|won|yen|yuan)\b/gi, '');

    // Clean up extra spaces
    description = description.replace(/\s+/g, ' ').trim();

    // Capitalize first letter
    if (description) {
        description = description.charAt(0).toUpperCase() + description.slice(1);
    }

    // If description is too short or empty, use a default
    if (!description || description.length < 3) {
        description = isIncome ? 'Income received' : category + ' expense';
    }

    console.log('Final parsed:', { amount, currency, category, description, isIncome });

    voiceData = {
        amount,
        currency,
        category,
        description,
        date: new Date().toISOString().split('T')[0],
        isIncome: isIncome
    };

    document.getElementById('voiceCurrencySymbol').textContent = currencySymbols[currency];
    document.getElementById('voiceAmount').textContent = amount.toFixed(2);
    document.getElementById('voiceCategory').textContent = category;
    document.getElementById('voiceDescription').textContent = description;
    document.getElementById('voiceResult').style.display = 'flex';
}

async function confirmVoiceExpense() {
    if (!voiceData || voiceData.amount === 0) {
        alert('Invalid amount');
        return;
    }

    try {
        let response;

        if (voiceData.isIncome) {
            response = await fetch('/api/income/transaction', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    amount: voiceData.amount,
                    currency: voiceData.currency,
                    description: voiceData.description,
                    date: voiceData.date
                })
            });
        } else {
            response = await fetch('/api/expenses', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    amount: voiceData.amount,
                    currency: voiceData.currency,
                    category: voiceData.category,
                    description: voiceData.description,
                    date: voiceData.date
                })
            });
        }

        if (response.ok) {
            document.getElementById('voiceResult').style.display = 'none';
            voiceData = null;
            await loadExpenses();
        } else {
            alert('Failed to save');
        }
    } catch (error) {
        console.error('Error:', error);
        alert('Failed to save');
    }
}

function cancelVoiceExpense() {
    document.getElementById('voiceResult').style.display = 'none';
    voiceData = null;
}

async function loadExpenses() {
    try {
        const response = await fetch('/api/expenses');
        if (response.ok) {
            expenses = await response.json();
            updateDisplay();
        }
    } catch (error) {
        console.error('Error loading expenses:', error);
    }
}

async function saveExpense() {
    const amount = document.getElementById('amount').value;
    const currency = document.getElementById('expenseCurrency').value;
    const category = document.getElementById('category').value;
    const description = document.getElementById('description').value;
    const date = document.getElementById('date').value;

    if (!amount || !description || !date) {
        alert('Please fill all fields');
        return;
    }

    try {
        let response;
        if (isEditMode) {
            const id = document.getElementById('editExpenseId').value;
            response = await fetch(`/api/expenses/${id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ amount, currency, category, description, date })
            });
        } else {
            response = await fetch('/api/expenses', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ amount, currency, category, description, date })
            });
        }

        if (response.ok) {
            toggleAddForm();
            await loadExpenses();
        } else {
            alert('Failed to save expense');
        }
    } catch (error) {
        console.error('Error:', error);
        alert('Failed to save expense');
    }
}

async function saveIncome() {
    const amount = document.getElementById('incomeAmount').value;
    const currency = document.getElementById('incomeCurrency').value;
    const description = document.getElementById('incomeDescription').value;
    const date = document.getElementById('incomeDate').value;

    if (!amount || !description || !date) {
        alert('Please fill all fields');
        return;
    }

    try {
        let response;
        if (isEditIncomeMode) {
            const id = document.getElementById('editIncomeId').value;
            response = await fetch(`/api/expenses/${id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ amount: -Math.abs(amount), currency, category: 'Income', description, date })
            });
        } else {
            response = await fetch('/api/income/transaction', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ amount, currency, description, date })
            });
        }

        if (response.ok) {
            toggleIncomeForm();
            await loadExpenses();
        } else {
            alert('Failed to save income');
        }
    } catch (error) {
        console.error('Error:', error);
        alert('Failed to save income');
    }
}

async function deleteExpense(id) {
    if (confirm('Delete this transaction?')) {
        try {
            await fetch(`/api/expenses/${id}`, { method: 'DELETE' });
            await loadExpenses();
        } catch (error) {
            console.error('Error:', error);
        }
    }
}

function editExpense(id) {
    const expense = expenses.find(e => e.id === id);
    if (!expense) return;

    isEditMode = true;
    document.getElementById('expenseForm').style.display = 'flex';
    document.getElementById('addBtn').textContent = '✕ Close';
    document.getElementById('editExpenseId').value = expense.id;
    document.getElementById('amount').value = expense.amount;
    document.getElementById('expenseCurrency').value = expense.currency || 'USD';
    document.getElementById('category').value = expense.category;
    document.getElementById('description').value = expense.description;
    document.getElementById('date').value = expense.date;
    document.getElementById('saveBtn').textContent = 'Update';
}

function editIncome(id) {
    const income = expenses.find(e => e.id === id);
    if (!income) return;

    isEditIncomeMode = true;
    document.getElementById('incomeForm').style.display = 'flex';
    document.getElementById('addIncomeBtn').textContent = '✕ Close';
    document.getElementById('editIncomeId').value = income.id;
    document.getElementById('incomeAmount').value = Math.abs(income.amount);
    document.getElementById('incomeCurrency').value = income.currency || 'USD';
    document.getElementById('incomeDescription').value = income.description;
    document.getElementById('incomeDate').value = income.date;
    document.getElementById('saveIncomeBtn').textContent = 'Update';
}

function updateDisplay() {
    saveCurrencyPreference();
    const selectedMonth = document.getElementById('monthSelector').value;
    const displayCurrency = document.getElementById('displayCurrency').value;
    const filtered = expenses.filter(e => e.date.startsWith(selectedMonth));

    let totalIncome = 0;
    let totalExpense = 0;

    filtered.forEach(e => {
        const amount = parseFloat(e.amount);
        const converted = convertCurrency(Math.abs(amount), e.currency || 'USD', displayCurrency);

        if (amount < 0 || e.type === 'income') {
            totalIncome += converted;
        } else {
            totalExpense += converted;
        }
    });

    const saved = totalIncome - totalExpense;
    const savingsPercentage = totalIncome > 0 ? ((saved / totalIncome) * 100).toFixed(1) : 0;

    document.getElementById('totalIncome').textContent = formatCurrency(totalIncome, displayCurrency);
    document.getElementById('totalSpending').textContent = formatCurrency(totalExpense, displayCurrency);
    document.getElementById('totalTransactions').textContent = filtered.length;
    document.getElementById('savedAmount').textContent = formatCurrency(saved, displayCurrency);
    document.getElementById('savingsPercentage').textContent = `${savingsPercentage}%`;
    document.getElementById('savedAmount').style.color = saved >= 0 ? '#22c55e' : '#ef4444';

    displayTransactions(filtered, displayCurrency);
    updateCharts(filtered, displayCurrency);
}

function displayTransactions(filtered, displayCurrency) {
    const list = document.getElementById('transactionsList');
    if (filtered.length === 0) {
        list.innerHTML = '<div class="no-data">No transactions this month</div>';
        return;
    }

    list.innerHTML = filtered.sort((a, b) => b.id - a.id)
        .map(e => {
            const amount = parseFloat(e.amount);
            const isIncome = amount < 0 || e.type === 'income';
            const originalCurrency = e.currency || 'USD';
            const originalAmount = Math.abs(amount); // Original amount in original currency
            const converted = convertCurrency(originalAmount, originalCurrency, displayCurrency);
            const showBothCurrencies = originalCurrency !== displayCurrency;

            return `
                <div class="trans-item ${isIncome ? 'income-item' : ''}">
                    <div class="trans-info">
                        <strong style="color: ${isIncome ? '#22c55e' : '#333'}">
                            ${isIncome ? '+' : ''}${formatCurrency(converted, displayCurrency)}
                            ${showBothCurrencies ? `<span style="color: #999; font-size: 11px; font-weight: normal;"> (${formatCurrency(originalAmount, originalCurrency)})</span>` : ''}
                        </strong>
                        <span>${e.description}</span>
                        <span class="trans-cat" style="background: ${isIncome ? '#22c55e' : '#667eea'}">${e.category || 'Income'}</span>
                        <span class="trans-date">${e.date}</span>
                    </div>
                    <div class="trans-btns">
                        <button onclick="${isIncome ? 'editIncome' : 'editExpense'}(${e.id})" class="mini-btn">✎</button>
                        <button onclick="deleteExpense(${e.id})" class="mini-btn">✕</button>
                    </div>
                </div>
            `;
        }).join('');
}

function updateCharts(filtered, displayCurrency) {
    const categories = {};
    filtered.forEach(e => {
        const amount = parseFloat(e.amount);
        if (amount > 0) {
            const converted = convertCurrency(amount, e.currency || 'USD', displayCurrency);
            categories[e.category] = (categories[e.category] || 0) + converted;
        }
    });

    const isDark = document.body.classList.contains('dark-mode');
    const textColor = isDark ? '#cccccc' : '#333';
    const gridColor = isDark ? '#222222' : '#e5e7eb';

    if (categoryChart) categoryChart.destroy();
    if (Object.keys(categories).length > 0) {
        const ctx1 = document.getElementById('categoryChart').getContext('2d');
        categoryChart = new Chart(ctx1, {
            type: 'doughnut',
            data: {
                labels: Object.keys(categories),
                datasets: [{
                    data: Object.values(categories),
                    backgroundColor: ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884D8', '#82CA9D', '#FFC658', '#FF6B9D']
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: true,
                plugins: { legend: { position: 'bottom', labels: { color: textColor, font: { size: 10 } } } }
            }
        });
    }

    const months = {};
    expenses.forEach(e => {
        const amount = parseFloat(e.amount);
        if (amount > 0) {
            const month = e.date.slice(0, 7);
            const converted = convertCurrency(amount, e.currency || 'USD', displayCurrency);
            months[month] = (months[month] || 0) + converted;
        }
    });

    const sortedMonths = Object.keys(months).sort().slice(-6);
    if (trendChart) trendChart.destroy();
    if (sortedMonths.length > 0) {
        const ctx2 = document.getElementById('trendChart').getContext('2d');
        trendChart = new Chart(ctx2, {
            type: 'bar',
            data: {
                labels: sortedMonths,
                datasets: [{
                    label: `Spending (${displayCurrency})`,
                    data: sortedMonths.map(m => months[m]),
                    backgroundColor: '#8884D8'
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: true,
                scales: {
                    y: { beginAtZero: true, ticks: { color: textColor }, grid: { color: gridColor } },
                    x: { ticks: { color: textColor }, grid: { color: gridColor } }
                },
                plugins: { legend: { display: false } }
            }
        });
    }
}