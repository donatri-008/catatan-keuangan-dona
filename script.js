const firebaseConfig = {
    apiKey: "AIzaSyDM3ML_qv6WSOwId_e5IwQGRezsJkGOVYs",
    authDomain: "catatan-keuangan-59ffe.firebaseapp.com",
    projectId: "catatan-keuangan-59ffe",
    storageBucket: "catatan-keuangan-59ffe.appspot.com",
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
    const logoutButton = document.getElementById('logoutButton');
    const formSection = document.getElementById('formSection');
    const filterSection = document.getElementById('filterSection');
    const transactionHistory = document.getElementById('transactionHistory');

    loading.style.display = 'flex';

    setTimeout(() => {
        if (user) {
            authContainer.style.display = "none";
            appContent.style.display = "block";
            logoutButton.style.display = "inline-block";
            formSection.style.display = "block";
            filterSection.style.display = "block";
            transactionHistory.style.display = "block";

            setupRealTimeListener();
        } else {
            authContainer.style.display = "block";
            appContent.style.display = "none";
            logoutButton.style.display = "none";
            formSection.style.display = "none";
            filterSection.style.display = "none";
            transactionHistory.style.display = "none";

            showAuthUI();
        }
        loading.style.display = 'none';
    }, 1000);
});

function showNotification(message, type = "success") {
    Swal.fire({
        title: message,
        icon: type,
        width: "20rem",
        padding: "1rem",
        position: "center",
        showConfirmButton: true,
        confirmButtonText: "OK",
        allowOutsideClick: false,
        focusConfirm: true,
    });
}

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
    Swal.fire({
        title: "Konfirmasi Logout",
        text: "Anda yakin ingin logout?",
        icon: "warning",
        showCancelButton: true,
        confirmButtonText: "Ya, Logout",
        cancelButtonText: "Batal"
    }).then((result) => {
        if (result.isConfirmed) {
            auth.signOut().then(() => {
                showNotification("👋 Anda telah logout!");
            }).catch(error => {
                showNotification("Error: " + error.message, "error");
            });
        }
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
        if (unsubscribeTransactions) unsubscribeTransactions();
        
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
                console.log('Transactions updated:', transactions);
                updateAll();
            }, error => {
                console.error('Error listening to updates:', error);
                showNotification("Gagal memuat transaksi", "error");
            });
    } catch (error) {
        console.error('Error setting up listener:', error);
    }
}

async function saveTransaction(transaction) {
    try {
        const transactionData = {
            name: transaction.name,
            amount: Number(transaction.amount),
            date: firebase.firestore.Timestamp.fromDate(new Date(transaction.date)),
            category: transaction.category,
            type: transaction.type
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
        showNotification("Error menyimpan transaksi: " + error.message, "error");
    }
}

async function deleteTransaction(id) {
    Swal.fire({
        title: "Apakah Anda yakin?",
        text: "Transaksi ini akan dihapus secara permanen!",
        icon: "warning",
        showCancelButton: true,
        confirmButtonText: "Ya, hapus!",
        cancelButtonText: "Batal"
    }).then((result) => {
        if (result.isConfirmed) {
            db.collection('users')
                .doc(auth.currentUser.uid)
                .collection('transactions')
                .doc(id)
                .delete()
                .then(() => {
                    showNotification("🗑️ Transaksi berhasil dihapus!", "success");
                })
                .catch(error => {
                    showNotification("Gagal menghapus transaksi: " + error.message, "error");
                });
        }
    });
}

// ================= UI FUNCTIONS =================
function updateAll() {
    updateSummary();
    updateChart();
    renderTransactions();
}

function updateSummary() {
    const filtered = getFilteredTransactions();
    const income = filtered.filter(t => t.type === 'income').reduce((a, b) => a + b.amount, 0);
    const expense = filtered.filter(t => t.type === 'expense').reduce((a, b) => a + b.amount, 0);
    const balance = income - expense;

    document.getElementById('balance').textContent = `Rp${balance.toLocaleString('id-ID')}`;
    document.getElementById('income').textContent = `Rp${income.toLocaleString('id-ID')}`;
    document.getElementById('expense').textContent = `Rp${expense.toLocaleString('id-ID')}`;
}

function getFilteredTransactions() {
    if (!currentFilter) return transactions;
    
    const startDate = new Date(currentFilter.start);
    const endDate = new Date(currentFilter.end);
    endDate.setHours(23, 59, 59, 999);

    return transactions.filter(t => 
        t.date >= startDate && 
        t.date <= endDate
    );
}

function updateChart() {
    const filtered = getFilteredTransactions();
    const income = filtered.filter(t => t.type === 'income').reduce((a, b) => a + b.amount, 0);
    const expense = filtered.filter(t => t.type === 'expense').reduce((a, b) => a + b.amount, 0);
    
    financeChart.data.datasets[0].data = [income, expense];
    financeChart.update();
}

function renderTransactions() {
    const container = document.getElementById('transactions');
    container.innerHTML = '';

    const filtered = getFilteredTransactions();

    filtered.forEach(transaction => {
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
                    <button class="edit-btn" data-id="${transaction.id}">✏️ Edit</button>
                    <button class="delete-btn" data-id="${transaction.id}">🗑️ Hapus</button>
                </div>
            </div>
        `;
        container.appendChild(div);
    });

    // Perbaikan event delegation menggunakan closest()
    container.addEventListener("click", function(event) {
        const editBtn = event.target.closest('.edit-btn');
        const deleteBtn = event.target.closest('.delete-btn');
        
        if (editBtn) {
            const id = editBtn.dataset.id;
            editTransaction(id);
        } else if (deleteBtn) {
            const id = deleteBtn.dataset.id;
            deleteTransaction(id);
        }
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
    console.log('Mencari transaksi dengan ID:', id);
    console.log('Daftar transaksi:', transactions);
    
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
    } else {
        console.error('Transaksi tidak ditemukan dengan ID:', id);
        showNotification("Transaksi tidak ditemukan!", "error");
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
        currentFilter = { 
            start: new Date(start),
            end: new Date(end)
        };
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

// Event Listeners
document.getElementById('transactionForm').addEventListener('submit', async e => {
    e.preventDefault();

    const amount = parseFloat(document.getElementById('transactionAmount').value);
    if (isNaN(amount) {
        showNotification("Jumlah transaksi tidak valid!", "error");
        return;
    }

    const transaction = {
        id: currentEditId,
        name: document.getElementById('transactionName').value.trim(),
        amount: amount,
        date: document.getElementById('transactionDate').value,
        category: document.getElementById('transactionCategory').value,
        type: document.getElementById('transactionType').value
    };

    if (!transaction.name || !transaction.date || !transaction.category || !transaction.type) {
        showNotification("Harap isi semua field!", "error");
        return;
    }

    await saveTransaction(transaction);
    cancelEdit();
});

document.addEventListener('DOMContentLoaded', () => {
    const savedTheme = localStorage.getItem('theme') || 'light';
    document.body.setAttribute('data-theme', savedTheme);
    document.querySelector('.theme-btn').textContent = savedTheme === 'dark' ? '🌙' : '🌞';
    initChart();
});
