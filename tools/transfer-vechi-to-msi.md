# Transfer proiecte — laptop VECHI → MSI NOU

> **User pe vechi:** `vitea` → `C:\Users\vitea\`  
> **Pe unele mașini dev:** user poate fi `user` → înlocuiește calea peste tot.  
> **Ambele laptopuri:** aceeași Wi‑Fi, vechi pornit cu serverul HTTP activ.

---

## PARTEA A — LAPTOPUL VECHI (Administrator, cmd)

### Pas 1 — CMD Administrator

`Win` → `cmd` → click dreapta → **Run as administrator** → Da

### Pas 2 — Folder utilizator

```cmd
cd C:\Users\vitea
dir /ad /b
```

Trebuie să vezi: `ATS-HERO`, `BBC AI Chatbot Admin Panel`, `BBC NLP`, etc.

### Pas 3 — ZIP proiecte (~6 GB, fără node_modules/.venv)

```cmd
7z a Projects.zip ATS-HERO "BBC AI Chatbot Admin Panel" "BBC NLP" "BBC SKY DATA Chatbot" "BBC launch" "Agents nou" "Admin test" "AI-webagent_extractor" "American Style" Apicultor.md AndroidStudioProjects -xr!node_modules -xr!.venv -xr!__pycache__ -xr!.git -xr!.next -xr!dist
```

Așteaptă **Everything is Ok** (2–10 min).

Dacă un folder lipsește, scoate-l din listă. Dacă `7z` nu e în PATH:

```cmd
"C:\Program Files\7-Zip\7z.exe" a Projects.zip ATS-HERO ...
```

### Pas 4 — ZIP configurări

```cmd
7z a Configs.zip .ssh .n8n .kaggle .gitconfig .claude .kiro .vscode
```

### Pas 5 — IP-ul vechi (notează-l)

```cmd
ipconfig | findstr "IPv4"
```

Folosește IP-ul **192.168.x.x** (nu `172.x`, `26.x`, `192.168.56.x`).

Exemplu: `192.168.8.137`

### Pas 6 — Server HTTP (lasă terminalul DESCHIS)

```cmd
python -m http.server 8080
```

Sau dacă `python` nu merge:

```cmd
C:\Users\vitea\miniconda3\python.exe -m http.server 8080
```

Mesaj așteptat: `Serving HTTP on 0.0.0.0 port 8080 ...`

### Pas 7 — Verificare pe vechi

Browser pe vechi: `http://localhost:8080/` → vezi `Projects.zip` și `Configs.zip`

### Pas 8 — După ce MSI a terminat download

În terminalul cu serverul: `Ctrl+C`, apoi:

```cmd
del C:\Users\vitea\Projects.zip
del C:\Users\vitea\Configs.zip
```

---

## PARTEA B — LAPTOPUL NOU (MSI)

### Pas 1 — Descarcă ZIP-urile

Înlocuiește `192.168.8.137` cu IP-ul de la Pas 5 (vechi):

Browser:

```
http://192.168.8.137:8080/Projects.zip
http://192.168.8.137:8080/Configs.zip
```

Sau cmd:

```cmd
mkdir C:\Users\%USERNAME%\Downloads\transfer
cd C:\Users\%USERNAME%\Downloads\transfer
curl -O http://192.168.8.137:8080/Projects.zip
curl -O http://192.168.8.137:8080/Configs.zip
```

### Pas 2 — Dezarhivează proiectele

```cmd
mkdir C:\Users\%USERNAME%
cd C:\Users\%USERNAME%
"C:\Program Files\7-Zip\7z.exe" x C:\Users\%USERNAME%\Downloads\transfer\Projects.zip -oC:\Users\%USERNAME% -y
```

Verificare:

```cmd
dir C:\Users\%USERNAME%\ATS-HERO
```

### Pas 3 — Dezarhivează configurările

```cmd
cd C:\Users\%USERNAME%
"C:\Program Files\7-Zip\7z.exe" x C:\Users\%USERNAME%\Downloads\transfer\Configs.zip -oC:\Users\%USERNAME% -y
```

### Pas 4 — Reinstalează dependențele (per proiect)

**ATS-HERO (Next.js):**

```cmd
cd C:\Users\%USERNAME%\ATS-HERO\apps\web
npm install
```

**Python (BBC NLP etc.):**

```cmd
cd C:\Users\%USERNAME%\BBC NLP
python -m venv .venv
.venv\Scripts\activate
pip install -r requirements.txt
```

(Adaptat per proiect — `node_modules` și `.venv` nu sunt în zip.)

### Pas 5 — Spune vechiului că ai terminat

Vechiul poate opri serverul (`Ctrl+C`) și șterge zip-urile (Pas 8 Partea A).

---

## Troubleshooting

| Problemă | Soluție |
|---|---|
| MSI nu se conectează | Pe vechi (admin): `netsh advfirewall firewall add rule name="HTTP8080" dir=in action=allow protocol=TCP localport=8080` |
| `7z` not recognized | `"C:\Program Files\7-Zip\7z.exe"` |
| `python` not recognized | `C:\Users\vitea\miniconda3\python.exe -m http.server 8080` |
| Download lent / pică | USB: copiază `Projects.zip` + `Configs.zip` pe stick |
| Profil întreg ~400 GB | **Nu** zip tot user-ul — doar proiectele listate (~6 GB) |

---

## Dimensiuni estimate (scan `user` profile)

| Pachet | ~Mărime |
|---|---|
| Projects.zip (fără node_modules) | ~3–6 GB |
| Configs.zip | ~50–500 MB |
| Profil complet (excl. conda/cache) | ~412 GB → USB, nu HTTP |
