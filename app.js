import { firebaseConfig } from './firebase-config.js';

// Import Firebase Modules
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getAuth, createUserWithEmailAndPassword, signInWithEmailAndPassword, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { getFirestore, doc, setDoc, getDoc, updateDoc, collection, query, where, getDocs, arrayUnion } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { getStorage, ref, uploadBytes, getDownloadURL } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-storage.js";

// Inisialisasi Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const storage = getStorage(app);

// ============================================
// ROUTING SEDERHANA (Cek file HTML yang dibuka)
// ============================================
if (window.location.pathname.includes('main.html')) {
  initMainApp();
} else {
  initAuthPage();
}

// ============================================
// LOGIKA HALAMAN AUTH (index.html)
// ============================================
function initAuthPage() {
  const registerForm = document.getElementById('registerForm');
  const loginForm = document.getElementById('loginForm');
  const tosModal = document.getElementById('tosModal');
  const btnRegister = document.getElementById('btnRegister');
  const agreeTos = document.getElementById('agreeTos');
  
  // Pindah Form
  document.getElementById('goLogin').addEventListener('click', (e) => { e.preventDefault(); registerForm.style.display = 'none'; loginForm.style.display = 'block'; });
  document.getElementById('goRegister').addEventListener('click', (e) => { e.preventDefault(); loginForm.style.display = 'none'; registerForm.style.display = 'block'; });
  
  // Modal T&C
  document.getElementById('openTos').addEventListener('click', (e) => { e.preventDefault(); tosModal.classList.add('active'); });
  document.getElementById('closeTos').addEventListener('click', () => { tosModal.classList.remove('active'); agreeTos.checked = true; btnRegister.disabled = false; });

  // Logic Daftar Akun
  btnRegister.addEventListener('click', async () => {
    const name = document.getElementById('regName').value.trim();
    const age = document.getElementById('regAge').value.trim();
    const username = document.getElementById('regUsername').value.trim().toLowerCase().replace(/\s+/g, '');
    const pass = document.getElementById('regPass').value;

    if(!name || !age || !username || pass.length < 6) return alert('Isi semua data dengan benar! (Password minimal 6 karakter)');
    
    btnRegister.textContent = 'Memproses...';
    btnRegister.disabled = true;

    try {
      // 1. Cek username udah dipake belum
      const q = query(collection(db, 'users'), where("username", "==", username));
      const snap = await getDocs(q);
      if (!snap.empty) throw new Error('Username sudah dipakai orang lain!');

      // 2. Daftar ke Firebase Auth (Pake trik @gpyth.chat biar dianggap email)
      const email = `${username}@gpyth.chat`;
      const userCred = await createUserWithEmailAndPassword(auth, email, pass);
      const uid = userCred.user.uid;

      // 3. Simpan ke Database (Setingan Admin Khusus @maklov1)
      const isAdmin = username === 'maklov1';
      const userData = {
        uid: uid,
        name: name,
        age: Number(age),
        username: username,
        bio: isAdmin ? "Creator & Admin Gpyth Chat" : "Halo! Saya baru di Gpyth.",
        photoURL: "",
        bannerURL: "",
        telegram: isAdmin ? "maklov1" : "",
        followersCount: isAdmin ? 100000000 : 0, // Admin dapat 100jt follower
        following: [],
        isVerified: isAdmin, // Centang biru
        isAdmin: isAdmin,
        createdAt: new Date().toISOString()
      };
      
      await setDoc(doc(db, 'users', uid), userData);
      
      alert('Pendaftaran Berhasil!');
      window.location.href = 'main.html';

    } catch (err) {
      alert('Gagal Daftar: ' + err.message);
      btnRegister.textContent = 'Daftar Sekarang';
      btnRegister.disabled = false;
    }
  });

  // Logic Login
  document.getElementById('btnLogin').addEventListener('click', async () => {
    const username = document.getElementById('loginUsername').value.trim().toLowerCase();
    const pass = document.getElementById('loginPass').value;
    if(!username || !pass) return alert('Isi username dan password!');

    try {
      const email = `${username}@gpyth.chat`;
      await signInWithEmailAndPassword(auth, email, pass);
      window.location.href = 'main.html';
    } catch (err) {
      alert('Login Gagal: Username atau Password salah.');
    }
  });
}

// ============================================
// LOGIKA HALAMAN UTAMA (main.html)
// ============================================
function initMainApp() {
  let currentUserData = null;

  // Proteksi: Kalau belum login, tendang ke index
  onAuthStateChanged(auth, async (user) => {
    if (user) {
      await loadUserProfile(user.uid);
    } else {
      window.location.href = 'index.html';
    }
  });

  async function loadUserProfile(uid) {
    const docRef = doc(db, 'users', uid);
    const docSnap = await getDoc(docRef);
    if (docSnap.exists()) {
      currentUserData = docSnap.data();
      renderProfile(currentUserData);
    }
  }

  function renderProfile(data) {
    document.getElementById('profileName').textContent = data.name;
    document.getElementById('profileUsername').textContent = '@' + data.username;
    document.getElementById('profileBio').textContent = data.bio;
    document.getElementById('statFollowers').textContent = data.followersCount.toLocaleString('id-ID');
    document.getElementById('statAge').textContent = data.age;
    
    if(data.photoURL) document.getElementById('profileAvatar').src = data.photoURL;
    if(data.bannerURL) document.getElementById('profileBanner').src = data.bannerURL;
    
    if(data.isVerified) document.getElementById('verifiedBadge').style.display = 'inline-block';
    if(data.isAdmin) document.getElementById('adminBadge').style.display = 'inline-block';
    
    if(data.telegram) {
      const tgBtn = document.getElementById('profileTg');
      tgBtn.style.display = 'flex';
      tgBtn.innerHTML = '✈️ Telegram';
      tgBtn.href = `https://t.me/${data.telegram.replace('@', '')}`;
    }
  }

  // --- NAVIGASI 4 TAB BAWAH ---
  const navItems = document.querySelectorAll('.nav-item');
  const tabPanes = document.querySelectorAll('.tab-pane');
  const pageTitle = document.getElementById('pageTitle');
  const titles = { 'chat': 'Chat Ramai', 'grup': 'Grup', 'dm': 'Chat Pribadi', 'profil': 'Profil Saya' };

  navItems.forEach(item => {
    item.addEventListener('click', () => {
      navItems.forEach(nav => nav.classList.remove('active'));
      tabPanes.forEach(tab => tab.classList.remove('active'));
      item.classList.add('active');
      const targetTab = item.dataset.tab;
      document.getElementById(`tab-${targetTab}`).classList.add('active');
      pageTitle.textContent = titles[targetTab];
    });
  });

  // --- FITUR EDIT PROFIL & UPLOAD GAMBAR ---
  const editModal = document.getElementById('editProfileModal');
  
  document.getElementById('btnEditProfile').addEventListener('click', () => {
    if(!currentUserData) return;
    document.getElementById('editName').value = currentUserData.name;
    document.getElementById('editBio').value = currentUserData.bio;
    document.getElementById('editTg').value = currentUserData.telegram || '';
    editModal.classList.add('active');
  });
  
  document.getElementById('btnCloseEdit').addEventListener('click', () => editModal.classList.remove('active'));

  document.getElementById('btnSaveProfile').addEventListener('click', async () => {
    const btn = document.getElementById('btnSaveProfile');
    btn.textContent = 'Menyimpan...';
    btn.disabled = true;

    try {
      const newName = document.getElementById('editName').value;
      const newBio = document.getElementById('editBio').value;
      const newTg = document.getElementById('editTg').value;
      
      const avatarFile = document.getElementById('editAvatar').files[0];
      const bannerFile = document.getElementById('editBanner').files[0];
      
      let updateData = { name: newName, bio: newBio, telegram: newTg };

      // Upload Foto Profil
      if (avatarFile) {
        const fileRef = ref(storage, `avatars/${currentUserData.uid}`);
        await uploadBytes(fileRef, avatarFile);
        updateData.photoURL = await getDownloadURL(fileRef);
      }
      
      // Upload Banner
      if (bannerFile) {
        const fileRef = ref(storage, `banners/${currentUserData.uid}`);
        await uploadBytes(fileRef, bannerFile);
        updateData.bannerURL = await getDownloadURL(fileRef);
      }

      await updateDoc(doc(db, 'users', currentUserData.uid), updateData);
      
      currentUserData = { ...currentUserData, ...updateData };
      renderProfile(currentUserData);
      
      alert('Profil berhasil diupdate!');
      editModal.classList.remove('active');
    } catch (error) {
      console.error(error);
      alert('Gagal simpan profil: ' + error.message);
    } finally {
      btn.textContent = 'Simpan';
      btn.disabled = false;
    }
  });

  // --- FITUR CARI TEMAN ---
  const searchModal = document.getElementById('searchModal');
  document.getElementById('btnSearch').addEventListener('click', () => searchModal.classList.add('active'));
  document.getElementById('btnCloseSearch').addEventListener('click', () => searchModal.classList.remove('active'));

  document.getElementById('btnDoSearch').addEventListener('click', async () => {
    const keyword = document.getElementById('searchInput').value.trim().toLowerCase().replace('@', '');
    const resultsDiv = document.getElementById('searchResults');
    
    if(!keyword) return;
    resultsDiv.innerHTML = '<p style="color:var(--text-dim); font-size:13px;">Mencari...</p>';

    try {
      const q = query(collection(db, 'users'), where("username", "==", keyword));
      const snap = await getDocs(q);
      
      resultsDiv.innerHTML = '';
      if(snap.empty) {
        resultsDiv.innerHTML = '<p style="color:var(--text-dim); font-size:13px; text-align:center;">User tidak ditemukan.</p>';
        return;
      }

      snap.forEach((docSnap) => {
        const user = docSnap.data();
        const div = document.createElement('div');
        div.className = 'user-result';
        
        let btnHtml = '';
        if(user.uid !== currentUserData.uid) {
          const isFollowing = currentUserData.following.includes(user.uid);
          btnHtml = `<button class="btn btn-primary btn-sm btn-follow" data-uid="${user.uid}" ${isFollowing ? 'disabled' : ''}>${isFollowing ? 'Ditambahkan' : '+ Teman'}</button>`;
        }

        div.innerHTML = `
          <div class="user-result-info">
            <img src="${user.photoURL || 'https://via.placeholder.com/45'}" />
            <div>
              <h4>${user.name} ${user.isVerified ? '✔️' : ''}</h4>
              <p>@${user.username}</p>
            </div>
          </div>
          ${btnHtml}
        `;
        resultsDiv.appendChild(div);
      });

      // Logic Klik Tombol Tambah Teman
      document.querySelectorAll('.btn-follow').forEach(btn => {
        btn.addEventListener('click', async (e) => {
          const targetUid = e.target.dataset.uid;
          e.target.textContent = '...';
          e.target.disabled = true;

          try {
            // Tambah ke list following gua
            await updateDoc(doc(db, 'users', currentUserData.uid), {
              following: arrayUnion(targetUid)
            });
            // Tambah jumlah followers dia
            const targetRef = doc(db, 'users', targetUid);
            const targetSnap = await getDoc(targetRef);
            if(targetSnap.exists()) {
               await updateDoc(targetRef, {
                 followersCount: (targetSnap.data().followersCount || 0) + 1
               });
            }
            
            currentUserData.following.push(targetUid);
            e.target.textContent = 'Ditambahkan';
          } catch (err) {
            alert('Gagal nambah teman.');
            e.target.textContent = '+ Teman';
            e.target.disabled = false;
          }
        });
      });

    } catch (err) {
      resultsDiv.innerHTML = `<p style="color:var(--danger); font-size:13px;">Error: ${err.message}</p>`;
    }
  });
}