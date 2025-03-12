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
    const logoutButton = document.getElementById('logoutButton');
    const formSection = document.getElementById('formSection');
    const filterSection = document.getElementById('filterSection');
    const transactionHistory = document.getElementById('transactionHistory');

    loading.style.display = 'flex';

    setTimeout(() => {
        if (user) {
            // Jika sudah login, tampilkan elemen yang diperlukan
            authContainer.style.display = "none";
            appContent.style.display = "block";
            logoutButton.style.display = "inline-block";
            formSection.style.display = "block";
            filterSection.style.display = "block";
            transactionHistory.style.display = "block";

            setupRealTimeListener();
        } else {
            // Jika belum login, sembunyikan semua elemen aplikasi
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

function showAppContent() {
    const appContent = document.getElementById("appContent");
    const authContainer = document.getElementById("authContainer");
    
    if (appContent) {
        appContent.classList.add("active");
        console.log("App content ditampilkan.");
    } else {
        console.log("Elemen appContent tidak ditemukan!");
    }

    if (authContainer) {
        authContainer.classList.remove("active");
        console.log("Auth container disembunyikan.");
    } else {
        console.log("Elemen authContainer tidak ditemukan!");
    }
}

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

// Fungsi untuk toggle form
function showLogin() {
  document.getElementById('loginCard').classList.add('active');
  document.getElementById('signupCard').classList.remove('active');
}

function showSignUp() {
  document.getElementById('signupCard').classList.add('active');
  document.getElementById('loginCard').classList.remove('active');
}

// Fungsi handle login
async function handleLogin() {
  const email = document.getElementById('loginEmail').value;
  const password = document.getElementById('loginPassword').value;
  const authError = document.getElementById('authError');

  try {
    await auth.signInWithEmailAndPassword(email, password);
  } catch (error) {
    authError.textContent = error.message;
  }
}

// Fungsi handle sign up
async function handleSignUp() {
    const loading = document.getElementById('loading');
  try {
    loading.style.display = 'flex';
    
  const username = document.getElementById('signupUsername').value;
  const email = document.getElementById('signupEmail').value;
  const password = document.getElementById('signupPassword').value;
  const errorElement = document.getElementById('signupError');

  try {
    // Membuat user baru
    const userCredential = await auth.createUserWithEmailAndPassword(email, password);
    
    // Menyimpan data tambahan user ke Firestore
    await db.collection('users').doc(userCredential.user.uid).set({
      username: username,
      email: email,
      createdAt: firebase.firestore.FieldValue.serverTimestamp()
    });

    // Logout user setelah berhasil sign up
    await auth.signOut();
    
    showNotification("🎉 Pendaftaran berhasil! Silakan login dengan akun Anda.");
    showLogin();
  } catch (error) {
    errorElement.textContent = error.message;
  } finally {
    loading.style.display = 'none';
  }
}

// ================= AUTHENTICATION =================
function showAuthUI() {
  const authContainer = document.getElementById('authContainer');
  authContainer.innerHTML = `
    <div class="auth-card active" id="loginCard">
      <h2>🔐 Login</h2>
      <form class="auth-form" onsubmit="return false;">
        <input type="email" id="loginEmail" placeholder="Email" required>
        <input type="password" id="loginPassword" placeholder="Password" required>
        <button type="submit" onclick="handleLogin()">Masuk</button>
        <button type="button" onclick="handleGoogleAuth()">Masuk dengan Google</button>
        <button type="button" onclick="showResetPassword()">Lupa Password?</button>
        <div class="auth-switch">Belum punya akun? <a href="#" onclick="showSignUp()">Daftar di sini</a></div>
        <div id="authError" class="auth-error"></div>
      </form>
    </div>

    <div class="auth-card" id="signupCard">
      <h2>📝 Daftar Akun Baru</h2>
      <form class="auth-form" onsubmit="return false;">
        <input type="text" id="signupUsername" placeholder="Username" required>
        <input type="email" id="signupEmail" placeholder="Email" required>
        <input type="password" id="signupPassword" placeholder="Password" required>
        <button type="submit" onclick="handleSignUp()">Daftar</button>
        <button type="button" onclick="showLogin()">Kembali ke Login</button>
        <div id="signupError" class="auth-error"></div>
      </form>
    </div>
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
        // Hentikan listener sebelumnya jika ada
        if (typeof unsubscribeTransactions === "function") {
            unsubscribeTransactions();
        }

        unsubscribeTransactions = db.collection('users')
            .doc(auth.currentUser.uid)
            .collection('transactions')
            .orderBy('date', 'desc')
            .onSnapshot({
                includeMetadataChanges: false // Nonaktifkan trigger metadata
            }, (snapshot) => {
                // Proses data hanya jika berasal dari server (bukan cache)
                if (!snapshot.metadata.fromCache) {
                    transactions = snapshot.docs.map(doc => ({
                        id: doc.id,
                        ...doc.data(),
                        date: doc.data().date.toDate() // Konversi Timestamp ke Date
                    }));
                    console.log("Data transaksi diperbarui:", transactions);
                    updateAll();
                }
            }, (error) => {
                console.error("Error listener:", error);
                showNotification("Gagal memuat data realtime", "error");
                transactions = []; // Reset data
                updateAll();
            });

    } catch (error) {
        console.error("Gagal setup listener:", error);
        showNotification("Koneksi database terganggu", "error");
    }
}

async function saveTransaction(transaction) {
    try {
        // Konversi tanggal ke Timestamp Firestore
        const transactionDate = new Date(transaction.date);
        const firestoreDate = firebase.firestore.Timestamp.fromDate(transactionDate);

        const transactionData = {
            ...transaction,
            amount: Number(transaction.amount),
            date: firestoreDate // Gunakan tanggal yang sudah dikonversi
        };

        // Hapus ID dari data yang akan disimpan
        delete transactionData.id;

        if (currentEditId) {
            // Update dokumen yang ada
            await db.collection('users')
                .doc(auth.currentUser.uid)
                .collection('transactions')
                .doc(currentEditId)
                .update(transactionData);
            currentEditId = null; // Reset ID edit
            showNotification("✏️ Transaksi berhasil diperbarui!", "success"); // Notifikasi setelah berhasil update
        } else {
            // Tambah dokumen baru
            await db.collection('users')
                .doc(auth.currentUser.uid)
                .collection('transactions')
                .add(transactionData);
            showNotification("✅ Transaksi berhasil ditambahkan!", "success"); // Notifikasi setelah berhasil tambah
        }
    } catch (error) {
        showNotification("❌ Error: " + error.message, "error");
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
    }).then(async (result) => {
        if (result.isConfirmed) {
            try {
                // Hapus dari Firestore
                await db.collection('users')
                    .doc(auth.currentUser.uid)
                    .collection('transactions')
                    .doc(id)
                    .delete();
                
                showNotification("🗑️ Transaksi berhasil dihapus!", "success");
            } catch (error) {
                showNotification("❌ Gagal menghapus transaksi: " + error.message, "error");
            }
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
                    <button class="edit-btn" data-id="${transaction.id}">✏️ Edit</button>
                    <button class="delete-btn" data-id="${transaction.id}">🗑️ Hapus</button>
                </div>
            </div>
        `;
        container.appendChild(div);
    });

    // Tambahkan event listener untuk tombol Edit dan Hapus dengan event delegation
    container.addEventListener("click", function(event) {
        if (event.target.classList.contains("edit-btn")) {
            const id = event.target.getAttribute("data-id");
            editTransaction(id);
        } else if (event.target.classList.contains("delete-btn")) {
            const id = event.target.getAttribute("data-id");
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
    const transaction = transactions.find(t => t.id === id);

    if (!transaction) {
        console.error("Transaksi tidak ditemukan untuk ID:", id);
        showNotification("❌ Transaksi tidak ditemukan!", "error");
        return;
    }

    Swal.fire({
        title: 'Edit Transaksi',
        text: 'Apakah Anda ingin mengedit transaksi ini?',
        icon: 'question',
        showCancelButton: true,
        confirmButtonText: 'Ya, Edit',
        cancelButtonText: 'Batal'
    }).then((result) => {
        console.log("Hasil konfirmasi edit:", result.isConfirmed);

        if (result.isConfirmed) {
            currentEditId = id;
            const transactionDate = new Date(transaction.date);
            const formattedDate = transactionDate.toISOString().split('T')[0];

            const formSection = document.getElementById('formSection');
            const appContent = document.getElementById('appContent');

            if (!formSection || !appContent) {
                console.error("Elemen formSection atau appContent tidak ditemukan!");
                return;
            }

            // Pastikan form ditampilkan
            appContent.style.display = 'block';
            formSection.style.display = 'block';

            console.log("Menampilkan appContent:", appContent);
            console.log("Menampilkan formSection:", formSection);

            // Isi form dengan data transaksi
            document.getElementById('transactionName').value = transaction.name;
            document.getElementById('transactionAmount').value = transaction.amount;
            document.getElementById('transactionDate').value = formattedDate;
            document.getElementById('transactionCategory').value = transaction.category;
            document.getElementById('transactionType').value = transaction.type;
            document.getElementById('submitButton').textContent = '💾 Simpan Perubahan';

            // Scroll ke formSection setelah elemen ditampilkan
            setTimeout(() => {
                if (window.innerWidth <= 768) {
                    // Untuk HP, gunakan window.scrollTo
                    window.scrollTo({
                        top: formSection.offsetTop - 20,
                        behavior: 'smooth'
                    });
                } else {
                    // Untuk desktop, gunakan scrollIntoView
                    formSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
                }
                console.log("Scrolling ke formSection...", formSection.offsetTop);
            }, 300);
        }
    });
}

function cancelEdit() {
    currentEditId = null;
    document.getElementById('transactionForm').reset();
    document.getElementById('submitButton').textContent = '➕ Tambah Transaksi';

    showNotification("Edit transaksi dibatalkan!", "error");
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
        Swal.fire({
            title: "Jumlah tidak valid!",
            text: "Jumlah transaksi harus lebih dari 0.",
            icon: "warning"
        });
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

    if (currentEditId) {
        showNotification("Transaksi berhasil diperbarui!");
    } else {
        showNotification("Transaksi berhasil ditambahkan!");
    }
});

document.addEventListener('DOMContentLoaded', () => {
    const savedTheme = localStorage.getItem('theme') || 'light';
    document.body.setAttribute('data-theme', savedTheme);
    document.querySelector('.theme-btn').textContent = savedTheme === 'dark' ? '🌙' : '🌞';
    initChart();
});
