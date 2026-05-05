/* 
  CONFIG FRONTEND
  1) Ganti owner dengan username GitHub Anda.
  2) Repo backend harus public agar halaman utama bisa membaca data tanpa token.
  3) Token admin JANGAN dimasukkan di file ini. Token dimasukkan dari halaman Admin saat login.
*/
window.APP_CONFIG = {
  APP_NAME: "EAbsensi SATPAM BANK KALTIMTARA",
  ADMIN_USERNAME: "admin",
  ADMIN_PASSWORD: "230198",
  GITHUB: {
    owner: "andrikproject",
    repo: "eabsensi-satpam-backend",
    branch: "main",
    dataPath: "data/anggota.json"
  }
};
