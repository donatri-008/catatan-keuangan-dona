const firebaseConfig = {
  apiKey: "AIzaSyDM3ML_qv6WSOwId_e5IwQGRezsJkGOVYs",
  authDomain: "catatan-keuangan-59ffe.firebaseapp.com",
  projectId: "catatan-keuangan-59ffe",
  storageBucket: "catatan-keuangan-59ffe.firebasestorage.app",
  messagingSenderId: "802299331987",
  appId: "1:802299331987:web:27e2ef6fb1d621ee0d9466",
  measurementId: "G-G699EJBGSB"
};

// Inisialisasi Firebase
const app = firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();
const auth = firebase.auth();

// State Aplikasi
let transactions = [];
let currentEditId = null;
let financeChart = null;
let currentFilter = null;
let unsubscribeTransactions = null;

// Initialize App
auth.onAuthStateChanged(user => {
    const loading = document.getElementById('loading');
    const authContainer = document.getElementById('authContainer');
    const appContent = document.getElementById('appContent');
    const formSection = document.getElementById('formSection'); // Form input transaksi
    const filterSection = document.getElementById('filterSection'); // Filter transaksi
    const transactionHistory = document.getElementById('transactionHistory'); // Riwayat transaksi

    loading.style.display = 'flex';

    setTimeout(() => {
        if (user) {
            // Tampilkan semua elemen aplikasi
            authContainer.classList.remove('active');
            appContent.classList.add('active');
            formSection.classList.remove('hidden');
            filterSection.classList.remove('hidden');
            transactionHistory.classList.remove('hidden');
            setupRealTimeListener();
        } else {
            // Sembunyikan semua elemen aplikasi
            authContainer.classList.add('active');
            appContent.classList.remove('active');
            formSection.classList.add('hidden');
            filterSection.classList.add('hidden');
            transactionHistory.classList.add('hidden');
            showAuthUI();
        }
        loading.style.display = 'none';
    }, 1000);
});


// ================= AUTHENTICATION =================
function showAuthUI() {
    const authContainer = document.getElementById('authContainer');
    authContainer.innerHTML = `
        <h2>🔐 Silakan Login/Daftar</h2>
        <form class="auth-form" onsubmit="return false;">
            <input type="email" id="authEmail" placeholder="Email" required>
            <input type="password" id="authPassword" placeholder="Password" required>
            <button type="submit" onclick="handleAuth()">Masuk</button>
            <button type="button" onclick="handleGoogleAuth()">Masuk dengan Google</button>
            <button type="button" onclick="showResetPassword()">Lupa Password?</button>
            <div id="authError" class="auth-error"></div>
        </form>
    `;
}

async function handleAuth() {
    const email = document.getElementById('authEmail').value;
    const password = document.getElementById('authPassword').value;
    const authError = document.getElementById('authError');

    try {
        await auth.signInWithEmailAndPassword(email, password);
    } catch (error) {
        if (error.code === 'auth/user-not-found') {
            try {
                await auth.createUserWithEmailAndPassword(email, password);
            } catch (signupError) {
                authError.textContent = signupError.message;
            }
        } else {
            authError.textContent = error.message;
        }
    }
}

async function handleGoogleAuth() {
    const provider = new firebase.auth.GoogleAuthProvider();
    try {
        await auth.signInWithPopup(provider);
    } catch (error) {
        document.getElementById('authError').textContent = error.message;
    }
}

function showResetPassword() {
    const email = prompt('Masukkan email untuk reset password:');
    if (email) {
        auth.sendPasswordResetEmail(email)
            .then(() => alert('Email reset password telah dikirim!'))
            .catch(error => alert(error.message));
    }
}

function logout() {
    auth.signOut().then(() => {
        // Reset semua state
        transactions = [];
        currentEditId = null;
        if (unsubscribeTransactions) unsubscribeTransactions();
        
        // Tampilkan pesan logout
        alert('Anda telah berhasil logout!');
    }).catch(error => {
        alert('Error saat logout: ' + error.message);
    });
}

// ================= CORE FUNCTIONALITY =================
function initChart() {
    const ctx = document.getElementById('financeChart').getContext('2d');
    financeChart = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: ['Pemasukan', 'Pengeluaran'],
            datasets: [{
                label: 'Statistik Keuangan',
                data: [0, 0],
                backgroundColor: ['#2ecc71', '#e74c3c'],
                borderWidth: 2,
                hoverOffset: 10
            }]
        },
        options: {
            responsive: true,
            plugins: {
                legend: { 
                    position: 'bottom',
                    labels: { font: { size: 14 } }
                },
                tooltip: { bodyFont: { size: 14 } }
            }
        }
    });
}

async function setupRealTimeListener() {
    try {
        unsubscribeTransactions = db.collection('users')
            .doc(auth.currentUser.uid)
            .collection('transactions')
            .orderBy('date', 'desc')
            .onSnapshot(snapshot => {
                transactions = snapshot.docs.map(doc => ({
                    id: doc.id,
                    ...doc.data(),
                    date: doc.data().date.toDate()
                }));
                updateAll();
            }, error => {
                console.error('Error listening to realtime updates:', error);
                alert('Gagal memuat data transaksi');
            });
    } catch (error) {
        console.error('Error setting up listener:', error);
    }
}

async function saveTransaction(transaction) {
    try {
        const transactionData = {
            ...transaction,
            amount: Number(transaction.amount),
            date: firebase.firestore.Timestamp.fromDate(new Date(transaction.date))
        };

        if (transaction.id) {
            await db.collection('users')
                .doc(auth.currentUser.uid)
                .collection('transactions')
                .doc(transaction.id)
                .update(transactionData);
        } else {
            await db.collection('users')
                .doc(auth.currentUser.uid)
                .collection('transactions')
                .add(transactionData);
        }
    } catch (error) {
        alert('Error menyimpan transaksi: ' + error.message);
    }
}

async function deleteTransaction(id) {
    if (confirm('Apakah Anda yakin ingin menghapus transaksi ini?')) {
        try {
            await db.collection('users')
                .doc(auth.currentUser.uid)
                .collection('transactions')
                .doc(id)
                .delete();
        } catch (error) {
            alert('Error menghapus transaksi: ' + error.message);
        }
    }
}

// ================= UI FUNCTIONS =================
function updateAll() {
    updateSummary();
    updateChart();
    renderTransactions();
}

function updateSummary() {
    const filtered = currentFilter ? transactions.filter(t => 
        new Date(t.date) >= new Date(currentFilter.start) && 
        new Date(t.date) <= new Date(currentFilter.end)
    ) : transactions;

    const income = filtered.filter(t => t.type === 'income').reduce((a, b) => a + b.amount, 0);
    const expense = filtered.filter(t => t.type === 'expense').reduce((a, b) => a + b.amount, 0);
    const balance = income - expense;

    document.getElementById('balance').textContent = `Rp${balance.toLocaleString('id-ID')}`;
    document.getElementById('income').textContent = `Rp${income.toLocaleString('id-ID')}`;
    document.getElementById('expense').textContent = `Rp${expense.toLocaleString('id-ID')}`;
}

function updateChart() {
    const income = transactions.filter(t => t.type === 'income').reduce((a, b) => a + b.amount, 0);
    const expense = transactions.filter(t => t.type === 'expense').reduce((a, b) => a + b.amount, 0);
    
    financeChart.data.datasets[0].data = [income, expense];
    financeChart.update();
}

function renderTransactions() {
    const container = document.getElementById('transactions');
    container.innerHTML = '';

    transactions.forEach(transaction => {
        const div = document.createElement('div');
        div.className = 'transaction-item';
        div.innerHTML = `
            <div style="flex: 2">
                <div>${transaction.name}</div>
                <small>${transaction.date.toLocaleDateString('id-ID')}</small>
                <span class="category-tag">${getCategoryIcon(transaction.category)} ${transaction.category}</span>
            </div>
            <div style="flex: 1; text-align: right">
                <div class="${transaction.type}" style="font-weight: bold">
                    ${transaction.type === 'income' ? '+' : '-'}Rp${transaction.amount.toLocaleString('id-ID')}
                </div>
                <div style="margin-top: 5px">
                    <button onclick="editTransaction('${transaction.id}')">✏️ Edit</button>
                    <button onclick="deleteTransaction('${transaction.id}')">🗑️ Hapus</button>
                </div>
            </div>
        `;
        container.appendChild(div);
    });
}

function getCategoryIcon(category) {
    const icons = {
        makanan: '🍔',
        transportasi: '🚗',
        belanja: '🛍️',
        hiburan: '🎮',
        gaji: '💼',
        lainnya: '❔'
    };
    return icons[category] || '📌';
}

function editTransaction(id) {
    const transaction = transactions.find(t => t.id === id);
    if (transaction) {
        currentEditId = id;
        document.getElementById('transactionName').value = transaction.name;
        document.getElementById('transactionAmount').value = transaction.amount;
        document.getElementById('transactionDate').value = transaction.date.toISOString().split('T')[0];
        document.getElementById('transactionCategory').value = transaction.category;
        document.getElementById('transactionType').value = transaction.type;
        document.getElementById('submitButton').textContent = '💾 Simpan Perubahan';
        window.scrollTo({ top: 0, behavior: 'smooth' });
    }
}

function cancelEdit() {
    currentEditId = null;
    document.getElementById('transactionForm').reset();
    document.getElementById('submitButton').textContent = '➕ Tambah Transaksi';
}

function filterTransactions() {
    const start = document.getElementById('startDate').value;
    const end = document.getElementById('endDate').value;
    
    if (start && end) {
        currentFilter = { start, end };
    } else {
        currentFilter = null;
    }
    
    updateAll();
}

function clearFilter() {
    document.getElementById('startDate').value = '';
    document.getElementById('endDate').value = '';
    currentFilter = null;
    updateAll();
}

function toggleTheme() {
    const theme = document.body.getAttribute('data-theme');
    const newTheme = theme === 'dark' ? 'light' : 'dark';
    document.body.setAttribute('data-theme', newTheme);
    document.querySelector('.theme-btn').textContent = newTheme === 'dark' ? '🌙' : '🌞';
    localStorage.setItem('theme', newTheme);
}

// Event Listeners
document.getElementById('transactionForm').addEventListener('submit', async e => {
    e.preventDefault();

      // Validasi input
    const amount = parseFloat(document.getElementById('transactionAmount').value);
    if (isNaN(amount) || amount <= 0) {
        alert('Jumlah transaksi harus lebih dari 0');
        return;
    }
    
    const transaction = {
        id: currentEditId,
        name: document.getElementById('transactionName').value,
        amount: document.getElementById('transactionAmount').value,
        date: document.getElementById('transactionDate').value,
        category: document.getElementById('transactionCategory').value,
        type: document.getElementById('transactionType').value
    };

    await saveTransaction(transaction);
    cancelEdit();
});

document.addEventListener('DOMContentLoaded', () => {
    const savedTheme = localStorage.getItem('theme') || 'light';
    document.body.setAttribute('data-theme', savedTheme);
    document.querySelector('.theme-btn').textContent = savedTheme === 'dark' ? '🌙' : '🌞';
    initChart();
});
