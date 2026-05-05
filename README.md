# Frontend GitHub Pages

Upload semua file di folder ini ke repository frontend GitHub, contoh:

```text
eabsensi-satpam-frontend/
├── .nojekyll
├── index.html
├── style.css
├── app.js
├── config.js
└── config.example.js
```

Edit `config.js` sebelum deploy:

```js
window.APP_CONFIG = {
  GITHUB_OWNER: "username-anda",
  BACKEND_REPO: "eabsensi-satpam-backend",
  BRANCH: "main",
  DATA_PATH: "data/db.json",
  ADMIN_PASSWORD: "admin123"
};
```
