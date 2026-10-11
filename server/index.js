/**
 * Nextly - In-Memory Signaling & Pairing Server
 * 
 * Sesuai Plan.md:
 * - Socket.io untuk WebRTC signaling (offer, answer, ice-candidate)
 * - Antrian FIFO in-memory & pasangan aktif via Map
 * - Tanpa Redis & tanpa database (state di memori)
 * - Proteksi moderasi: IP-based rate limiting & temporary ban on reports
 * - Broadcast online user counter
 * - Static file serving untuk client frontend
 */

const http = require('http');
const path = require('path');
const express = require('express');
const { Server } = require('socket.io');
const cors = require('cors');

const PORT = process.env.PORT || 3000;
const app = express();
const server = http.createServer(app);

// Enable CORS
app.use(cors());

// Serve static frontend files from ../client
const clientPath = path.join(__dirname, '..', 'client');
app.use(express.static(clientPath));

// Also serve root redirect if needed
app.get('/', (req, res) => {
  res.sendFile(path.join(clientPath, 'index.html'));
});

app.get('/nextly', (req, res) => {
  res.sendFile(path.join(clientPath, 'nextly.html'));
});

// Initialize Socket.io Server
const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST']
  },
  pingInterval: 10000,
  pingTimeout: 5000
});

// =========================================================================
// DATA STRUCTURES DI MEMORI (TANPA DATABASE) - Sesuai Bagian 4 Plan.md
// =========================================================================

// Antrian tunggu: array of socket IDs
const waitingQueue = [];

// Pasangan aktif: Map<socketId, partnerId> (dua arah)
const activePairs = new Map();

// Pemetaan socket ID ke IP address: Map<socketId, ip>
const socketIpMap = new Map();

// Daftar ban sementara: Map<ip, unbanTimestampMs>
const ipBans = new Map();

// Jumlah report per IP: Map<ip, { count: number, reasons: string[] }>
const ipReports = new Map();

// Rate limiting join per IP: Map<ip, { count: number, windowResetTime: number }>
const ipJoinRateLimits = new Map();

// Konfigurasi Keamanan
const RATE_LIMIT_MAX_JOINS = 10;       // Maks 10 join dalam 10 detik
const RATE_LIMIT_WINDOW_MS = 10000;
const REPORT_BAN_THRESHOLD = 3;        // 3 report = ban sementara
const BAN_DURATION_MS = 15 * 60 * 1000; // 15 menit ban sementara

// Helper: Dapatkan client IP dari socket
function getClientIp(socket) {
  const forwarded = socket.handshake.headers['x-forwarded-for'];
  if (forwarded) {
    return forwarded.split(',')[0].trim();
  }
  return socket.conn.remoteAddress || socket.handshake.address || 'unknown';
}

// Helper: Cek apakah IP sedang diblokir
function isIpBanned(ip) {
  if (!ipBans.has(ip)) return false;
  const unbanTime = ipBans.get(ip);
  if (Date.now() > unbanTime) {
    ipBans.delete(ip); // Ban kadaluarsa
    return false;
  }
  return true;
}

// Helper: Cek rate limiting join
function isRateLimited(ip) {
  const now = Date.now();
  let record = ipJoinRateLimits.get(ip);

  if (!record || now > record.windowResetTime) {
    record = { count: 1, windowResetTime: now + RATE_LIMIT_WINDOW_MS };
    ipJoinRateLimits.set(ip, record);
    return false;
  }

  record.count++;
  if (record.count > RATE_LIMIT_MAX_JOINS) {
    return true;
  }
  return false;
}

// Helper: Hapus socket dari antrian
function removeFromQueue(socketId) {
  const index = waitingQueue.indexOf(socketId);
  if (index !== -1) {
    waitingQueue.splice(index, 1);
  }
}

// Helper: Putuskan pasangan saat ini secara bersih
function breakPair(socketId) {
  if (activePairs.has(socketId)) {
    const partnerId = activePairs.get(socketId);
    activePairs.delete(socketId);
    activePairs.delete(partnerId);

    // Beritahu lawan bicara bahwa pasangan terputus
    io.to(partnerId).emit('peer-disconnected');
    return partnerId;
  }
  return null;
}

// Helper: Broadcast jumlah user online
function broadcastOnlineCount() {
  const count = io.engine.clientsCount || 0;
  io.emit('online-count', count);
}

// =========================================================================
// MATCHING LOGIC
// =========================================================================

function attemptMatch(socket) {
  const socketId = socket.id;

  // Pastikan socket bersih dari antrian lama
  removeFromQueue(socketId);

  // Cari partner dari antrian (bukan diri sendiri dan masih terkoneksi)
  while (waitingQueue.length > 0) {
    const potentialPartnerId = waitingQueue.shift();

    // Validasi socket partner
    const partnerSocket = io.sockets.sockets.get(potentialPartnerId);
    if (partnerSocket && partnerSocket.connected && potentialPartnerId !== socketId) {
      // Pasangkan kedua user
      activePairs.set(socketId, potentialPartnerId);
      activePairs.set(potentialPartnerId, socketId);

      // Tentukan salah satu sebagai initiator (membuat offer WebRTC)
      io.to(socketId).emit('matched', {
        partnerId: potentialPartnerId,
        isInitiator: true
      });

      io.to(potentialPartnerId).emit('matched', {
        partnerId: socketId,
        isInitiator: false
      });

      console.log(`[Matched] ${socketId} (Initiator) <---> ${potentialPartnerId}`);
      return;
    }
  }

  // Jika tidak ada yang cocok, masukkan ke antrian
  waitingQueue.push(socketId);
  console.log(`[Queue] ${socketId} masuk antrian. Total menunggu: ${waitingQueue.length}`);
}

// =========================================================================
// SOCKET.IO EVENT HANDLERS
// =========================================================================

io.on('connection', (socket) => {
  const ip = getClientIp(socket);
  socketIpMap.set(socket.id, ip);

  // Periksa apakah IP sedang diblokir
  if (isIpBanned(ip)) {
    const remainingSecs = Math.ceil((ipBans.get(ip) - Date.now()) / 1000);
    socket.emit('banned', `Alamat IP Anda sedang diblokir sementara karena laporan (${remainingSecs} detik tersisa).`);
    socket.disconnect(true);
    return;
  }

  console.log(`[Connected] Socket: ${socket.id} (IP: ${ip})`);
  broadcastOnlineCount();

  // 1. Event: Join Antrian
  socket.on('join', () => {
    if (isIpBanned(ip)) {
      socket.emit('banned', 'Akses Anda diblokir sementara.');
      socket.disconnect(true);
      return;
    }

    if (isRateLimited(ip)) {
      socket.emit('rate-limited', 'Terlalu banyak permintaan join. Mohon tunggu beberapa detik.');
      return;
    }

    // Bersihkan sesi aktif lama jika ada
    breakPair(socket.id);

    // Masuk proses pencarian
    attemptMatch(socket);
  });

  // 2. Event: Next (Lewati pasangan saat ini & cari yang baru)
  socket.on('next', () => {
    if (isIpBanned(ip)) {
      socket.emit('banned', 'Akses Anda diblokir sementara.');
      socket.disconnect(true);
      return;
    }

    if (isRateLimited(ip)) {
      socket.emit('rate-limited', 'Terlalu sering menekan Next. Mohon tunggu...');
      return;
    }

    // Putuskan pasangan saat ini
    breakPair(socket.id);

    // Cari pasangan baru
    attemptMatch(socket);
  });

  // 3. Event: Stop (Tinggalkan panggilan)
  socket.on('stop', () => {
    removeFromQueue(socket.id);
    breakPair(socket.id);
    console.log(`[Stop] ${socket.id} meninggalkan obrolan.`);
  });

  // 4. WebRTC Signaling: Offer
  socket.on('offer', (data) => {
    if (data && data.target && data.sdp) {
      io.to(data.target).emit('offer', {
        senderId: socket.id,
        sdp: data.sdp
      });
    }
  });

  // 5. WebRTC Signaling: Answer
  socket.on('answer', (data) => {
    if (data && data.target && data.sdp) {
      io.to(data.target).emit('answer', {
        senderId: socket.id,
        sdp: data.sdp
      });
    }
  });

  // 6. WebRTC Signaling: ICE Candidate
  socket.on('ice-candidate', (data) => {
    if (data && data.target && data.candidate) {
      io.to(data.target).emit('ice-candidate', {
        senderId: socket.id,
        candidate: data.candidate
      });
    }
  });

  // 7. Event: Report (Pelaporan pelanggaran)
  socket.on('report', (data) => {
    const targetId = data ? data.targetId : null;
    const reason = (data && data.reason) || 'unspecified';

    console.log(`[Report] ${socket.id} melaporkan ${targetId} karena alasan: ${reason}`);

    if (targetId) {
      const targetIp = socketIpMap.get(targetId);

      if (targetIp) {
        // Catat jumlah report
        const record = ipReports.get(targetIp) || { count: 0, reasons: [] };
        record.count++;
        record.reasons.push(reason);
        ipReports.set(targetIp, record);

        console.log(`[Report Count] IP ${targetIp} memiliki ${record.count} laporan.`);

        // Jika melebihi batas toleransi, lakukan pemblokiran IP sementara
        if (record.count >= REPORT_BAN_THRESHOLD) {
          ipBans.set(targetIp, Date.now() + BAN_DURATION_MS);
          console.log(`[IP Banned] IP ${targetIp} diblokir selama ${BAN_DURATION_MS / 60000} menit.`);

          const targetSocket = io.sockets.sockets.get(targetId);
          if (targetSocket) {
            targetSocket.emit('banned', 'Akun Anda ditangguhkan sementara karena menerima laporan pelanggaran komunitas berulang.');
            targetSocket.disconnect(true);
          }
        }
      }

      // Putuskan hubungan kedua pengguna
      breakPair(socket.id);
    }
  });

  // 8. Event: Disconnect
  socket.on('disconnect', () => {
    console.log(`[Disconnected] Socket: ${socket.id}`);
    removeFromQueue(socket.id);
    breakPair(socket.id);
    socketIpMap.delete(socket.id);
    broadcastOnlineCount();
  });
});

// Start Server
server.listen(PORT, () => {
  console.log(`=======================================================`);
  console.log(`⚡ Nextly Signaling & WebRTC Server running on port ${PORT}`);
  console.log(`🌐 Web UI: http://localhost:${PORT}`);
  console.log(`📹 Video Chat: http://localhost:${PORT}/nextly.html`);
  console.log(`=======================================================`);
});
