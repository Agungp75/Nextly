# Rencana Proyek: Nextly (Random Video Chat)

**Nextly** adalah proyek gabut / uji coba platform video chat acak (mirip OmeTV / Umingle). Fokus: gratis atau biaya seminimal mungkin, target ratusan concurrent user, tanpa database di tahap awal.

**Nama proyek:** Nextly (pendek, mudah diketik, nyambung dengan tombol **Next**).

**Ruang lingkup saat ini:** hanya **2 halaman**, yaitu **Home** dan **Nextly**. Fitur Room (meeting banyak orang) **ditunda** dan dicatat di bagian 12 sebagai rencana berikutnya.

---

## 1. Halaman

| Halaman | Path | Fungsi |
|---|---|---|
| **Home** | `/` | Landing page: penjelasan singkat Nextly, syarat penggunaan, tombol masuk ke Nextly |
| **Nextly** | `/nextly` | Video chat acak 1-lawan-1 (Start, Next, Stop, Report) |

Opsional di Home: kartu "Room (segera hadir)" yang dinonaktifkan, supaya struktur halaman sudah siap untuk fitur berikutnya.

## 2. Prinsip Kerja

1. User tekan **Start** dan masuk antrian matching.
2. Server mencocokkan 2 user.
3. Video dan audio langsung peer-to-peer lewat WebRTC.
4. Server hanya sebagai **signaling** (memperkenalkan dua user), tidak meneruskan video.

## 3. Arsitektur (Versi Hemat)

| Bagian | Teknologi / Platform | Keterangan |
|---|---|---|
| Frontend | Vercel / GitHub Pages | HTML + JS statis (atau React/Vue/Next.js) |
| Signaling server | Render (free tier) / alternatif gratis | Node.js + Socket.io |
| Matching | In-memory (array / Map) | Tanpa Redis dan tanpa database |
| Video connection | WebRTC P2P | Langsung antar browser |
| STUN | Google STUN (gratis) | Membantu koneksi |
| TURN | Dilewati dulu | Sebagian koneksi akan gagal (kira-kira 15-25%, bisa lebih tinggi di jaringan seluler) |

Keputusan: **tidak memakai blockchain** karena signaling butuh kecepatan milidetik. Memakai server Socket.io terpusat yang ringan.

## 4. Data di Memori (Tanpa Database)

| Data | Struktur | Umur |
|---|---|---|
| Antrian tunggu | Array / Set berisi socket ID | Sampai dipasangkan |
| Pasangan aktif | `Map<socketId, partnerId>` | Sampai Next / disconnect |
| Daftar ban | `Map<ip, waktuBerakhir>` | Sampai server restart |
| Jumlah report | `Map<ip, jumlah>` | Sampai server restart |
| Counter user online | Satu variabel angka | Real-time |

Semua data hilang saat server restart atau tidur. User yang terputus cukup menekan Start lagi.

## 5. Alur Matching

1. User buka halaman dan memberi izin kamera / mikrofon. **Kamera wajib selalu aktif** (tidak ada opsi mematikan kamera, obrolan dijeda otomatis jika sinyal kamera hilang guna mencegah layar hitam).
2. Tekan **Start**, client kirim event `join`.
3. Server cek antrian:
   - Ada yang menunggu: pasangkan, kirim `matched` ke keduanya (salah satu menjadi initiator).
   - Tidak ada: masukkan ke antrian.
4. Client bertukar `offer`, `answer`, dan `ice-candidate` lewat server.
5. Video / audio mengalir langsung antar browser.
6. **Next** atau disconnect: tutup koneksi lama, hapus pasangan dari Map, masukkan user kembali ke antrian.

## 6. Fitur Pendukung

### 6.1 Emoji naik ke atas video
- Emoji diklik, event dikirim lewat **WebRTC DataChannel** (langsung P2P).
- Kedua sisi menampilkan emoji sebagai elemen HTML di atas `<video>` dengan animasi CSS (naik, memudar).
- Batasi jumlah klik per detik untuk mencegah spam.

### 6.2 Filter background
- Memakai **MediaPipe Image Segmenter** (selfie segmentation) yang berjalan di browser.
- Mask memisahkan orang dan latar, latar diganti blur, warna polos, atau gambar milik sendiri.
- Hasil digambar ke `<canvas>`, lalu dikirim lewat `canvas.captureStream()`.

### 6.3 Filter wajah (khusus pewarnaan)
- Hanya color grading (hangat, dingin, sepia, vintage, hitam-putih, pastel), **tanpa efek bentuk wajah atau tubuh**.
- Bisa memakai mask orang dari segmentasi supaya warna tidak mengenai latar.
- Opsional nanti: MediaPipe Face Landmarker untuk membatasi ke area wajah.

### 6.4 Pipeline filter (penting)
Filter harus diproses sebelum dikirim agar lawan bicara ikut melihatnya.

```
Kamera -> <video> tersembunyi -> canvas (segmentasi + latar + warna)
       -> captureStream(30) -> sender.replaceTrack() ke RTCPeerConnection
```

- Audio tetap dari mikrofon asli.
- `replaceTrack` memungkinkan filter dinyalakan / dimatikan tanpa memutus koneksi.
- CSS filter pada `<video>` hanya terlihat oleh diri sendiri, jadi tidak dipakai untuk fitur ini.

### 6.5 Flip Kamera & Cermin (Mirror)
- **Flip Kamera**: Membalik orientasi kamera depan (`user`) dan belakang (`environment`) atau berganti webcam secara dinamis via `replaceTrack` tanpa memutus koneksi.
- **Toggle Cermin (Mirroring)**: Membalik tampilan cermin horizontal pada layar lokal agar tulisan, pakaian, atau arah tangan tidak terbalik dan tidak membingungkan pengguna.

## 7. Tahapan Pengerjaan

### Tahap 1: Inti (1-2 hari)
- Server Socket.io dengan antrian dan matching.
- Client WebRTC: Start, Next, Stop.
- Uji di lokal dengan dua tab browser.

### Tahap 2: Dasar keamanan (wajib sebelum dibuka ke orang lain)
- Tombol Report dan ban sementara berbasis IP di memori.
- Rate limit join per IP.
- Halaman syarat penggunaan dan konfirmasi 18+.

### Tahap 3: Halaman Home
- Landing page dengan penjelasan singkat, syarat penggunaan, dan tombol masuk ke Nextly.
- Desain responsif untuk HP.

### Tahap 4: Fitur pendukung
- Emoji reaction lewat DataChannel.
- Color grading di canvas.
- Background filter dengan MediaPipe dan gambar latar sendiri.

### Tahap 5: Deploy gratis
- Frontend ke Vercel atau GitHub Pages.
- Server ke Render free tier (atau alternatif, cek kebijakan terbaru).
- Wajib `wss://` dan HTTPS, serta reconnect otomatis di client.

### Tahap 6: Uji kecil dan optimasi
- Uji dengan 10-20 teman, termasuk yang memakai data seluler, untuk melihat persentase gagal connect tanpa TURN.
- Uji performa filter di HP kelas menengah dan iPhone.

## 8. Struktur Proyek

```
nextly/
├── server/
│   ├── index.js          // Socket.io, antrian, matching, report, ban, rate limit
│   └── package.json
└── client/
    ├── index.html        // Home
    ├── nextly.html       // halaman Nextly
    ├── css/
    │   └── style.css
    ├── js/
    │   ├── nextly.js     // WebRTC 1-lawan-1 + Socket.io
    │   ├── reactions.js  // emoji + DataChannel
    │   ├── effects.js    // pipeline canvas: segmentasi, latar, warna
    │   └── common.js     // izin kamera, util, reconnect
    └── backgrounds/      // gambar latar milik sendiri
```

Modul `reactions.js`, `effects.js`, dan `common.js` dibuat terpisah dari logika Nextly supaya bisa dipakai ulang jika nanti Room ditambahkan.

## 9. Batasan Versi Ini

- Tidak cocok untuk ribuan user bersamaan.
- Tanpa TURN, sebagian user di balik NAT / firewall ketat gagal connect.
- Data antrian, ban, dan report hilang saat server restart.
- Hanya satu instance server (state di memori tidak dibagi antar instance).
- Free tier Render tidur setelah idle sekitar 15 menit, cold start sekitar 30-60 detik.
- Moderasi masih dasar.

## 10. Risiko dan Mitigasi

| Risiko | Mitigasi |
|---|---|
| Konten tidak pantas / penyalahgunaan (alasan utama Omegle ditutup) | Mulai dari lingkaran kecil (teman, komunitas), report dan ban sejak awal, syarat penggunaan, batas usia 18+ |
| Ban hilang saat restart | Nanti pakai SQLite (jika ada disk persisten) atau Upstash Redis free tier |
| Koneksi gagal tanpa TURN | Pertimbangkan TURN gratis (Metered, Cloudflare) dengan kuota terbatas, cek halaman resmi |
| Filter berat di HP murah | Resolusi segmentasi kecil, 15-24 fps, filter default mati, tombol matikan filter |
| Safari / iOS tidak mendukung `ctx.filter` | Pakai WebGL shader atau manipulasi piksel manual, uji `captureStream` di iOS |
| Model MediaPipe berukuran beberapa MB | Muat hanya saat user mengaktifkan filter |
| Aspek hukum di Indonesia | Perhatikan kewajiban PSE (Komdigi), UU ITE, dan UU Pornografi jika dibuka untuk publik |

## 11. Branding dan Nama

- Nama: **Nextly**.
- Cek ketersediaan domain (`nextly.com`, `nextly.id`, `nextly.app`). Untuk uji coba, subdomain gratis seperti `nextly.vercel.app` cukup.
- Cari dulu apakah nama sudah dipakai di Google, App Store / Play Store, dan media sosial. Kalau nanti dibuka publik, pertimbangkan varian seperti `nextly.chat` atau `getnextly`.
- Cek handle media sosial (Instagram, TikTok) jika ingin dipromosikan.
- Hindari memakai kata "Omegle" atau "OmeTV" karena itu merek pihak lain.
- Opsional: tagline (misalnya "Satu klik, orang baru") dan arah logo (ikon panah "next" digabung gelembung chat).

## 12. Ditunda: Fitur Room (Meeting Banyak Orang)

Belum dikerjakan. Catatan ringkas supaya keputusan tidak hilang:

- Halaman tambahan `/room`: buat room dengan kode / link, gabung dengan nama, mute / kamera, chat teks, kontrol host, berbagi layar.
- **P2P mesh** (gratis) hanya nyaman untuk sekitar 4-6 orang. Untuk puluhan orang butuh **SFU** (LiveKit, Jitsi, atau mediasoup) yang memakan bandwidth dan biasanya berbayar setelah kuota gratis habis. Cek kuota terbaru masing-masing.
- Pada meeting, **TURN menjadi jauh lebih penting** karena satu peserta yang gagal connect sangat terasa.
- Cold start server gratis lebih mengganggu untuk meeting terjadwal.
- Pakai nama "Room", bukan "Zoom", karena itu merek pihak lain.
- Server bisa dipisah dengan namespace Socket.io `/room` di server yang sama.

## 13. Pengembangan Lanjutan (Nanti)

- Redis atau database untuk ban yang persisten.
- TURN server untuk meningkatkan keberhasilan koneksi.
- Interest-based matching dan mode teks.
- Login untuk mengurangi spam.
- Fitur Room (lihat bagian 12).
- Eksperimen signaling terdesentralisasi (Nostr relay / libp2p) sebagai tahap belajar tambahan, tanpa blockchain.

## 14. Checklist Singkat

- [ ] Cek domain dan ketersediaan nama Nextly
- [x] Server Socket.io: antrian dan matching
- [x] Client WebRTC: Start, Next, Stop
- [x] Report, ban IP, rate limit
- [x] Syarat penggunaan dan konfirmasi 18+
- [x] Halaman Home
- [x] Emoji reaction (DataChannel)
- [x] Color grading
- [x] Background filter (MediaPipe)
- [x] Reconnect otomatis dan wss/http signaling
- [ ] Deploy frontend dan server gratis
- [ ] Uji dengan 10-20 teman (WiFi dan data seluler)
